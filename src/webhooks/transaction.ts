import axios, { AxiosError } from 'axios';
import { Database } from '../db/conn';
import {
  PatchRawResult,
  PatchResult,
  TransactionInit,
  TransactionParams,
  TransactionStatus,
  createTransaction,
} from '../types/webhook.types';
import {
  TRANSACTION_STATUS,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
} from '../utils/constants';
import {
  getPatchWalletAccessToken,
  getPatchWalletAddressFromTgId,
  sendTokens,
} from '../utils/patchwallet';
import { sendTelegramMessage } from '../utils/telegram';
import {
  getStatus,
  isFailedTransaction,
  isPendingTransactionHash,
  isSuccessfulTransaction,
  isTreatmentDurationExceeded,
  sendTransaction,
  updateTxHash,
  updateUserOpHash,
} from './utils';
import {
  FLOWXO_NEW_TRANSACTION_WEBHOOK,
  FLOWXO_WEBHOOK_API_KEY,
} from '../../secrets';
import { addTrackSegment } from '../utils/segment';
import { Db, Document, WithId } from 'mongodb';

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
export async function handleNewTransaction(
  params: TransactionParams,
): Promise<boolean> {
  // Establish a connection to the database
  const db = await Database.getInstance();

  // Retrieve sender information from the "users" collection
  const senderInformation = await db
    ?.collection(USERS_COLLECTION)
    .findOne({ userTelegramID: params.senderTgId });
  if (!senderInformation)
    return (
      console.error(
        `[${params.eventId}] Sender ${params.senderTgId} is not a user`,
      ),
      true
    );

  // Create a transfer object
  const transferRaw = await TransferTelegram.build(
    createTransaction(params, senderInformation),
  );

  if (transferRaw.isError) return false;

  const transfer = transferRaw.transactionInstance;

  if (
    isSuccessfulTransaction(transfer.status) ||
    isFailedTransaction(transfer.status)
  )
    return true;

  let tx: PatchResult | undefined;

  // Handle pending hash status
  if (isPendingTransactionHash(transfer.status)) {
    if (await isTreatmentDurationExceeded(transfer)) return true;

    // Check userOpHash and updateInDatabase for success
    if (!transfer.userOpHash)
      return (
        await transfer.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date()),
        true
      );

    // Check status for userOpHash and return the status if it's retrieved successfully or false if failed
    tx = await getStatus(transfer);
    if (tx.isError) return true;
    if (!tx.txHash && !tx.userOpHash) return false;
  }

  // Handle sending transaction if not already handled
  if (!tx) {
    tx = await sendTransaction(transfer);
    if (tx.isError) return true;
    if (!tx.txHash && !tx.userOpHash) return false;
  }

  // Finalize transaction handling
  if (tx && tx.txHash) {
    updateTxHash(transfer, tx.txHash);
    await Promise.all([
      transfer.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date()),
      transfer.saveToSegment(),
      transfer.saveToFlowXO(),
      params.message &&
        senderInformation.telegramSession &&
        sendTelegramMessage(
          params.message,
          params.recipientTgId,
          senderInformation,
        ).then(
          (result) =>
            result.success ||
            console.error('Error sending telegram message:', result.message),
        ),
    ]).catch((error) =>
      console.error(
        `[${params.eventId}] Error processing Segment or FlowXO webhook, or sending telegram message: ${error}`,
      ),
    );

    console.log(
      `[${transfer.txHash}] transaction from ${transfer.params.senderInformation?.userTelegramID} to ${transfer.params.recipientTgId} for ${transfer.params.amount} with event ID ${transfer.params.eventId} finished.`,
    );
    return true;
  }

  // Handle pending hash for userOpHash
  tx &&
    tx.userOpHash &&
    updateUserOpHash(transfer, tx.userOpHash) &&
    (await transfer.updateInDatabase(TRANSACTION_STATUS.PENDING_HASH, null));

  return false;
}

/**
 * Represents a Telegram transfer.
 */
export class TransferTelegram {
  /** The parameters required for the transaction. */
  params: TransactionParams;

  /** Indicates if the transfer is present in the database. */
  isInDatabase: boolean = false;

  /** Transaction details of the transfer. */
  tx: WithId<Document> | null;

  /** Current status of the transfer. */
  status: TransactionStatus;

  /** Wallet address of the recipient. */
  recipientWallet?: string;

  /** Transaction hash associated with the transfer. */
  txHash?: string;

  /** User operation hash. */
  userOpHash?: string;

  /** Database reference. */
  db: Db | null;

