import axios, { AxiosError } from 'axios';
import {
  FLOWXO_NEW_LINK_REWARD_WEBHOOK,
  FLOWXO_WEBHOOK_API_KEY,
  SOURCE_TG_ID,
} from '../../secrets';
import {
  PatchRawResult,
  PatchResult,
  RewardInit,
  RewardParams,
  createRewardParams,
} from '../types/webhook.types';
import {
  REWARDS_COLLECTION,
  TransactionStatus,
  USERS_COLLECTION,
} from '../utils/constants';
import {
  getPatchWalletAccessToken,
  getPatchWalletAddressFromTgId,
  sendTokens,
} from '../utils/patchwallet';
import {
  getStatus,
  isPendingTransactionHash,
  isSuccessfulTransaction,
  isTreatmentDurationExceeded,
  sendTransaction,
  updateTxHash,
  updateUserOpHash,
} from './utils';
import { Db, WithId } from 'mongodb';
import { Database } from '../db/conn';
import { MongoReward, MongoUser } from '../types/mongo.types';

/**
 * Handles the processing of a link rewardInstance based on specified parameters.
 * @param params - The parameters required for the link rewardInstance.
 * @returns A promise resolving to a boolean value.
 *          - Returns `true` if the link rewardInstance handling is completed or conditions are not met.
 *          - Returns `false` if an error occurs during the link rewardInstance processing.
 */
export async function handleLinkReward(params: RewardParams): Promise<boolean> {
  try {
    const { shouldBeIssued, rewardInstance } = await LinkRewardTelegram.build(
      createRewardParams(params, params.patchwallet || ''),
    );

    if (!shouldBeIssued) return true;

    let txReward: PatchResult | undefined;

    // Handle pending hash status
    if (isPendingTransactionHash(rewardInstance.status)) {
      if (await isTreatmentDurationExceeded(rewardInstance)) return true;

      // Check userOpHash and updateInDatabase for success
      if (!rewardInstance.userOpHash)
        return (
          await rewardInstance.updateInDatabase(
            TransactionStatus.SUCCESS,
            new Date(),
          ),
          true
        );

      // Get status of rewardInstance test
      if ((txReward = await getStatus(rewardInstance)).isError) return false;
    }

    // Check for txReward and send transaction if not present
    if (!txReward && (txReward = await sendTransaction(rewardInstance)).isError)
      return false;

    if (txReward && txReward.txHash) {
      updateTxHash(rewardInstance, txReward.txHash);
      await Promise.all([
        rewardInstance.updateInDatabase(TransactionStatus.SUCCESS, new Date()),
        rewardInstance.saveToFlowXO(),
      ]).catch((error) =>
        console.error(
          `[${params.eventId}] Error processing FlowXO webhook during sign up rewardInstance: ${error}`,
        ),
      );
      return true;
    }

    // Update userOpHash if present in txReward
    if (txReward && txReward.userOpHash) {
      updateUserOpHash(rewardInstance, txReward.userOpHash);
      await rewardInstance.updateInDatabase(
        TransactionStatus.PENDING_HASH,
        null,
      );
    }
    return false;
  } catch (error) {
    console.error(
      `[${params.eventId}] Error processing link rewardInstance event: ${error}`,
    );
  }
  return true;
}

export const link_reward_utils = {
  handleLinkReward,
};

/**
 * Represents a link reward for Telegram users.
 */
export class LinkRewardTelegram {
  /** The parameters required for the reward. */
  params: RewardParams;

  /** Indicates if the reward is present in the database. */
  isInDatabase: boolean = false;

  /** Transaction details of the reward. */
  tx: WithId<MongoReward> | null;

  /** Current status of the reward. */
  status: TransactionStatus;

  /** Transaction hash associated with the reward. */
  txHash?: string;

  /** User operation hash. */
  userOpHash?: string;

  /** Transaction details of the referent. */
  referent: WithId<MongoUser> | null;

  /** Database reference. */
  db: Db | null;

  /**
   * Constructor for LinkRewardTelegram class.
   * @param params - The parameters required for the reward.
   */
  constructor(params: RewardParams) {
    // Assigns the incoming 'params' to the class property 'params'
    this.params = params;

    // Sets default values for specific parameters
    this.params.reason = 'referral_link';
    this.params.amount = '10';
    this.params.message = 'Referral link';

    // Initializes the 'status' property to 'TransactionStatus.UNDEFINED' by default
    this.status = TransactionStatus.UNDEFINED;
  }

