import axios, { AxiosError } from 'axios';
import { Database } from '../db/conn';
import { OrderInit, PatchRawResult } from '../types/webhook.types';
import {
  GX_ORDER_COLLECTION,
  GX_QUOTE_COLLECTION,
  Ordertype,
  USERS_COLLECTION,
} from '../utils/constants';
import { getPatchWalletAccessToken, sendTokens } from '../utils/patchwallet';
import {
  processPendingHashStatus,
  isFailedTransaction,
  isSuccessfulTransaction,
  sendTransaction,
  updateStatus,
  updateTxHash,
  handleUserOpHash,
} from './utils';
import { PRODUCTION_ENV, SOURCE_WALLET_ADDRESS } from '../../secrets';
import { Db, WithId } from 'mongodb';
import { MongoUser, TransactionStatus } from 'grindery-nexus-common-utils';
import { MongoGxQuote, MongoOrder, OrderParams } from '../types/gx.types';
import { mockTransactionHash, mockUserOpHash } from '../test/utils';

export async function handleNewG1Order(params: OrderParams): Promise<boolean> {
  // Establish a connection to the database
  const db = await Database.getInstance();

  // Retrieve sender information from the "users" collection
  const senderInformation = (await db?.collection(USERS_COLLECTION).findOne({
    userTelegramID: params.userTelegramID,
  })) as WithId<MongoUser> | null;

  if (!senderInformation)
    return (
      console.error(
        `[${params.eventId}] Sender ${params.userTelegramID} is not a user`,
      ),
      true
    );

  // Retrieve sender information from the "users" collection
  const quote = (await db?.collection(GX_QUOTE_COLLECTION).findOne({
    userTelegramID: params.userTelegramID,
    quoteId: params.quoteId,
  })) as WithId<MongoGxQuote> | null;

  if (!quote)
    return (
      console.error(
        `[${params.eventId}] No quote for sender ${params.userTelegramID} with quote ID ${params.quoteId}`,
      ),
      true
    );

  // Create a orderInstance object
  const { orderInstance, shouldProceed } = await OrderG1Telegram.build({
    ...params,
    quote,
  });

  if (!shouldProceed) return true;

  if (
    isSuccessfulTransaction(orderInstance.status) ||
    isFailedTransaction(orderInstance.status)
  )
    return true;

  // eslint-disable-next-line prefer-const
  let { tx, outputPendingHash } = await processPendingHashStatus(orderInstance);

  if (outputPendingHash !== undefined) return outputPendingHash;

  // Handle sending transaction if not already handled
  if (!tx) {
    tx = await sendTransaction(orderInstance);
    if (tx.isError) return true;
    if (!tx.txHash && !tx.userOpHash) return false;
  }

  // Finalize transaction handling
  if (tx.txHash) {
    updateTxHash(orderInstance, tx.txHash);
    updateStatus(orderInstance, TransactionStatus.SUCCESS);
    await Promise.all([
      orderInstance.updateInDatabase(TransactionStatus.SUCCESS, new Date()),
    ]).catch((error) =>
      console.error(
        `[${params.eventId}] Error processing Segment or FlowXO webhook, or sending telegram message: ${error}`,
      ),
    );

    console.log(
      `[${orderInstance.txHash}] order G1 from ${orderInstance.params.userTelegramID} for ${orderInstance.params.quote?.tokenAmountG1} with event ID ${orderInstance.params.eventId} finished.`,
    );
    return true;
  }

  // Handle pending hash for userOpHash
  if (tx.userOpHash) await handleUserOpHash(orderInstance, tx.userOpHash);

  return false;
}

/**
 * Represents a Telegram transfer.
 */
export class OrderG1Telegram {
  /** The parameters required for the transaction. */
  params: OrderParams;

  /** Indicates if the transfer is present in the database. */
  isInDatabase: boolean = false;

  /** Transaction details of the transfer. */
  tx: WithId<MongoOrder> | null;

  /** Current status of the transfer. */
  status: TransactionStatus;

  /** Transaction hash associated with the transfer. */
  txHash?: string;

  /** User operation hash. */
  userOpHash?: string;

  /** Database reference. */
  db: Db | null;

  /**
   * Constructor for OrderG1Telegram class.
   * @param params - The parameters required for the transfer.
   */
  constructor(params: OrderParams) {
    // Assigns the incoming 'params' to the class property 'params'
    this.params = params;

    // Initializes the 'isInDatabase' property to 'false' by default
    this.isInDatabase = false;

    // Initializes the 'status' property to 'TransactionStatus.UNDEFINED' by default
    this.status = TransactionStatus.UNDEFINED;
  }

