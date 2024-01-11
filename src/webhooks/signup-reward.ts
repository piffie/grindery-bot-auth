import axios, { AxiosError } from 'axios';
import { FLOWXO_WEBHOOK_API_KEY, SOURCE_TG_ID } from '../../secrets';
import {
  PatchRawResult,
  RewardInit,
  RewardParams,
  createRewardParams,
} from '../types/webhook.types';
import {
  FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK,
  REWARDS_COLLECTION,
} from '../utils/constants';
import { getPatchWalletAccessToken, sendTokens } from '../utils/patchwallet';
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
import { MongoReward, TransactionStatus } from 'grindery-nexus-common-utils';

/**
 * Handles the processing of a sign-up reward based on specified parameters.
 * @param params - The parameters required for the sign-up reward.
 * @returns A promise resolving to a boolean value.
 *          - Returns `true` if the sign-up reward handling is completed or conditions are not met.
 *          - Returns `false` if an error occurs during the sign-up reward processing.
 */
export async function handleSignUpReward(
  params: RewardParams,
): Promise<boolean> {
  try {
    // Create a raw sign-up rewardInstance object
    const { shouldBeIssued, rewardInstance } = await SignUpRewardTelegram.build(
      createRewardParams(params, params.patchwallet || ''),
    );

    // If rewardInstance already exists, return true
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
    if (tx.txHash) {
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
    // Handle error
    console.error(
      `[${params.eventId}] Error processing sign up rewardInstance event: ${error}`,
    );
  }

  return true;
}

export const signup_utils = {
  handleSignUpReward,
};

/**
 * Represents a sign-up reward specific to Telegram.
 */
export class SignUpRewardTelegram {
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

  /** Database reference. */
  db: Db | null;

  /**
   * Creates an instance of SignUpRewardTelegram.
   * @param params - The parameters required for the reward.
   */
  constructor(params: RewardParams) {
    // Assigns the incoming 'params' to the class property 'params'
    this.params = params;

    // Sets default values for specific parameters
    this.params.reason = 'user_sign_up';
    this.params.amount = '100';
    this.params.message = 'Sign up reward';

    // Initializes the 'isInDatabase' property to 'false' by default
    this.isInDatabase = false;

    // Initializes the 'status' property to 'TransactionStatus.UNDEFINED' by default
    this.status = TransactionStatus.UNDEFINED;
  }

  /**
   * Asynchronously initializes a SignUpRewardTelegram instance based on provided RewardParams.
   * @param {RewardParams} params - Parameters for the reward.
   * @returns {Promise<SignUpRewardInit>} - Promise resolving to a SignUpRewardInit instance.
   */
  static async build(params: RewardParams): Promise<RewardInit> {
    // Create a new SignUpRewardTelegram instance with provided params
    const reward = new SignUpRewardTelegram(params);

    // Obtain the database instance and assign it to the reward object
    reward.db = await Database.getInstance();

    // Retrieve the reward details from the database and assign them to the reward object
    reward.tx = await reward.getRewardFromDatabase();

    // Check if another reward already exists in the database
    if (await reward.getOtherRewardFromDatabase())
      return { rewardInstance: reward, shouldBeIssued: false };

    // Check if the reward exists and the transaction is successful
    if (reward.tx) {
      reward.isInDatabase = true;
      ({ status: reward.status, userOpHash: reward.userOpHash } = reward.tx);
      if (isSuccessfulTransaction(reward.status))
        return { rewardInstance: reward, shouldBeIssued: false };
    } else {
      // If the reward doesn't exist, add it to the database with PENDING status and current date
      await reward.updateInDatabase(TransactionStatus.PENDING, new Date());
    }

    // Return the fully initialized SignUpRewardTelegram instance and indicate the existence of the reward
    return { rewardInstance: reward, shouldBeIssued: true };
  }

  /**
   * Retrieves the status of the PatchWallet transaction.
   * @returns {Promise<MongoReward>} - True if the transaction status is retrieved successfully, false otherwise.
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
   * @returns {Promise<WithId<MongoReward>|null>} - The reward information or null if not found.
   */
  async getOtherRewardFromDatabase(): Promise<WithId<MongoReward> | null> {
    if (this.db)
      return (await this.db.collection(REWARDS_COLLECTION).findOne({
        userTelegramID: this.params.userTelegramID,
        eventId: { $ne: this.params.eventId },
        reason: this.params.reason,
      })) as WithId<MongoReward> | null;
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
    await axios.post(FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK, {
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
      this.params.tokenAddress,
      this.params.chainId,
    );
  }
}
