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
import { SOURCE_WALLET_ADDRESS } from '../../secrets';
import { Db, WithId } from 'mongodb';
import { MongoUser, TransactionStatus } from 'grindery-nexus-common-utils';
import { MongoGxQuote, MongoOrderG1, OrderUSDParams } from '../types/gx.types';
import { getTokenPrice } from '../utils/ankr';

export async function handleNewUSDOrder(
  params: OrderUSDParams,
): Promise<boolean> {
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

  if (!(parseFloat(quote.usdFromUsdInvestment) > 0)) return true;

  // Create a orderInstance object
  const { orderInstance, shouldProceed } = await OrderUSDTelegram.build({
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
    await orderInstance.updateInDatabase(TransactionStatus.SUCCESS, new Date()),
      console.log(
        `[${orderInstance.txHash}] order USD from ${orderInstance.params.userTelegramID} for ${orderInstance.params.quote?.equivalentUsdInvested} with event ID ${orderInstance.params.eventId} finished.`,
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
export class OrderUSDTelegram {
  /** The parameters required for the transaction. */
  params: OrderUSDParams;

  /** Indicates if the transfer is present in the database. */
  isInDatabase: boolean = false;

  /** Transaction details of the transfer. */
  tx: WithId<MongoOrderG1> | null;

  /** Current status of the transfer. */
  status: TransactionStatus;

  /** Transaction hash associated with the transfer. */
  txHash?: string;

  /** User operation hash. */
  userOpHash?: string;

  tokenAmount: string;

  /** Database reference. */
  db: Db | null;

  /**
   * Constructor for OrderUSDTelegram class.
   * @param params - The parameters required for the transfer.
   */
  constructor(params: OrderUSDParams) {
    // Assigns the incoming 'params' to the class property 'params'
    this.params = params;

    // Initializes the 'isInDatabase' property to 'false' by default
    this.isInDatabase = false;

    // Initializes the 'status' property to 'TransactionStatus.UNDEFINED' by default
    this.status = TransactionStatus.UNDEFINED;
  }

  /**
   * Asynchronously builds a TransactionInit instance based on provided OrderUSDParams.
   * @param {OrderUSDParams} params - Parameters for the transaction.
   * @returns {Promise<OrderInit>} - Promise resolving to a TransactionInit instance.
   */
  static async build(params: OrderUSDParams): Promise<OrderInit> {
    // Create a new SignUpRewardTelegram instance with provided params
    const order = new OrderUSDTelegram(params);

    // Calculate token price based on chainId and token address
    const token_price = await getTokenPrice(
      order.params.chainId,
      order.params.tokenAddress,
    );

    order.tokenAmount = (
      parseFloat(order.params.quote?.usdFromUsdInvestment || '0') /
      parseFloat(token_price.data.result.usdPrice)
    ).toFixed(2);

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
   * @returns {Promise<WithId<MongoOrderG1>>} - The transfer information or null if not found.
   */
  async getOrderFromDatabase(): Promise<WithId<MongoOrderG1> | null> {
    if (this.db)
      return (await this.db.collection(GX_ORDER_COLLECTION).findOne({
        eventId: this.params.eventId,
        userTelegramID: this.params.userTelegramID,
      })) as WithId<MongoOrderG1> | null;
    return null;
  }

  async isOtherOrderSuccess(): Promise<boolean> {
    if (this.db) {
      const order = (await this.db.collection(GX_ORDER_COLLECTION).findOne({
        userTelegramID: this.params.userTelegramID,
        eventId: { $ne: this.params.eventId },
        orderType: Ordertype.USD,
      })) as WithId<MongoOrderG1> | null;

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
          orderType: Ordertype.USD,
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
          chainId: this.params.chainId,
          tokenAddress: this.params.tokenAddress,
          tokenAmount: this.tokenAmount,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.params.eventId}] USD order from ${this.params.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  async sendTransactionAction(): Promise<
    axios.AxiosResponse<PatchRawResult, AxiosError>
  > {
    return await sendTokens(
      this.params.userTelegramID || '',
      SOURCE_WALLET_ADDRESS,
      this.tokenAmount,
      await getPatchWalletAccessToken(),
      0,
      this.params.tokenAddress,
      this.params.chainId,
    );
  }
}