  /**
   * Asynchronously builds a TransactionInit instance based on provided OrderParams.
   * @param {OrderParams} params - Parameters for the transaction.
   * @returns {Promise<OrderInit>} - Promise resolving to a TransactionInit instance.
   */
  static async build(params: OrderParams): Promise<OrderInit> {
    // Create a new SignUpRewardTelegram instance with provided params
    const order = new OrderG1Telegram(params);

    // Obtain the database instance and assign it to the order object
    order.db = await Database.getInstance();

    // Retrieve the order details from the database and assign them to the order object
    order.tx = await order.getOrderFromDatabase();

    // Check if another order already exists in the database
    if (await order.isOtherOrderSuccess())
      return { orderInstance: order, shouldProceed: false };

    // Check if the order exists and the transaction is successful
    if (order.tx) {
      order.isInDatabase = true;
      ({ status: order.status, userOpHash: order.userOpHash } = order.tx);
      if (isSuccessfulTransaction(order.status))
        return { orderInstance: order, shouldProceed: false };
    } else {
      // If the order doesn't exist, add it to the database with PENDING status and current date
      await order.updateInDatabase(TransactionStatus.PENDING, new Date());
    }

    // Return the fully initialized SignUpRewardTelegram instance and indicate the existence of the order
    return { orderInstance: order, shouldProceed: true };
  }

  /**
   * Retrieves the transfer information from the database.
   * @returns {Promise<WithId<MongoOrder>>} - The transfer information or null if not found.
   */
  async getOrderFromDatabase(): Promise<WithId<MongoOrder> | null> {
    if (this.db)
      return (await this.db.collection(GX_ORDER_COLLECTION).findOne({
        eventId: this.params.eventId,
      })) as WithId<MongoOrder> | null;
    return null;
  }

  async isOtherOrderSuccess(): Promise<boolean> {
    if (this.db) {
      const order = (await this.db.collection(GX_ORDER_COLLECTION).findOne({
        userTelegramID: this.params.userTelegramID,
        eventId: { $ne: this.params.eventId },
        orderType: Ordertype.G1,
      })) as WithId<MongoOrder> | null;

      if (order && order.status === TransactionStatus.SUCCESS) return true;
    }
    return false;
  }

  async updateInDatabase(
    status: TransactionStatus,
    date: Date | null,
  ): Promise<void> {
    await this.db?.collection(GX_ORDER_COLLECTION).updateOne(
      { eventId: this.params.eventId },
      {
        $set: {
          quoteId: this.params.quote?.quoteId,
          orderType: Ordertype.G1,
          tokenAmountG1: this.params.quote?.tokenAmountG1,
          usdFromUsdInvestment: this.params.quote?.usdFromUsdInvestment,
          usdFromG1Investment: this.params.quote?.usdFromG1Investment,
          usdFromMvu: this.params.quote?.usdFromMvu,
          usdFromTime: this.params.quote?.usdFromTime,
          equivalentUsdInvested: this.params.quote?.equivalentUsdInvested,
          gxBeforeMvu: this.params.quote?.gxBeforeMvu,
          gxMvuEffect: this.params.quote?.gxMvuEffect,
          gxTimeEffect: this.params.quote?.gxTimeEffect,
          GxUsdExchangeRate: this.params.quote?.GxUsdExchangeRate,
          standardGxUsdExchangeRate:
            this.params.quote?.standardGxUsdExchangeRate,
          discountReceived: this.params.quote?.discountReceived,
          gxReceived: this.params.quote?.gxReceived,
          eventId: this.params.eventId,
          status: status,
          ...(date ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
          userTelegramID: this.params.userTelegramID,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.params.eventId}] G1 order from ${this.params.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  async sendTransactionAction(): Promise<
    axios.AxiosResponse<PatchRawResult, AxiosError>
  > {
    if (PRODUCTION_ENV) {
      return {
        data: { userOpHash: mockUserOpHash, txHash: mockTransactionHash },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    }

    return await sendTokens(
      this.params.userTelegramID || '',
      SOURCE_WALLET_ADDRESS,
      this.params.quote?.tokenAmountG1 || '',
      await getPatchWalletAccessToken(),
      0,
    );
  }
}