  /**
   * Constructor for TransferTelegram class.
   * @param params - The parameters required for the transfer.
   */
  constructor(params: TransactionParams) {
    // Assigns the incoming 'params' to the class property 'params'
    this.params = params;

    // Initializes the 'isInDatabase' property to 'false' by default
    this.isInDatabase = false;

    // Initializes the 'status' property to 'TRANSACTION_STATUS.UNDEFINED' by default
    this.status = TRANSACTION_STATUS.UNDEFINED;
  }

  /**
   * Asynchronously builds a TransactionInit instance based on provided TransactionParams.
   * @param {TransactionParams} params - Parameters for the transaction.
   * @returns {Promise<TransactionInit>} - Promise resolving to a TransactionInit instance.
   */
  static async build(params: TransactionParams): Promise<TransactionInit> {
    // Create a new TransferTelegram instance with provided params
    const transfer = new TransferTelegram(params);

    // Obtain the database instance and assign it to the transfer object
    transfer.db = await Database.getInstance();

    // Retrieve the transfer details from the database and assign them to the transfer object
    transfer.tx = await transfer.getTransferFromDatabase();

    try {
      // Attempt to fetch the recipient wallet address using the Telegram ID
      transfer.recipientWallet = await getPatchWalletAddressFromTgId(
        transfer.params.recipientTgId,
      );
    } catch (error) {
      // If an error occurs during recipient wallet fetching, return an error with the transfer instance
      return { isError: true, transactionInstance: transfer };
    }

    // Check if the transfer exists in the database
    if (transfer.tx) {
      // If the transfer exists, update relevant transfer properties
      transfer.isInDatabase = true;
      ({ status: transfer.status, userOpHash: transfer.userOpHash } =
        transfer.tx);
    } else {
      // If the transfer doesn't exist, add it to the database with PENDING status and current date
      await transfer.updateInDatabase(TRANSACTION_STATUS.PENDING, new Date());
    }

    // Return a success indicator with the transfer instance
    return { isError: false, transactionInstance: transfer };
  }

  /**
   * Retrieves the transfer information from the database.
   * @returns {Promise<WithId<Document>>} - The transfer information or null if not found.
   */
  async getTransferFromDatabase(): Promise<WithId<Document> | null> {
    if (this.db)
      return await this.db
        .collection(TRANSFERS_COLLECTION)
        .findOne({ eventId: this.params.eventId });
    return null;
  }

  /**
   * Updates the transfer information in the database.
   * @param {TransactionStatus} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(
    status: TransactionStatus,
    date: Date | null,
  ): Promise<void> {
    await this.db?.collection(TRANSFERS_COLLECTION).updateOne(
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
          recipientTgId: this.params.recipientTgId,
          recipientWallet: this.recipientWallet,
          tokenAmount: this.params.amount,
          status: status,
          ...(date ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.params.eventId}] transaction from ${this.params.senderInformation?.userTelegramID} to ${this.params.recipientTgId} for ${this.params.amount} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves transaction information to the Segment.
   * @returns {Promise<void>} - The result of adding the transaction to the Segment.
   */
  async saveToSegment(): Promise<void> {
    // Add transaction information to the Segment
    await addTrackSegment({
      ...this.params,
      dateAdded: new Date(),
      transactionHash: this.txHash || '',
      recipientWallet: this.recipientWallet || '',
    });
  }

  /**
   * Saves transaction information to FlowXO.
   * @returns {Promise<void>} - The result of sending the transaction to FlowXO.
   */
  async saveToFlowXO(): Promise<void> {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_TRANSACTION_WEBHOOK, {
      senderResponsePath: this.params.senderInformation?.responsePath,
      chainId: this.params.chainId,
      tokenSymbol: this.params.tokenSymbol,
      tokenAddress: this.params.tokenAddress,
      senderTgId: this.params.senderInformation?.userTelegramID,
      senderWallet: this.params.senderInformation?.patchwallet,
      senderName: this.params.senderInformation?.userName,
      senderHandle: this.params.senderInformation?.userHandle,
      recipientTgId: this.params.recipientTgId,
      recipientWallet: this.recipientWallet,
      tokenAmount: this.params.amount,
      transactionHash: this.txHash,
      dateAdded: new Date(),
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
      this.params.senderInformation?.userTelegramID,
      this.recipientWallet || '',
      this.params.amount,
      await getPatchWalletAccessToken(),
      this.params.delegatecall || 0,
      this.params.tokenAddress,
      this.params.chainId,
    );
  }
}
