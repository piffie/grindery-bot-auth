import axios, { AxiosError } from 'axios';
import { FLOWXO_WEBHOOK_API_KEY, SOURCE_TG_ID } from '../../secrets';
import {
  PatchRawResult,
  NewUserParams,
  createRewardParams,
} from '../types/webhook.types';
import {
  FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK,
  REWARDS_COLLECTION,
  RewardReason,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
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
import { Db, FindCursor, WithId } from 'mongodb';
import { Database } from '../db/conn';
import {
  MongoReward,
  MongoTransfer,
  MongoUser,
  TransactionStatus,
} from 'grindery-nexus-common-utils';

/**
 * Handles the processing of a referral reward based on specified parameters.
 * @param params - The parameters required for the referral reward.
 * @returns A promise resolving to a boolean value.
 *          - Returns `true` if the referral reward handling is completed or conditions are not met.
 *          - Returns `false` if an error occurs during the referral reward processing.
 */
export async function handleReferralReward(
  params: NewUserParams,
): Promise<boolean> {
  try {
    const reward = await ReferralRewardTelegram.build(
      createRewardParams(params, params.patchwallet || ''),
    );

    if (!(await reward.setParentTx())) return true;
    if (!(await reward.getReferent())) return true;

    await reward.getRewardSameFromDatabase();

    if (
      isSuccessfulTransaction(reward.status) ||
      (await reward.getRewardFromDatabaseWithOtherEventId())
    ) {
      console.log(
        `[${params.eventId}] referral reward already distributed or in process of distribution elsewhere for ${reward.referent?.userTelegramID} concerning new user ${params.userTelegramID}`,
      );
      return true;
    }

    await reward.updateReferentWallet();

    if (!reward.tx)
      await reward.updateInDatabase(TransactionStatus.PENDING, new Date());

    // eslint-disable-next-line prefer-const
    let { tx, outputPendingHash } = await processPendingHashStatus(reward);

    if (outputPendingHash !== undefined) return outputPendingHash;

    // Check for tx and send transaction if not present
    if (!tx && (tx = await sendTransaction(reward)).isError) return false;

    // Update transaction hash and perform additional actions
    if (tx.txHash) {
      updateTxHash(reward, tx.txHash);
      updateStatus(reward, TransactionStatus.SUCCESS);
      await Promise.all([
        reward.updateInDatabase(TransactionStatus.SUCCESS, new Date()),
        reward.saveToFlowXO(),
      ]).catch((error) =>
        console.error(
          `[${params.eventId}] Error processing FlowXO webhook during referral reward: ${error}`,
        ),
      );
      return true;
    }

    // Update userOpHash if present in tx
    if (tx.userOpHash) await handleUserOpHash(reward, tx.userOpHash);

    return false;
  } catch (error) {
    console.error(
      `[${params.eventId}] Error processing referral reward event: ${error}`,
    );
  }

  return true;
}

export const referral_utils = {
  handleReferralReward,
};

/**
 * Represents a referral reward specific to Telegram.
 */
export class ReferralRewardTelegram {
  /** The parameters required for the reward. */
  params: NewUserParams;

  /** Transaction details of the parent. */
  parentTx?: WithId<MongoTransfer>;

  /** Transaction details of the referent. */
  referent: WithId<MongoUser> | null;

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

  /** Cursor for transfers related to the reward. */
  transfers: FindCursor<WithId<MongoTransfer>> | null;

  /**
   * Creates an instance of ReferralRewardTelegram.
   * @param params - The parameters required for the reward.
   */
  constructor(params: NewUserParams) {
    // Assigns the incoming 'params' to the class property 'params'
    this.params = params;

    // Sets default values for specific parameters
    this.params.reason = RewardReason.REFERRAL;
    this.params.amount = '50';
    this.params.message = 'Referral reward';

    // Initializes the 'status' property to 'TransactionStatus.UNDEFINED' by default
    this.status = TransactionStatus.UNDEFINED;
  }

  /**
   * Asynchronously builds a ReferralRewardTelegram instance based on provided NewUserParams.
   * @param {NewUserParams} params - Parameters for the reward.
   * @returns {Promise<ReferralRewardTelegram>} - Promise resolving to a ReferralRewardTelegram instance.
   */
  static async build(params: NewUserParams): Promise<ReferralRewardTelegram> {
    // Create a new ReferralRewardTelegram instance with provided params
    const reward = new ReferralRewardTelegram(params);

    // Obtain the database instance and assign it to the reward object
    reward.db = await Database.getInstance();

    // Retrieve transfers associated with the reward from the database and assign them to the reward object
    reward.transfers = await reward.getTransfersFromDatabase();

    // Return the fully initialized ReferralRewardTelegram instance
    return reward;
  }

  /**
   * Retrieves transfers from the database based on certain conditions.
   * @returns {Promise<FindCursor<WithId<MongoTransfer>>>} - The retrieved transfers.
   */
  async getTransfersFromDatabase(): Promise<FindCursor<
    WithId<MongoTransfer>
  > | null> {
    if (this.db) {
      return this.db.collection(TRANSFERS_COLLECTION).find({
        senderTgId: { $ne: this.params.userTelegramID },
        recipientTgId: this.params.userTelegramID,
      }) as FindCursor<WithId<MongoTransfer>>;
    }
    return null;
  }

  /**
   * Sets the parent transaction based on certain conditions from the retrieved transfers.
   * @returns {Promise<boolean>} - True if the parent transaction is set successfully, false otherwise.
   */
  async setParentTx(): Promise<boolean> {
    if (this.transfers) {
      for await (const transfer of this.transfers) {
        if (!this.parentTx || transfer.dateAdded < this.parentTx.dateAdded) {
          this.parentTx = transfer;
        }
      }
    }

    if (!this.parentTx) {
      console.log(
        `[${this.params.eventId}] no referral reward to distribute with ${this.params.userTelegramID} as a new user.`,
      );
      return false;
    }

    return true;
  }

  /**
   * Retrieves information about the referent user from the database.
   * @returns {Promise<boolean>} - True if referent information is retrieved successfully, false otherwise.
   */
  async getReferent(): Promise<boolean> {
    try {
      if (this.db)
        this.referent = (await this.db.collection(USERS_COLLECTION).findOne({
          userTelegramID: this.parentTx?.senderTgId,
        })) as WithId<MongoUser> | null;
      if (!this.referent) {
        console.log(
          `[${this.params.eventId}] sender ${this.parentTx?.senderTgId} who is supposed to receive a referral reward is not a user.`,
        );
      }
      return Boolean(this.referent);
    } catch (error) {
      console.error(
        `[${this.params.eventId}] Error trying to get referent information: ${error}`,
      );
      return false;
    }
  }

  /**
   * Retrieves the referral reward from the database based on the event ID and reason.
   * @returns {Promise<boolean>} - True if the referral reward is retrieved successfully, false otherwise.
   */
  async getRewardSameFromDatabase(): Promise<boolean> {
    if (this.db)
      this.tx = (await this.db.collection(REWARDS_COLLECTION).findOne({
        eventId: this.params.eventId,
        reason: this.params.reason,
      })) as WithId<MongoReward> | null;

    if (this.tx) {
      this.userOpHash = this.tx.userOpHash;
      this.status = this.tx.status;
    }

    return Boolean(this.tx);
  }

  /**
   * Retrieves referral reward information from the database with a different event ID, user ID, and new user address.
   * @returns {Promise<boolean>} - True if the referral reward information is retrieved successfully, false otherwise.
   */
  async getRewardFromDatabaseWithOtherEventId(): Promise<boolean> {
    return Boolean(
      await this.db?.collection(REWARDS_COLLECTION).findOne({
        eventId: { $ne: this.params.eventId },
        reason: this.params.reason,
        userTelegramID: this.referent?.userTelegramID,
        newUserAddress: this.params.patchwallet,
      }),
    );
  }

  /**
   * Updates the PatchWallet address of the referent user for the referral reward.
   */
  async updateReferentWallet() {
    if (this.referent)
      this.referent.patchwallet =
        this.referent?.patchwallet ??
        (await getPatchWalletAddressFromTgId(this.referent?.userTelegramID));
  }

  /**
   * Updates the referral reward information in the database.
   * @param {TransactionStatus} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(status: TransactionStatus, date: Date | null) {
    await this.db?.collection(REWARDS_COLLECTION).updateOne(
      {
        eventId: this.params.eventId,
        reason: this.params.reason,
      },
      {
        $set: {
          eventId: this.params.eventId,
          userTelegramID: this.referent?.userTelegramID,
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
          newUserAddress: this.params.patchwallet,
          parentTransactionHash: this.parentTx?.transactionHash,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.params.eventId}] referral reward for ${this.referent?.patchwallet} sending tokens to ${this.params.patchwallet} in ${this.parentTx?.transactionHash} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves referral reward transaction information to FlowXO.
   */
  async saveToFlowXO() {
    await axios.post(FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK, {
      newUserTgId: this.params.userTelegramID,
      newUserResponsePath: this.params.responsePath,
      newUserUserHandle: this.params.userHandle,
      newUserUserName: this.params.userName,
      newUserPatchwallet: this.params.patchwallet,
      userTelegramID: this.referent?.userTelegramID,
      responsePath: this.referent?.responsePath,
      walletAddress: this.referent?.patchwallet,
      reason: this.params.reason,
      userHandle: this.referent?.userHandle,
      userName: this.referent?.userName,
      amount: this.params.amount,
      message: this.params.message,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      parentTransactionHash: this.parentTx?.transactionHash,
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
