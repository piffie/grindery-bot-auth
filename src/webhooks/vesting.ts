import axios, { AxiosError } from 'axios';
import { Database } from '../db/conn';
import { VestingParams, createVesting } from '../types/hedgey.types';
import { PatchRawResult } from '../types/webhook.types';
import {
  FLOWXO_NEW_VESTING_WEBHOOK,
  USERS_COLLECTION,
  VESTING_COLLECTION,
} from '../utils/constants';
import {
  handlePendingHash,
  isFailedTransaction,
  isSuccessfulTransaction,
  sendTransaction,
  updateStatus,
  updateTxHash,
  updateUserOpHash,
} from './utils';
import {
  getPatchWalletAccessToken,
  hedgeyLockTokens,
} from '../utils/patchwallet';
import { FLOWXO_WEBHOOK_API_KEY } from '../../secrets';
import { addVestingSegment } from '../utils/segment';
import { Db, WithId } from 'mongodb';
import {
  MongoUser,
  MongoVesting,
  TransactionStatus,
} from 'grindery-nexus-common-utils';

/**
 * Handles a new transaction based on the provided parameters.
 * @param params An object containing parameters necessary for handling the transaction.
 * @param params.senderTgId The Telegram ID of the sender initiating the transaction.
 * @param params.amount The amount related to the transaction.
 * @param params.recipientTgId The Telegram ID of the recipient.
 * @param params.eventId The ID of the event related to the transaction.
 * @param params.chainId Optional: The chain ID.
 * @param params.tokenAddress Optional: The token address related to the transaction.
 * @param params.message Optional: A message associated with the transaction.
 * @returns A Promise that resolves to a boolean indicating the success status of the transaction handling process.
 */
export async function handleNewVesting(
  params: VestingParams,
): Promise<boolean> {
  // Establish a connection to the database
  const db = await Database.getInstance();

  // Retrieve sender information from the "users" collection
  const senderInformation = (await db
    ?.collection(USERS_COLLECTION)
    .findOne({ userTelegramID: params.senderTgId })) as
    | WithId<MongoUser>
    | null
    | undefined;

  if (!senderInformation)
    return (
      console.error(
        `[${params.eventId}] Sender ${params.senderTgId} is not a user`,
      ),
      true
    );

  // Create a vesting object
  const vesting = await VestingTelegram.build(
    createVesting(params, senderInformation),
  );

  if (
    isSuccessfulTransaction(vesting.status) ||
    isFailedTransaction(vesting.status)
  )
    return true;

  // eslint-disable-next-line prefer-const
  let { tx, outputPendingHash } = await handlePendingHash(vesting);

  if (outputPendingHash !== undefined) return outputPendingHash;

  // Handle sending transaction if not already handled
  if (!tx) {
    tx = await sendTransaction(vesting);
    if (tx.isError) return true;
    if (!tx.txHash && !tx.userOpHash) return false;
  }

  // Finalize transaction handling
  if (tx && tx.txHash) {
    updateTxHash(vesting, tx.txHash);
    updateStatus(vesting, TransactionStatus.SUCCESS);
    await Promise.all([
      vesting.updateInDatabase(TransactionStatus.SUCCESS, new Date()),
      vesting.saveToSegment(),
      vesting.saveToFlowXO(),
    ]).catch((error) =>
      console.error(
        `[${params.eventId}] Error processing Segment or FlowXO webhook, or sending telegram message: ${error}`,
      ),
    );

    console.log(
      `[${vesting.txHash}] vesting from ${vesting.params.senderInformation?.userTelegramID} with event ID ${vesting.params.eventId} finished.`,
    );
    return true;
  }

  // Handle pending hash for userOpHash
  tx &&
    tx.userOpHash &&
    updateUserOpHash(vesting, tx.userOpHash) &&
    (await vesting.updateInDatabase(TransactionStatus.PENDING_HASH, null));

  return false;
}

/**
 * Represents a Telegram vesting.
 */
export class VestingTelegram {
  /** The parameters required for the transaction. */
  params: VestingParams;

  /** Indicates if the vesting is present in the database. */
  isInDatabase: boolean = false;

  /** Transaction details of the vesting. */
  tx: WithId<MongoVesting> | null;

  /** Current status of the vesting. */
  status: TransactionStatus;

