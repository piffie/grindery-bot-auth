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
  /** The amount of Gx tokens. */
  tokenAmountG1: string;
  /** USD value obtained from USD investment. */
  usdFromUsdInvestment: string;
  /** USD value obtained from G1 investment. */
  usdFromG1Investment: string;
  /** USD value obtained from MVU. */
  usdFromMvu: string;
  /** USD value obtained from time. */
  usdFromTime: string;
  /** Equivalent USD invested. */
  equivalentUsdInvested: string;
  /** Gx value before MVU. */
  gxBeforeMvu: string;
  /** Gx value affected by MVU. */
  gxMvuEffect: string;
  /** Gx value affected by time. */
  gxTimeEffect: string;
  /** Gx to USD exchange rate. */
  GxUsdExchangeRate: string;
  /** Standard Gx to USD exchange rate. */
  standardGxUsdExchangeRate: string;
  /** Discount received. */
  discountReceived: string;
  /** Gx tokens received. */
  gxReceived: string;
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
};

/**
 * Represents parameters for creating an OrderG1, including user and quote information.
 */
export type OrderG1Params = {
  /** Telegram User ID placing the order. */
  userTelegramID: string;
  /** Identifier for the associated GxQuote. */
  quoteId: string;
  /** Identifier for the event. */
  eventId: string;
  /** Optional GxQuote with MongoDB document structure. */
  quote?: WithId<MongoGxQuote>;
};

/**
 * Represents parameters for creating an OrderUSD, including user and quote information.
 */
export type OrderUSDParams = {
  /** Telegram User ID placing the order. */
  userTelegramID: string;
  /** Identifier for the associated GxQuote. */
  quoteId: string;
  /** Token address for the order. */
  tokenAddress: string;
  /** Chain ID for the order. */
  chainId: string;
  /** Identifier for the event. */
  eventId: string;
  /** Optional GxQuote with MongoDB document structure. */
  quote?: WithId<MongoGxQuote>;
};

/**
 * Represents a MongoDB document for an OrderG1 with additional fields for database storage.
 */
export type MongoOrderG1 = MongoGxQuote & {
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

/**
 * Represents a MongoDB document for an OrderUSD with additional fields for database storage.
 */
export type MongoOrderUSD = MongoGxQuote & {
  /** Identifier for the event. */
  eventId: string;
  /** Chain ID for the order. */
  chainId: ChainId;
  /** Token address for the order. */
  tokenAddress: TokenAddress;
  /** Transaction status of the order. */
  status: TransactionStatus;
  /** Date when the order was added. */
  dateAdded: Date;
  /** Hash of the transaction associated with the order. */
  transactionHash: string;
  /** Hash of the user operation associated with the order. */
  userOpHash: string;
};
