import axios, { AxiosError } from 'axios';
import { Database } from '../db/conn';
import { OrderInit, PatchRawResult } from '../types/webhook.types';
import {
  GX_ORDER_COLLECTION,
  GX_QUOTE_COLLECTION,
  Ordertype,
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
import { SOURCE_WALLET_ADDRESS, ZAPIER_NEW_ORDER_WEBHOOK } from '../../secrets';
import { Db, FindCursor, WithId } from 'mongodb';
import { TransactionStatus } from 'grindery-nexus-common-utils';
import { MongoGxQuote, MongoOrder, OrderParams } from '../types/gx.types';
import { UserTelegram } from '../utils/user';

export async function handleNewOrder(params: OrderParams): Promise<boolean> {
  // Establish a connection to the database
  const db = await Database.getInstance();

  // Generate a Telegram user instance for the sender
  const sender = await UserTelegram.build(params.userTelegramID);

  if (!sender.isInDatabase)
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

  if (
    params.orderType === Ordertype.USD &&
    !(parseFloat(quote.usdFromUsdInvestment) > 0)
  )
    return true;

  // Create a orderInstance object
  const { orderInstance, shouldProceed } = await OrderTelegram.build({
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
      await orderInstance.updateInDatabase(
        TransactionStatus.SUCCESS,
        new Date(),
      ),
      await orderInstance.sendToWebhook(),
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
export class OrderTelegram {
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
   * Constructor for OrderTelegram class.
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
    const order = new OrderTelegram(params);

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

  /**
   * Checks if there is another order for the user with a successful status.
   * @returns A Promise that resolves to `true` if there is a successful order, and `false` otherwise.
   */
  async isOtherOrderSuccess(): Promise<boolean> {
    if (this.db) {
      const cursor = this.db.collection(GX_ORDER_COLLECTION).find({
        $or: [
          {
            userTelegramID: this.params.userTelegramID,
            eventId: { $ne: this.params.eventId },
            orderType: this.params.orderType,
          },
          {
            userTelegramID: this.params.userTelegramID,
            quoteId: { $ne: this.params.quoteId },
            orderType:
              this.params.orderType === Ordertype.G1
                ? Ordertype.USD
                : Ordertype.G1,
          },
        ],
      }) as FindCursor<WithId<MongoOrder>>;

      let order: WithId<MongoOrder> | null = null;

      while (await cursor.hasNext()) {
        order = await cursor.next();
        if (order && order.status === TransactionStatus.SUCCESS) {
          return true;
        }
      }
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
          m1: this.params.quote?.m1,
          m2: this.params.quote?.m2,
          m3: this.params.quote?.m3,
          m4: this.params.quote?.m4,
          m5: this.params.quote?.m5,
          m6: this.params.quote?.m6,
          finalG1Usd: this.params.quote?.finalG1Usd,
          gxFromUsd: this.params.quote?.gxFromUsd,
          usdFromG1: this.params.quote?.usdFromG1,
          gxFromG1: this.params.quote?.gxFromG1,
          tokenAmountG1ForCalculations:
            this.params.quote?.tokenAmountG1ForCalculations,
          quoteId: this.params.quote?.quoteId,
          orderType: this.params.orderType,
          tokenAmountG1: this.params.quote?.tokenAmountG1,
          usdFromUsdInvestment: this.params.quote?.usdFromUsdInvestment,
          equivalentUsdInvested: this.params.quote?.equivalentUsdInvested,
          GxUsdExchangeRate: this.params.quote?.GxUsdExchangeRate,
          gxReceived: this.params.quote?.gxReceived,
          eventId: this.params.eventId,
          status: status,
          ...(date ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
          userTelegramID: this.params.userTelegramID,
          tokenAmount: this.params.quote?.tokenAmount,
          chainId: this.params.quote?.chainId,
          tokenAddress: this.params.quote?.tokenAddress,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.params.eventId}] ${this.params.orderType} order from ${this.params.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  async sendToWebhook(): Promise<void> {
    // Send transaction information to Webhook
    await axios.post(ZAPIER_NEW_ORDER_WEBHOOK, {
      m1: this.params.quote?.m1,
      m2: this.params.quote?.m2,
      m3: this.params.quote?.m3,
      m4: this.params.quote?.m4,
      m5: this.params.quote?.m5,
      m6: this.params.quote?.m6,
      finalG1Usd: this.params.quote?.finalG1Usd,
      gxFromUsd: this.params.quote?.gxFromUsd,
      usdFromG1: this.params.quote?.usdFromG1,
      gxFromG1: this.params.quote?.gxFromG1,
      tokenAmountG1ForCalculations:
        this.params.quote?.tokenAmountG1ForCalculations,
      quoteId: this.params.quote?.quoteId,
      orderType: this.params.orderType,
      tokenAmountG1: this.params.quote?.tokenAmountG1,
      usdFromUsdInvestment: this.params.quote?.usdFromUsdInvestment,
      equivalentUsdInvested: this.params.quote?.equivalentUsdInvested,
      GxUsdExchangeRate: this.params.quote?.GxUsdExchangeRate,
      gxReceived: this.params.quote?.gxReceived,
      eventId: this.params.eventId,
      status: this.status,
      dateAdded: new Date(),
      transactionHash: this.txHash,
      userOpHash: this.userOpHash,
      userTelegramID: this.params.userTelegramID,
      tokenAmount: this.params.quote?.tokenAmount,
      chainId: this.params.quote?.chainId,
      tokenAddress: this.params.quote?.tokenAddress,
    });
  }

  async sendTransactionAction(): Promise<
    axios.AxiosResponse<PatchRawResult, AxiosError>
  > {
    if (this.params.orderType === Ordertype.G1)
      return await sendTokens(
        this.params.userTelegramID || '',
        SOURCE_WALLET_ADDRESS,
        this.params.quote?.tokenAmountG1 || '',
        await getPatchWalletAccessToken(),
        0,
      );

    return await sendTokens(
      this.params.userTelegramID || '',
      SOURCE_WALLET_ADDRESS,
      this.params.quote?.tokenAmount || '',
      await getPatchWalletAccessToken(),
      0,
      this.params.quote?.tokenAddress,
      this.params.quote?.chainId,
    );
  }
}
