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
  m1: string;
  m2: string;
  m3: string;
  m4: string;
  m5: string;
  m6: string;
  finalG1Usd: string;
  gxFromUsd: string;
  usdFromG1: string;
  gxFromG1: string;
  gxReceived: string;
  equivalentUsdInvested: string;
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
