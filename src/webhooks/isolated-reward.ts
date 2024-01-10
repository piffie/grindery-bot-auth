import axios, { AxiosError } from 'axios';
import { FLOWXO_WEBHOOK_API_KEY, SOURCE_TG_ID } from '../../secrets';
import {
  PatchRawResult,
  RewardInit,
  RewardParams,
  createRewardParams,
} from '../types/webhook.types';
import {
  FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK,
  REWARDS_COLLECTION,
} from '../utils/constants';
import {
  getPatchWalletAccessToken,
  getPatchWalletAddressFromTgId,
  sendTokens,
} from '../utils/patchwallet';
import {
  processPendingHashStatus,
  isSuccessfulTransaction,
  sendTransaction,
  updateStatus,
  updateTxHash,
  handleUserOpHash,
} from './utils';
import { Db, WithId } from 'mongodb';
import { Database } from '../db/conn';
import { MongoReward } from 'grindery-nexus-common-utils';
import { TransactionStatus } from 'grindery-nexus-common-utils';

/**
 * Handles the processing of an isolated rewardInstance based on specified parameters.
 * @param params - The parameters required for the rewardInstance.
 * @returns A promise resolving to a boolean value.
 *          - Returns `true` if the rewardInstance handling is completed or conditions are not met.
 *          - Returns `false` if an error occurs during the rewardInstance processing.
 */
export async function handleIsolatedReward(
  params: RewardParams,
): Promise<boolean> {
  try {
    if (
      !params.userTelegramID ||
      !params.eventId ||
      !params.amount ||
      !params.reason
    ) {
      return true;
    }

    const { shouldBeIssued, rewardInstance } =
      await IsolatedRewardTelegram.build(
        createRewardParams(params, params.patchwallet || ''),
      );

    if (!shouldBeIssued) return true;

    // eslint-disable-next-line prefer-const
    let { tx, outputPendingHash } = await processPendingHashStatus(
      rewardInstance,
    );

    if (outputPendingHash !== undefined) return outputPendingHash;

    // Check for tx and send transaction if not present
    if (!tx && (tx = await sendTransaction(rewardInstance)).isError)
      return false;

    // Update transaction hash and perform additional actions
    if (tx && tx.txHash) {
      updateTxHash(rewardInstance, tx.txHash);
      updateStatus(rewardInstance, TransactionStatus.SUCCESS);
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

    // Update userOpHash if present in tx
    if (tx.userOpHash) await handleUserOpHash(rewardInstance, tx.userOpHash);

    return false;
  } catch (error) {
    console.error(
      `[${params.eventId}] Error processing ${params.reason} rewardInstance event: ${error}`,
    );
  }

  return true;
}

/**
 * Represents an Isolated Reward specific to Telegram.
 */
export class IsolatedRewardTelegram {
  /** The parameters required for the reward. */
  params: RewardParams;

  /** Indicates if the reward is present in the database. */
  isInDatabase: boolean = false;

  /** Transaction details. */
  tx: WithId<MongoReward> | null;

  /** Current status of the reward. */
  status: TransactionStatus;

  /** Transaction hash associated with the reward. */
  txHash?: string;

  /** Database reference. */
  db: Db | null;

  /** User operation hash. */
  userOpHash?: string;

  /** Address of the token used for the reward. */
  tokenAddress: string;

  /** Id of the blockchain network. */
  chainId: string;

  /**
   * Creates an instance of IsolatedRewardTelegram.
   * @param params - The parameters required for the reward.
   */
  constructor(params: RewardParams) {
    // Assigns the incoming 'params' to the class property 'params'
    this.params = params;

    // Initializes the 'isInDatabase' property to 'false' by default
    this.isInDatabase = false;

    // Initializes the 'status' property to 'TransactionStatus.UNDEFINED' by default
    this.status = TransactionStatus.UNDEFINED;
  }

  /**
   * Asynchronously creates and initializes a reward instance of IsolatedRewardTelegram.
   * @param {RewardParams} params - The parameters required for the reward.
   * @returns {Promise<RewardInit>} - Promise resolving to a RewardInit instance.
   */
  static async build(params: RewardParams): Promise<RewardInit> {
    // Create a new instance of IsolatedRewardTelegram with the provided 'params'
    const reward = new IsolatedRewardTelegram(params);

    // Obtain the database instance and assign it to the reward object
    reward.db = await Database.getInstance();

    // Check and set the patchwallet parameter if it doesn't exist in the provided params
    reward.params.patchwallet =
      reward.params.patchwallet ??
      (await getPatchWalletAddressFromTgId(reward.params.userTelegramID));

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

    // Return the fully initialized IsolatedRewardTelegram instance and indicate if it should be issued
    return { shouldBeIssued: true, rewardInstance: reward };
  }

  /**
   * Retrieves the status of the PatchWallet transaction.
   * @returns {Promise<WithId<MongoReward>>} - True if the transaction status is retrieved successfully, false otherwise.
   */
  async getRewardFromDatabase(): Promise<WithId<MongoReward> | null> {
    if (this.db)
      return (await this.db.collection(REWARDS_COLLECTION).findOne({
        userTelegramID: this.params.userTelegramID,
        eventId: this.params.eventId,
        reason: this.params.reason,
      })) as WithId<MongoReward> | null;
    return null;
  }

  /**
   * Retrieves other reward information from the database for the same user but different event.
   * @returns {Promise<object|null>} - The reward information or null if not found.
   */
  async getOtherRewardFromDatabase(): Promise<object | null> {
    if (this.db)
      return await this.db.collection(REWARDS_COLLECTION).findOne({
        userTelegramID: this.params.userTelegramID,
        eventId: { $ne: this.params.eventId },
        reason: this.params.reason,
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
        userTelegramID: this.params.userTelegramID,
      },
      {
        $set: {
          eventId: this.params.eventId,
          userTelegramID: this.params.userTelegramID,
          responsePath: this.params.responsePath,
          userHandle: this.params.userHandle,
          userName: this.params.userName,
          reason: this.params.reason,
          walletAddress: this.params.patchwallet,
          amount: this.params.amount,
          message: this.params.message,
          ...(date ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
          status: status,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.params.eventId}] sign up reward for ${this.params.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves transaction information to FlowXO.
   * @returns {Promise<void>} - The result of sending the transaction to FlowXO.
   */
  async saveToFlowXO(): Promise<void> {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK, {
      userTelegramID: this.params.userTelegramID,
      responsePath: this.params.responsePath,
      walletAddress: this.params.patchwallet,
      reason: this.params.reason,
      userHandle: this.params.userHandle,
      userName: this.params.userName,
      amount: this.params.amount,
      message: this.params.message,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      apiKey: FLOWXO_WEBHOOK_API_KEY,
      status: this.status,
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
      this.params.patchwallet || '',
      this.params.amount || '',
      await getPatchWalletAccessToken(),
      this.params.delegatecall || 0,
      this.tokenAddress,
      this.chainId,
    );
  }
}