  /** Transaction hash associated with the vesting. */
  txHash?: string;

  /** User operation hash. */
  userOpHash?: string;

  /** Database reference. */
  db: Db | null;

  /**
   * Constructor for VestingTelegram class.
   * @param {VestingParams} params - The parameters required for the vesting.
   */
  constructor(params: VestingParams) {
    // Assigns the incoming 'params' to the class property 'params'
    this.params = params;

    // Initializes the 'isInDatabase' property to 'false' by default
    this.isInDatabase = false;

    // Initializes the 'status' property to 'TransactionStatus.UNDEFINED' by default
    this.status = TransactionStatus.UNDEFINED;
  }

  /**
   * Asynchronously builds a VestingTelegram instance based on provided VestingParams.
   * @param {VestingParams} params - Parameters for the vesting.
   * @returns {Promise<VestingTelegram>} - Promise resolving to a VestingTelegram instance.
   */
  static async build(params: VestingParams): Promise<VestingTelegram> {
    // Create a new VestingTelegram instance with provided params
    const vesting = new VestingTelegram(params);

    // Obtain the database instance and assign it to the vesting object
    vesting.db = await Database.getInstance();

    // Retrieve the transfer details from the database and assign them to the vesting object
    vesting.tx = await vesting.getTransferFromDatabase();

    // Check if the vesting transfer exists in the database
    if (vesting.tx) {
      // If the transfer exists, update relevant vesting properties
      vesting.isInDatabase = true;
      ({ status: vesting.status, userOpHash: vesting.userOpHash } = vesting.tx);
    } else {
      // If the transfer doesn't exist, add it to the database with PENDING status and current date
      await vesting.updateInDatabase(TransactionStatus.PENDING, new Date());
    }

    // Return the fully initialized VestingTelegram instance
    return vesting;
  }

  /**
   * Retrieves the vesting information from the database.
   * @returns {Promise<WithId<MongoVesting>>} - The vesting information or null if not found.
   */
  async getTransferFromDatabase(): Promise<WithId<MongoVesting> | null> {
    if (this.db)
      return (await this.db.collection(VESTING_COLLECTION).findOne({
        eventId: this.params.eventId,
      })) as WithId<MongoVesting> | null;
    return null;
  }

  /**
   * Updates the vesting information in the database.
   * @param {TransactionStatus} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(
    status: TransactionStatus,
    date: Date | null,
  ): Promise<void> {
    await this.db?.collection(VESTING_COLLECTION).updateOne(
      { eventId: this.params.eventId },
      {
        $set: {
          eventId: this.params.eventId,
          chainId: this.params.chainId,
          tokenSymbol: this.params.tokenSymbol,
          tokenAddress: this.params.tokenAddress,
          senderTgId: this.params.senderInformation?.userTelegramID,
          senderWallet: this.params.senderInformation?.patchwallet,
          senderName: this.params.senderInformation?.userName,
          senderHandle: this.params.senderInformation?.userHandle,
          recipients: this.params.recipients,
          status: status,
          ...(date ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.params.eventId}] vesting from ${this.params.senderInformation?.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves transaction information to the Segment.
   * @returns {Promise<void>} - The result of adding the transaction to the Segment.
   */
  async saveToSegment(): Promise<void> {
    // Add transaction information to the Segment
    await addVestingSegment({
      ...this.params,
      transactionHash: this.txHash || '',
      dateAdded: new Date(),
    });
  }

  /**
   * Saves transaction information to FlowXO.
   * @returns {Promise<void>} - The result of sending the transaction to FlowXO.
   */
  async saveToFlowXO(): Promise<void> {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_VESTING_WEBHOOK, {
      senderResponsePath: this.params.senderInformation?.responsePath,
      chainId: this.params.chainId,
      tokenSymbol: this.params.tokenSymbol,
      tokenAddress: this.params.tokenAddress,
      senderTgId: this.params.senderInformation?.userTelegramID,
      senderWallet: this.params.senderInformation?.patchwallet,
      senderName: this.params.senderInformation?.userName,
      senderHandle: this.params.senderInformation?.userHandle,
      recipients: this.params.recipients,
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
    return await hedgeyLockTokens(
      this.params.senderInformation?.userTelegramID,
      this.params.recipients,
      await getPatchWalletAccessToken(),
    );
  }
}