  /**
   * Asynchronously creates and initializes a reward instance of LinkRewardTelegram.
   * @param {RewardParams} params - The parameters required for the reward.
   * @returns {Promise<RewardInit>} - Promise resolving to a RewardInit instance.
   */
  static async build(params: RewardParams): Promise<RewardInit> {
    // Create a new instance of LinkRewardTelegram with the provided 'params'
    const reward = new LinkRewardTelegram(params);

    // Get the database instance and assign it to the reward object
    reward.db = await Database.getInstance();

    // Check if the referent user exists for the reward
    if (!(await reward.getReferent())) {
      console.log(
        `[${reward.params.eventId}] ${reward.params.referentUserTelegramID} referent user is not a user to process the link reward.`,
      );
      return { shouldBeIssued: false, rewardInstance: reward };
    }

    // Retrieve the reward details from the database and assign them to the reward object
    reward.tx = await reward.getRewardFromDatabase();

    // Check if another reward already exists in the database
    if (await reward.getOtherRewardFromDatabase()) {
      return { shouldBeIssued: false, rewardInstance: reward };
    }

    // If the reward exists in the database
    if (reward.tx) {
      // Set isInDatabase property to true and extract status and userOpHash from tx object
      reward.isInDatabase = true;
      ({ status: reward.status, userOpHash: reward.userOpHash } = reward.tx);

      // Check if the transaction status is successful
      if (isSuccessfulTransaction(reward.status)) {
        return { shouldBeIssued: false, rewardInstance: reward };
      }
    } else {
      // If the reward doesn't exist, add it to the database with PENDING status and the current date
      await reward.updateInDatabase(TransactionStatus.PENDING, new Date());
    }

    // Return the fully initialized LinkRewardTelegram instance and indicate if it should be issued
    return { shouldBeIssued: true, rewardInstance: reward };
  }

  /**
   * Retrieves the referent user information from the database.
   * @returns {Promise<WithId<MongoUser>|null>} - The referent user information or null if not found.
   */
  async getReferent(): Promise<WithId<MongoUser> | null> {
    if (this.db)
      this.referent = (await this.db.collection(USERS_COLLECTION).findOne({
        userTelegramID: this.params.referentUserTelegramID,
      })) as WithId<MongoUser> | null;

    if (this.referent) {
      this.referent.patchwallet =
        this.referent?.patchwallet ??
        (await getPatchWalletAddressFromTgId(
          this.params.referentUserTelegramID || '',
        ));
    }
    return this.referent;
  }

  /**
   * Retrieves the reward information from the database.
   * @returns {Promise<WithId<MongoReward>>} - The reward information or null if not found.
   */
  async getRewardFromDatabase(): Promise<WithId<MongoReward> | null> {
    if (this.db)
      return (await this.db.collection(REWARDS_COLLECTION).findOne({
        eventId: this.params.eventId,
        userTelegramID: this.params.referentUserTelegramID,
        sponsoredUserTelegramID: this.params.userTelegramID,
        reason: this.params.reason,
      })) as WithId<MongoReward> | null;
    return null;
  }

  /**
   * Retrieves other reward information from the database for a different event.
   * @returns {Promise<object|null>} - The reward information or null if not found.
   */
  async getOtherRewardFromDatabase(): Promise<object | null> {
    if (this.db)
      return await this.db.collection(REWARDS_COLLECTION).findOne({
        sponsoredUserTelegramID: this.params.userTelegramID,
        reason: this.params.reason,
        eventId: { $ne: this.params.eventId },
      });
    return null;
  }

  /**
   * Updates the reward information in the database.
   * @param {TransactionStatus} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(status: TransactionStatus, date: Date | null) {
    await this.db?.collection(REWARDS_COLLECTION).updateOne(
      {
        eventId: this.params.eventId,
        reason: this.params.reason,
        userTelegramID: this.params.referentUserTelegramID,
      },
      {
        $set: {
          eventId: this.params.eventId,
          userTelegramID: this.params.referentUserTelegramID,
          responsePath: this.referent?.responsePath,
          userHandle: this.referent?.userHandle,
          userName: this.referent?.userName,
          reason: this.params.reason,
          walletAddress: this.referent?.patchwallet,
          amount: this.params.amount,
          message: this.params.message,
          ...(date ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
          status: status,
          sponsoredUserTelegramID: this.params.userTelegramID,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.params.eventId}] link for ${this.params.referentUserTelegramID} sponsoring ${this.params.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves transaction information to FlowXO.
   */
  async saveToFlowXO() {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_LINK_REWARD_WEBHOOK, {
      userTelegramID: this.params.referentUserTelegramID,
      responsePath: this.referent?.responsePath,
      walletAddress: this.referent?.patchwallet,
      reason: this.params.reason,
      userHandle: this.referent?.userHandle,
      userName: this.referent?.userName,
      amount: this.params.amount,
      message: this.params.message,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      sponsoredUserTelegramID: this.params.userTelegramID,
      apiKey: FLOWXO_WEBHOOK_API_KEY,
    });
  }

  /**
   * Sends a transaction action, triggering PatchWallet.
   * @returns Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> - Promise resolving to an AxiosResponse object with PatchRawResult data or AxiosError on failure.
   */
  async sendTransactionAction(): Promise<
    axios.AxiosResponse<PatchRawResult, AxiosError>
  > {
    return await sendTokens(
      SOURCE_TG_ID,
      this.referent?.patchwallet || '',
      this.params.amount || '',
      await getPatchWalletAccessToken(),
      this.params.delegatecall || 0,
      this.params.tokenAddress,
      this.params.chainId,
    );
  }
}
