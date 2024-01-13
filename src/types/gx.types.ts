import {
  ChainId,
  TelegramUserId,
  TokenAddress,
  TransactionStatus,
} from 'grindery-nexus-common-utils';
import { WithId } from 'mongodb';
import { Ordertype } from '../utils/constants';

/**
 * Represents a GxQuote containing various fields related to Gx tokens and their values.
 */
export type GxQuote = {
  /** The value of m1 in the GxQuote. */
  m1: string;
  /** The value of m2 in the GxQuote. */
  m2: string;
  /** The value of m3 in the GxQuote. */
  m3: string;
  /** The value of m4 in the GxQuote. */
  m4: string;
  /** The value of m5 in the GxQuote. */
  m5: string;
  /** The value of m6 in the GxQuote. */
  m6: string;
  /** The final G1 to USD value in the GxQuote. */
  finalG1Usd: string;
  /** The amount of Gx obtained from USD in the GxQuote. */
  gxFromUsd: string;
  /** The amount of USD obtained from G1 in the GxQuote. */
  usdFromG1: string;
  /** The amount of Gx obtained from G1 in the GxQuote. */
  gxFromG1: string;
  /** The total amount of Gx received in the GxQuote. */
  gxReceived: string;
  /** The equivalent USD invested in the GxQuote. */
  equivalentUsdInvested: string;
  /** The exchange rate from Gx to USD in the GxQuote. */
  GxUsdExchangeRate: string;
};

/**
 * Represents a MongoDB GxQuote document with additional fields for database storage.
 */
export type MongoGxQuote = GxQuote & {
  /** Identifier for the GxQuote. */
  quoteId: string;
  /** Date of the GxQuote. */
  date: Date;
  /** Telegram User ID associated with the GxQuote. */
  userTelegramID: TelegramUserId;
  /** The amount of tokens. */
  tokenAmount: string;
  /** The chain ID. */
  chainId: ChainId;
  /** The token address. */
  tokenAddress: TokenAddress;
  tokenAmountG1ForCalculations: string;
  usdFromUsdInvestment: string;
  tokenAmountG1: string;
};

/**
 * Represents parameters for creating an OrderG1, including user and quote information.
 */
export type OrderParams = {
  /** Telegram User ID placing the order. */
  userTelegramID: string;
  /** Identifier for the associated GxQuote. */
  quoteId: string;
  /** Identifier for the event. */
  eventId: string;
  /** Optional GxQuote with MongoDB document structure. */
  quote?: WithId<MongoGxQuote>;
  /**
   * The type of order to be placed.
   * @remarks
   * - `Ordertype.G1` represents a G1 order type.
   * - `Ordertype.USD` represents a USD order type.
   */
  orderType: Ordertype;
};

/**
 * Represents a MongoDB document for an OrderG1 with additional fields for database storage.
 */
export type MongoOrder = MongoGxQuote & {
  /** Identifier for the event. */
  eventId: string;
  /** Transaction status of the order. */
  status: TransactionStatus;
  /** Date when the order was added. */
  dateAdded: Date;
  /** Hash of the transaction associated with the order. */
  transactionHash: string;
  /** Hash of the user operation associated with the order. */
  userOpHash: string;
  /** Type of the order (e.g., buy, sell). */
  orderType: Ordertype;
};
