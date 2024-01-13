import { TransactionStatus } from 'grindery-nexus-common-utils';
import {
  mockChainId,
  mockEventId1,
  mockEventId2,
  mockEventId3,
  mockOrderID,
  mockTokenAddress,
  mockTransactionHash,
  mockUserTelegramID,
  mockUserTelegramID1,
} from '../../utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const spuriousOrdersUSD: any[] = [
  {
    orderType: 'g1',
    tokenAmountG1: '500.55',
    usdFromUsdInvestment: '1',
    equivalentUsdInvested: '1',
    GxUsdExchangeRate: '1',
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
    equivalentUsdInvested: '1',
    GxUsdExchangeRate: '1',
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
    equivalentUsdInvested: '1',
    GxUsdExchangeRate: '1',
    gxReceived: '1',
    userTelegramID: mockUserTelegramID1,
    eventId: mockEventId1,
    transactionHash: mockTransactionHash,
    userOpHash: null,
    status: TransactionStatus.SUCCESS,
    tokenAmount: '100.00',
    tokenAddress: mockTokenAddress,
    chainId: mockChainId,
  },
  {
    orderType: 'g1',
    quoteId: mockOrderID,
    tokenAmountG1: '5',
    usdFromUsdInvestment: '1000',
    equivalentUsdInvested: '1',
    GxUsdExchangeRate: '1',
    gxReceived: '1',
    userTelegramID: mockUserTelegramID,
    eventId: mockEventId3,
    transactionHash: mockTransactionHash,
    userOpHash: null,
    status: TransactionStatus.SUCCESS,
    tokenAmount: '100.00',
    tokenAddress: mockTokenAddress,
    chainId: mockChainId,
  },
];
