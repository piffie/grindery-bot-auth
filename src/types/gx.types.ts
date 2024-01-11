import {
  ChainId,
  TelegramUserId,
  TokenAddress,
  TransactionStatus,
} from 'grindery-nexus-common-utils';
import { WithId } from 'mongodb';
import { Ordertype } from '../utils/constants';

export type GxQuote = {
  tokenAmountG1: string;
  usdFromUsdInvestment: string;
  usdFromG1Investment: string;
  usdFromMvu: string;
  usdFromTime: string;
  equivalentUsdInvested: string;
  gxBeforeMvu: string;
  gxMvuEffect: string;
  gxTimeEffect: string;
  GxUsdExchangeRate: string;
  standardGxUsdExchangeRate: string;
  discountReceived: string;
  gxReceived: string;
};

export type MongoGxQuote = GxQuote & {
  quoteId: string;
  date: Date;
  userTelegramID: TelegramUserId;
};

export type OrderG1Params = {
  userTelegramID: string;
  quoteId: string;
  eventId: string;
  quote?: WithId<MongoGxQuote>;
};

export type OrderUSDParams = {
  userTelegramID: string;
  quoteId: string;
  tokenAddress: string;
  chainId: string;
  eventId: string;
  quote?: WithId<MongoGxQuote>;
};

export type MongoOrderG1 = MongoGxQuote & {
  eventId: string;
  status: TransactionStatus;
  dateAdded: Date;
  transactionHash: string;
  userOpHash: string;
  orderType: Ordertype;
};

export type MongoOrderUSD = MongoGxQuote & {
  eventId: string;
  chainId: ChainId;
  tokenAddress: TokenAddress;
  status: TransactionStatus;
  dateAdded: Date;
  transactionHash: string;
  userOpHash: string;
};
