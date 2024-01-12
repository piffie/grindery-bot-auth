import { TransactionStatus } from 'grindery-nexus-common-utils';
import {
  mockChainId,
  mockEventId1,
  mockEventId2,
  mockOrderID,
  mockTokenAddress,
  mockTransactionHash,
  mockUserTelegramID,
  mockUserTelegramID2,
} from '../../utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const spuriousOrdersG1: any[] = [
  {
    orderType: 'another_order_type',
    tokenAmountG1: '500.55',
    usdFromUsdInvestment: '1',
    usdFromG1Investment: '1',
    usdFromMvu: '1',
    usdFromTime: '1',
    equivalentUsdInvested: '1',
    gxBeforeMvu: '1',
    gxMvuEffect: '1',
    gxTimeEffect: '1',
    GxUsdExchangeRate: '1',
    standardGxUsdExchangeRate: '1',
    discountReceived: '1',
    gxReceived: '1',
    userTelegramID: mockUserTelegramID,
    eventId: mockEventId2,
    transactionHash: mockTransactionHash,
    userOpHash: null,
    status: TransactionStatus.SUCCESS,
    dateAdded: new Date(),
  },
  {
    orderType: 'usd',
    tokenAmountG1: '500.55',
    usdFromUsdInvestment: '1',
    usdFromG1Investment: '1',
    usdFromMvu: '1',
    usdFromTime: '1',
    equivalentUsdInvested: '1',
    gxBeforeMvu: '1',
    gxMvuEffect: '1',
    gxTimeEffect: '1',
    GxUsdExchangeRate: '1',
    standardGxUsdExchangeRate: '1',
    discountReceived: '1',
    gxReceived: '1',
    userTelegramID: mockUserTelegramID,
    eventId: mockEventId1,
    transactionHash: mockTransactionHash,
    userOpHash: null,
    status: TransactionStatus.FAILURE,
    dateAdded: new Date(),
  },
  {
    orderType: 'another_order_type',
    tokenAmountG1: '500.55',
    usdFromUsdInvestment: '1',
    usdFromG1Investment: '1',
    usdFromMvu: '1',
    usdFromTime: '1',
    equivalentUsdInvested: '1',
    gxBeforeMvu: '1',
    gxMvuEffect: '1',
    gxTimeEffect: '1',
    GxUsdExchangeRate: '1',
    standardGxUsdExchangeRate: '1',
    discountReceived: '1',
    gxReceived: '1',
    userTelegramID: mockUserTelegramID,
    eventId: mockEventId2,
    transactionHash: mockTransactionHash,
    userOpHash: null,
    status: TransactionStatus.SUCCESS,
    dateAdded: new Date(),
  },
  {
    orderType: 'usd',
    quoteId: mockOrderID,
    tokenAmountG1: '5',
    usdFromUsdInvestment: '1000',
    usdFromG1Investment: '1',
    usdFromMvu: '1',
    usdFromTime: '1',
    equivalentUsdInvested: '1',
    gxBeforeMvu: '1',
    gxMvuEffect: '1',
    gxTimeEffect: '1',
    GxUsdExchangeRate: '1',
    standardGxUsdExchangeRate: '1',
    discountReceived: '1',
    gxReceived: '1',
    userTelegramID: mockUserTelegramID,
    eventId: mockEventId2,
    transactionHash: mockTransactionHash,
    userOpHash: null,
    status: TransactionStatus.SUCCESS,
    tokenAmount: '100.00',
    tokenAddress: mockTokenAddress,
    chainId: mockChainId,
  },
  {
    quoteId: mockOrderID,
    orderType: 'g1',
    tokenAmountG1: '500.55',
    usdFromUsdInvestment: '1',
    usdFromG1Investment: '1',
    usdFromMvu: '1',
    usdFromTime: '1',
    equivalentUsdInvested: '1',
    gxBeforeMvu: '1',
    gxMvuEffect: '1',
    gxTimeEffect: '1',
    GxUsdExchangeRate: '1',
    standardGxUsdExchangeRate: '1',
    discountReceived: '1',
    gxReceived: '1',
    userTelegramID: mockUserTelegramID2,
    eventId: mockEventId2,
    transactionHash: mockTransactionHash,
    userOpHash: null,
    status: TransactionStatus.SUCCESS,
  },
];
