import chai, { expect } from 'chai';
import {
  mockResponsePath,
  mockUserName,
  mockUserTelegramID,
  mockWallet,
  mockAccessToken,
  mockTransactionHash,
  mockUserHandle,
  mockUserOpHash,
  mockChainName1,
  getCollectionUsersMock,
  getCollectionGXQuoteMock,
  mockOrderID,
  mockOrderID1,
  getCollectionGXOrderMock,
  mockEventId1,
  mockEventId2,
  mockTokenAddress1,
  mockChainId1,
  mockEventId,
  mockNativeTokenAddress,
} from '../utils';
import Sinon from 'sinon';
import axios from 'axios';
import chaiExclude from 'chai-exclude';
import {
  Ordertype,
  PATCHWALLET_AUTH_URL,
  PATCHWALLET_TX_STATUS_URL,
  PATCHWALLET_TX_URL,
} from '../../utils/constants';
import * as web3 from '../../utils/web3';
import { ContractStub } from '../../types/tests.types';
import { TransactionStatus } from 'grindery-nexus-common-utils';
import { spuriousOrdersUSD } from './samples/usd-orders-sample';
import { handleNewOrder } from '../../webhooks/order';
import { SOURCE_WALLET_ADDRESS } from '../../../secrets';

chai.use(chaiExclude);

describe('handleNewUSDOrder function', async function () {
  let sandbox: Sinon.SinonSandbox;
  let axiosStub;
  let collectionUsersMock;
  let collectionQuotesMock;
  let collectionOrdersMock;
  let contractStub: ContractStub;
  let getContract;

  beforeEach(async function () {
    collectionUsersMock = await getCollectionUsersMock();
    collectionQuotesMock = await getCollectionGXQuoteMock();
    collectionOrdersMock = await getCollectionGXOrderMock();

    await collectionOrdersMock.insertMany(spuriousOrdersUSD);

    sandbox = Sinon.createSandbox();
    axiosStub = sandbox.stub(axios, 'post').callsFake(async (url: string) => {
      if (url === PATCHWALLET_TX_URL) {
        return Promise.resolve({
          data: {
            txHash: mockTransactionHash,
          },
        });
      }

      if (url === PATCHWALLET_TX_STATUS_URL) {
        return Promise.resolve({
          data: {
            txHash: mockTransactionHash,
            userOpHash: mockUserOpHash,
          },
        });
      }

      if (url === PATCHWALLET_AUTH_URL) {
        return Promise.resolve({
          data: {
            access_token: mockAccessToken,
          },
        });
      }

      throw new Error('Unexpected URL encountered');
    });

    contractStub = {
      methods: {
        decimals: sandbox.stub().resolves('18'),
        transfer: sandbox.stub().callsFake((recipient, amount) => {
          return {
            encodeABI: sandbox.stub().returns(`${recipient}+${amount}`),
          };
        }),
      },
    };
    contractStub.methods.decimals = sandbox.stub().returns({
      call: sandbox.stub().resolves('18'),
    });
    getContract = () => {
      return contractStub;
    };

    sandbox.stub(web3, 'getContract').callsFake(getContract);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('Normal process to handle a USD order', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });

      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '5',
          usdFromUsdInvestment: '1000',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.00',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);

      await collectionOrdersMock.insertMany([
        {
          orderType: 'usd',
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
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
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
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);
    });

    it('Should return true', async function () {
      expect(
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        }),
      ).to.be.true;
    });

    it('Should populate order database', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      const orders = await collectionOrdersMock.find({}).toArray();

      expect(orders)
        .excluding(['dateAdded', '_id'])
        .to.deep.equal(
          spuriousOrdersUSD.concat([
            {
              orderType: 'usd',
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
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
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
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
            },
            {
              orderType: 'usd',
              quoteId: mockOrderID,
              tokenAmountG1: '5',
              usdFromUsdInvestment: '1000',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: mockTransactionHash,
              userOpHash: null,
              status: TransactionStatus.SUCCESS,
              tokenAmount: '100.00',
              tokenAddress: mockTokenAddress1,
              chainId: mockChainId1,
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
            },
          ]),
        );
    });

    it('Should call the sendTokens function properly as a G1 token transfer', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: mockChainName1,
        to: [mockTokenAddress1],
        value: ['0x00'],
        data: [`${SOURCE_WALLET_ADDRESS}+100000000000000000000`],
        delegatecall: 0,
        auth: '',
      });
    });
  });

  describe('Normal process to handle an order with a float number', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });

      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '1001.00',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);
    });

    it('Should populate orders database', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      const orders = await collectionOrdersMock.find({}).toArray();

      expect(orders)
        .excluding(['dateAdded', '_id'])
        .to.deep.equal(
          spuriousOrdersUSD.concat([
            {
              orderType: 'usd',
              quoteId: mockOrderID,
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1001.00',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: mockTransactionHash,
              userOpHash: null,
              status: TransactionStatus.SUCCESS,
              tokenAmount: '100.10',
              tokenAddress: mockTokenAddress1,
              chainId: mockChainId1,
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
            },
          ]),
        );
      expect(orders[0].dateAdded).to.be.a('date');
    });

    it('Should call the sendTokens function properly for a USD order', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: mockChainName1,
        to: [mockTokenAddress1],
        value: ['0x00'],
        data: [`${SOURCE_WALLET_ADDRESS}+100100000000000000000`],
        delegatecall: 0,
        auth: '',
      });
    });
  });

  describe('Native token transaction', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });

      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '1001.00',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockNativeTokenAddress,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);
    });

    it('Should return true', async function () {
      expect(
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        }),
      ).to.be.true;
    });

    it('Should populate orders database', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      const orders = await collectionOrdersMock.find({}).toArray();

      expect(orders)
        .excluding(['dateAdded', '_id'])
        .to.deep.equal(
          spuriousOrdersUSD.concat([
            {
              orderType: 'usd',
              quoteId: mockOrderID,
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1001.00',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: mockTransactionHash,
              userOpHash: null,
              status: TransactionStatus.SUCCESS,
              tokenAmount: '100.10',
              tokenAddress: mockNativeTokenAddress,
              chainId: mockChainId1,
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
            },
          ]),
        );
      expect(orders[0].dateAdded).to.be.a('date');
    });

    it('Should call the sendTokens function properly for a USD order', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: mockChainName1,
        to: [SOURCE_WALLET_ADDRESS],
        value: ['100100000000000000000'],
        data: ['0x'],
        delegatecall: 0,
        auth: '',
      });
    });
  });

  describe('Order is already a success', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '1001.00',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);

      await collectionOrdersMock.insertOne({
        orderType: 'usd',
        quoteId: mockOrderID,
        tokenAmountG1: '500.55',
        usdFromUsdInvestment: '1001.00',
        equivalentUsdInvested: '1',
        GxUsdExchangeRate: '1',
        gxReceived: '1',
        userTelegramID: mockUserTelegramID,
        eventId: mockEventId,
        transactionHash: mockTransactionHash,
        userOpHash: null,
        status: TransactionStatus.SUCCESS,
        tokenAmount: '100.10',
        tokenAddress: mockTokenAddress1,
        chainId: mockChainId1,
        m1: '0.2000',
        m2: '0.4000',
        m3: '0.3000',
        m4: '0.0000',
        m5: '0.2500',
        m6: '1.0000',
        finalG1Usd: '0.005000',
        gxFromUsd: '5000.00',
        usdFromG1: '600000.00',
        gxFromG1: '16666666.67',
        tokenAmountG1ForCalculations: '144.00',
      });
    });

    it('Should return true and no token sending if transaction is already a success', async function () {
      expect(
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if transaction is already a success', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if transaction is already a success', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal(
          spuriousOrdersUSD.concat([
            {
              orderType: 'usd',
              quoteId: mockOrderID,
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1001.00',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: mockTransactionHash,
              userOpHash: null,
              status: TransactionStatus.SUCCESS,
              tokenAmount: '100.10',
              tokenAddress: mockTokenAddress1,
              chainId: mockChainId1,
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
            },
          ]),
        );
    });
  });

  describe('Another G1 order exists with a success status and not the same quote ID', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '1001.00',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);

      await collectionOrdersMock.insertOne({
        quoteId: mockOrderID1,
        orderType: Ordertype.G1,
        tokenAmountG1: '500.55',
        usdFromUsdInvestment: '1',
        equivalentUsdInvested: '1',
        GxUsdExchangeRate: '1',
        gxReceived: '1',
        userTelegramID: mockUserTelegramID,
        eventId: mockEventId1,
        transactionHash: mockTransactionHash,
        userOpHash: null,
        status: TransactionStatus.SUCCESS,
        tokenAddress: null,
        tokenAmount: null,
        chainId: null,
        m1: '0.2000',
        m2: '0.4000',
        m3: '0.3000',
        m4: '0.0000',
        m5: '0.2500',
        m6: '1.0000',
        finalG1Usd: '0.005000',
        gxFromUsd: '5000.00',
        usdFromG1: '600000.00',
        gxFromG1: '16666666.67',
        tokenAmountG1ForCalculations: '144.00',
      });
    });

    it('Should return true and no token sending if another G1 order exists with a success status and not the same quote ID', async function () {
      expect(
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if another G1 order exists with a success status and not the same quote ID', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if another G1 order exists with a success status and not the same quote ID', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal(
          spuriousOrdersUSD.concat([
            {
              quoteId: mockOrderID1,
              orderType: Ordertype.G1,
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId1,
              transactionHash: mockTransactionHash,
              userOpHash: null,
              status: TransactionStatus.SUCCESS,
              tokenAddress: null,
              tokenAmount: null,
              chainId: null,
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
            },
          ]),
        );
    });
  });

  describe('Order if is already a failure', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);

      await collectionOrdersMock.insertOne({
        orderType: 'usd',
        quoteId: mockOrderID,
        tokenAmountG1: '500.55',
        usdFromUsdInvestment: '1001.00',
        equivalentUsdInvested: '1',
        GxUsdExchangeRate: '1',
        gxReceived: '1',
        userTelegramID: mockUserTelegramID,
        eventId: mockEventId,
        transactionHash: mockTransactionHash,
        userOpHash: null,
        status: TransactionStatus.FAILURE,
        tokenAmount: '100.10',
        tokenAddress: mockTokenAddress1,
        chainId: mockChainId1,
        m1: '0.2000',
        m2: '0.4000',
        m3: '0.3000',
        m4: '0.0000',
        m5: '0.2500',
        m6: '1.0000',
        finalG1Usd: '0.005000',
        gxFromUsd: '5000.00',
        usdFromG1: '600000.00',
        gxFromG1: '16666666.67',
        tokenAmountG1ForCalculations: '144.00',
      });
    });

    it('Should return true and no token sending if order if is already a failure', async function () {
      expect(
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if order if is already a failure', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if order if is already a failure', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal(
          spuriousOrdersUSD.concat([
            {
              orderType: 'usd',
              quoteId: mockOrderID,
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1001.00',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: mockTransactionHash,
              userOpHash: null,
              status: TransactionStatus.FAILURE,
              tokenAmount: '100.10',
              tokenAddress: mockTokenAddress1,
              chainId: mockChainId1,
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
            },
          ]),
        );
    });
  });

  describe('Order if is already a failure 503', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);

      await collectionOrdersMock.insertOne({
        orderType: 'usd',
        quoteId: mockOrderID,
        tokenAmountG1: '500.55',
        usdFromUsdInvestment: '1001.00',
        equivalentUsdInvested: '1',
        GxUsdExchangeRate: '1',
        gxReceived: '1',
        userTelegramID: mockUserTelegramID,
        eventId: mockEventId,
        transactionHash: mockTransactionHash,
        userOpHash: null,
        status: TransactionStatus.FAILURE_503,
        tokenAmount: '100.10',
        tokenAddress: mockTokenAddress1,
        chainId: mockChainId1,
        m1: '0.2000',
        m2: '0.4000',
        m3: '0.3000',
        m4: '0.0000',
        m5: '0.2500',
        m6: '1.0000',
        finalG1Usd: '0.005000',
        gxFromUsd: '5000.00',
        usdFromG1: '600000.00',
        gxFromG1: '16666666.67',
        tokenAmountG1ForCalculations: '144.00',
      });
    });

    it('Should return true and no token sending if order if is already a failure', async function () {
      expect(
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if order if is already a failure', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if order if is already a failure', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal(
          spuriousOrdersUSD.concat([
            {
              orderType: 'usd',
              quoteId: mockOrderID,
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1001.00',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: mockTransactionHash,
              userOpHash: null,
              status: TransactionStatus.FAILURE_503,
              tokenAmount: '100.10',
              tokenAddress: mockTokenAddress1,
              chainId: mockChainId1,
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
            },
          ]),
        );
    });
  });

  describe('Order if another USD order exists with a success', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);

      await collectionOrdersMock.insertOne({
        orderType: 'usd',
        quoteId: mockOrderID,
        tokenAmountG1: '500.55',
        usdFromUsdInvestment: '1001.00',
        equivalentUsdInvested: '1',
        GxUsdExchangeRate: '1',
        gxReceived: '1',
        userTelegramID: mockUserTelegramID,
        eventId: mockEventId1,
        transactionHash: mockTransactionHash,
        userOpHash: null,
        status: TransactionStatus.SUCCESS,
        tokenAmount: '100.10',
        tokenAddress: mockTokenAddress1,
        chainId: mockChainId1,
        m1: '0.2000',
        m2: '0.4000',
        m3: '0.3000',
        m4: '0.0000',
        m5: '0.2500',
        m6: '1.0000',
        finalG1Usd: '0.005000',
        gxFromUsd: '5000.00',
        usdFromG1: '600000.00',
        gxFromG1: '16666666.67',
        tokenAmountG1ForCalculations: '144.00',
      });
    });

    it('Should return true and no token sending if another success USD order exists for this user', async function () {
      expect(
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if another success USD order exists for this user', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if another success USD order exists for this user', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal(
          spuriousOrdersUSD.concat([
            {
              orderType: 'usd',
              quoteId: mockOrderID,
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1001.00',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId1,
              transactionHash: mockTransactionHash,
              userOpHash: null,
              status: TransactionStatus.SUCCESS,
              tokenAmount: '100.10',
              tokenAddress: mockTokenAddress1,
              chainId: mockChainId1,
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
            },
          ]),
        );
    });
  });

  describe('Error in send token request', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '1001.00',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);

      axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
        data: {
          error: 'service non available',
        },
      });
    });

    it('Should return false if there is an error in the send tokens request', async function () {
      const result = await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(result).to.be.false;
    });

    it('Should not modify transaction status in the database if there is an error in the send tokens request', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal(
          spuriousOrdersUSD.concat([
            {
              orderType: 'usd',
              quoteId: mockOrderID,
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1001.00',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: null,
              userOpHash: null,
              status: TransactionStatus.PENDING,
              tokenAmount: '100.10',
              tokenAddress: mockTokenAddress1,
              chainId: mockChainId1,
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
            },
          ]),
        );
    });
  });

  describe('Sender is not a user', async function () {
    beforeEach(async function () {
      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);
    });

    it('Should return true if sender is not a user', async function () {
      const result = await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(result).to.be.true;
    });

    it('Should not add anything in database if sender is not a user', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray()).to.deep.equal(
        spuriousOrdersUSD,
      );
    });

    it('Should not send tokens if sender is not a user', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });
  });

  describe('Quote is not available', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });
    });

    it('Should return true if quote is not available', async function () {
      const result = await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(result).to.be.true;
    });

    it('Should not add anything in database if quote is not available', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray()).to.deep.equal(
        spuriousOrdersUSD,
      );
    });

    it('Should not send tokens if quote is not available', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });
  });

  describe('USD investment is 0', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });

      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '0',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);
    });

    it('Should return true if USD investment is zero', async function () {
      const result = await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(result).to.be.true;
    });

    it('Should not add anything in database if USD investment is zero', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray()).to.deep.equal(
        spuriousOrdersUSD,
      );
    });

    it('Should not send tokens if USD investment is zero', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });
  });

  describe('PatchWallet 470 error', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '1001.00',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);

      axiosStub.withArgs(PATCHWALLET_TX_URL).rejects({
        response: {
          status: 470,
        },
      });
    });

    it('Should return true if error 470 in PatchWallet transaction', async function () {
      const result = await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(result).to.be.true;
    });

    it('Should complete db status to failure in database if error 470 in PatchWallet transaction', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['dateAdded', '_id'])
        .to.deep.equal(
          spuriousOrdersUSD.concat([
            {
              orderType: 'usd',
              quoteId: mockOrderID,
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1001.00',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: null,
              userOpHash: null,
              status: TransactionStatus.FAILURE,
              tokenAmount: '100.10',
              tokenAddress: mockTokenAddress1,
              chainId: mockChainId1,
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
            },
          ]),
        );
    });
  });

  describe('PatchWallet 503 error', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '1001.00',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);

      axiosStub.withArgs(PATCHWALLET_TX_URL).rejects({
        response: {
          status: 503,
        },
      });

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });
    });

    it('Should return true if error 503 in PatchWallet transaction', async function () {
      const result = await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(result).to.be.true;
    });

    it('Should complete db status to failure 503 in database if error 503 in PatchWallet transaction', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['dateAdded', '_id'])
        .to.deep.equal(
          spuriousOrdersUSD.concat([
            {
              orderType: 'usd',
              quoteId: mockOrderID,
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1001.00',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: null,
              userOpHash: null,
              status: TransactionStatus.FAILURE_503,
              tokenAmount: '100.10',
              tokenAddress: mockTokenAddress1,
              chainId: mockChainId1,
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
            },
          ]),
        );
    });
  });

  describe('No hash in PatchWallet transaction', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '1001.00',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          tokenAmount: '100.10',
          chainId: mockChainId1,
          tokenAddress: mockTokenAddress1,
          m1: '0.2000',
          m2: '0.4000',
          m3: '0.3000',
          m4: '0.0000',
          m5: '0.2500',
          m6: '1.0000',
          finalG1Usd: '0.005000',
          gxFromUsd: '5000.00',
          usdFromG1: '600000.00',
          gxFromG1: '16666666.67',
          tokenAmountG1ForCalculations: '144.00',
        },
      ]);

      axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
        data: {
          error: 'service non available',
        },
      });

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });
    });

    it('Should return false if no hash in PatchWallet transaction', async function () {
      const result = await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(result).to.be.false;
    });

    it('Should do no transaction status modification in database if no hash in PatchWallet transaction', async function () {
      await handleNewOrder({
        orderType: Ordertype.USD,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal(
          spuriousOrdersUSD.concat([
            {
              orderType: 'usd',
              quoteId: mockOrderID,
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1001.00',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: null,
              userOpHash: null,
              status: TransactionStatus.PENDING,
              tokenAmount: '100.10',
              tokenAddress: mockTokenAddress1,
              chainId: mockChainId1,
              m1: '0.2000',
              m2: '0.4000',
              m3: '0.3000',
              m4: '0.0000',
              m5: '0.2500',
              m6: '1.0000',
              finalG1Usd: '0.005000',
              gxFromUsd: '5000.00',
              usdFromG1: '600000.00',
              gxFromG1: '16666666.67',
              tokenAmountG1ForCalculations: '144.00',
            },
          ]),
        );
    });
  });

  describe('Get transaction hash via userOpHash if transaction hash is empty first', async function () {
    describe('Transaction hash is empty in tx PatchWallet endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
        });
        await collectionQuotesMock.insertMany([
          {
            quoteId: mockOrderID,
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1001.00',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
          {
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
        ]);
        axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return false if transaction hash is empty in tx PatchWallet endpoint', async function () {
        const result = await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(result).to.be.false;
      });

      it('Should update reward database with a pending_hash status and userOpHash if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersUSD.concat([
              {
                orderType: 'usd',
                quoteId: mockOrderID,
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1001.00',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: null,
                userOpHash: mockUserOpHash,
                status: TransactionStatus.PENDING_HASH,
                tokenAmount: '100.10',
                tokenAddress: mockTokenAddress1,
                chainId: mockChainId1,
                m1: '0.2000',
                m2: '0.4000',
                m3: '0.3000',
                m4: '0.0000',
                m5: '0.2500',
                m6: '1.0000',
                finalG1Usd: '0.005000',
                gxFromUsd: '5000.00',
                usdFromG1: '600000.00',
                gxFromG1: '16666666.67',
                tokenAmountG1ForCalculations: '144.00',
              },
            ]),
          );
      });
    });

    describe('Transaction hash is present in PatchWallet status endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
        });
        await collectionQuotesMock.insertMany([
          {
            quoteId: mockOrderID,
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1001.00',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
          {
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
        ]);

        await collectionOrdersMock.insertMany([
          {
            orderType: 'usd',
            quoteId: mockOrderID,
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1001.00',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            eventId: mockEventId,
            transactionHash: null,
            userOpHash: mockUserOpHash,
            status: TransactionStatus.PENDING_HASH,
            tokenAmount: '100.10',
            tokenAddress: mockTokenAddress1,
            chainId: mockChainId1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
        ]);
      });

      it('Should return true if transaction hash is present in PatchWallet status endpoint', async function () {
        const result = await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update the database with a success status if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersUSD.concat([
              {
                orderType: 'usd',
                quoteId: mockOrderID,
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1001.00',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: mockTransactionHash,
                userOpHash: mockUserOpHash,
                status: TransactionStatus.SUCCESS,
                tokenAmount: '100.10',
                tokenAddress: mockTokenAddress1,
                chainId: mockChainId1,
                m1: '0.2000',
                m2: '0.4000',
                m3: '0.3000',
                m4: '0.0000',
                m5: '0.2500',
                m6: '1.0000',
                finalG1Usd: '0.005000',
                gxFromUsd: '5000.00',
                usdFromG1: '600000.00',
                gxFromG1: '16666666.67',
                tokenAmountG1ForCalculations: '144.00',
              },
            ]),
          );
      });
    });

    describe('Transaction hash is not present in PatchWallet status endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
        });

        await collectionQuotesMock.insertMany([
          {
            quoteId: mockOrderID,
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1001.00',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
          {
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
        ]);

        await collectionOrdersMock.insertMany([
          {
            orderType: 'usd',
            quoteId: mockOrderID,
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1001.00',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            eventId: mockEventId,
            transactionHash: null,
            userOpHash: mockUserOpHash,
            status: TransactionStatus.PENDING_HASH,
            tokenAmount: '100.10',
            tokenAddress: mockTokenAddress1,
            chainId: mockChainId1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
        ]);
        axiosStub.withArgs(PATCHWALLET_TX_STATUS_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return false if transaction hash is not present in PatchWallet status endpoint', async function () {
        const result = await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(result).to.be.false;
      });

      it('Should not send tokens if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should not update database if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersUSD.concat([
              {
                orderType: 'usd',
                quoteId: mockOrderID,
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1001.00',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: null,
                userOpHash: mockUserOpHash,
                status: TransactionStatus.PENDING_HASH,
                tokenAmount: '100.10',
                tokenAddress: mockTokenAddress1,
                chainId: mockChainId1,
                m1: '0.2000',
                m2: '0.4000',
                m3: '0.3000',
                m4: '0.0000',
                m5: '0.2500',
                m6: '1.0000',
                finalG1Usd: '0.005000',
                gxFromUsd: '5000.00',
                usdFromG1: '600000.00',
                gxFromG1: '16666666.67',
                tokenAmountG1ForCalculations: '144.00',
              },
            ]),
          );
      });
    });

    describe('Error in PatchWallet get status endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
        });
        await collectionQuotesMock.insertMany([
          {
            quoteId: mockOrderID,
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1001.00',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
          {
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
        ]);

        await collectionOrdersMock.insertMany([
          {
            orderType: 'usd',
            quoteId: mockOrderID,
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1001.00',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            eventId: mockEventId,
            transactionHash: null,
            userOpHash: mockUserOpHash,
            status: TransactionStatus.PENDING_HASH,
            tokenAmount: '100.10',
            tokenAddress: mockTokenAddress1,
            chainId: mockChainId1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
        ]);
        axiosStub
          .withArgs(PATCHWALLET_TX_STATUS_URL)
          .rejects(new Error('Service not available'));
      });

      it('Should return false if Error in PatchWallet get status endpoint', async function () {
        const result = await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(result).to.be.false;
      });

      it('Should not send tokens if Error in PatchWallet get status endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should not update database if Error in PatchWallet get status endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersUSD.concat([
              {
                orderType: 'usd',
                quoteId: mockOrderID,
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1001.00',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: null,
                userOpHash: mockUserOpHash,
                status: TransactionStatus.PENDING_HASH,
                tokenAmount: '100.10',
                tokenAddress: mockTokenAddress1,
                chainId: mockChainId1,
                m1: '0.2000',
                m2: '0.4000',
                m3: '0.3000',
                m4: '0.0000',
                m5: '0.2500',
                m6: '1.0000',
                finalG1Usd: '0.005000',
                gxFromUsd: '5000.00',
                usdFromG1: '600000.00',
                gxFromG1: '16666666.67',
                tokenAmountG1ForCalculations: '144.00',
              },
            ]),
          );
      });
    });

    describe('Error 470 in PatchWallet get status endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
        });
        await collectionQuotesMock.insertMany([
          {
            quoteId: mockOrderID,
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1001.00',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
          {
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
        ]);
        await collectionOrdersMock.insertMany([
          {
            orderType: 'usd',
            quoteId: mockOrderID,
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1001.00',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            eventId: mockEventId,
            transactionHash: null,
            userOpHash: mockUserOpHash,
            status: TransactionStatus.PENDING_HASH,
            tokenAmount: '100.10',
            tokenAddress: mockTokenAddress1,
            chainId: mockChainId1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
        ]);
        axiosStub.withArgs(PATCHWALLET_TX_STATUS_URL).rejects({
          response: {
            status: 470,
          },
        });
      });

      it('Should return true if Error 470 in PatchWallet get status endpoint', async function () {
        const result = await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens if Error 470 in PatchWallet get status endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update database with failure status if Error 470 in PatchWallet get status endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersUSD.concat([
              {
                orderType: 'usd',
                quoteId: mockOrderID,
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1001.00',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: null,
                userOpHash: mockUserOpHash,
                status: TransactionStatus.FAILURE,
                tokenAmount: '100.10',
                tokenAddress: mockTokenAddress1,
                chainId: mockChainId1,
                m1: '0.2000',
                m2: '0.4000',
                m3: '0.3000',
                m4: '0.0000',
                m5: '0.2500',
                m6: '1.0000',
                finalG1Usd: '0.005000',
                gxFromUsd: '5000.00',
                usdFromG1: '600000.00',
                gxFromG1: '16666666.67',
                tokenAmountG1ForCalculations: '144.00',
              },
            ]),
          );
      });
    });

    describe('Transaction is set to success without transaction hash if pending_hash without userOpHash', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
        });

        await collectionQuotesMock.insertMany([
          {
            quoteId: mockOrderID,
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1001.00',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
          {
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
        ]);

        await collectionOrdersMock.insertMany([
          {
            orderType: 'usd',
            quoteId: mockOrderID,
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1001.00',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            eventId: mockEventId,
            transactionHash: null,
            status: TransactionStatus.PENDING_HASH,
            tokenAmount: '100.10',
            tokenAddress: mockTokenAddress1,
            chainId: mockChainId1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
        ]);
      });

      it('Should return true if transaction hash is pending_hash without userOpHash', async function () {
        const result = await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(result).to.be.true;
      });
      it('Should not send tokens if transaction hash is pending_hash without userOpHash', async function () {
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update reward database with a success status if transaction hash is pending_hash without userOpHash', async function () {
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersUSD.concat([
              {
                orderType: 'usd',
                quoteId: mockOrderID,
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1001.00',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: null,
                userOpHash: null,
                status: TransactionStatus.SUCCESS,
                tokenAmount: '100.10',
                tokenAddress: mockTokenAddress1,
                chainId: mockChainId1,
                m1: '0.2000',
                m2: '0.4000',
                m3: '0.3000',
                m4: '0.0000',
                m5: '0.2500',
                m6: '1.0000',
                finalG1Usd: '0.005000',
                gxFromUsd: '5000.00',
                usdFromG1: '600000.00',
                gxFromG1: '16666666.67',
                tokenAmountG1ForCalculations: '144.00',
              },
            ]),
          );
      });
    });

    describe('Order is considered as failure after 10 min of trying to get status', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
        });

        await collectionQuotesMock.insertMany([
          {
            quoteId: mockOrderID,
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1001.00',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
          {
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '100.10',
            chainId: mockChainId1,
            tokenAddress: mockTokenAddress1,
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
        ]);

        await collectionOrdersMock.insertMany([
          {
            orderType: 'usd',
            quoteId: mockOrderID,
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1001.00',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            eventId: mockEventId,
            transactionHash: null,
            userOpHash: mockUserOpHash,
            status: TransactionStatus.PENDING_HASH,
            tokenAmount: '100.10',
            tokenAddress: mockTokenAddress1,
            chainId: mockChainId1,
            dateAdded: new Date(Date.now() - 12 * 60 * 1000),
            m1: '0.2000',
            m2: '0.4000',
            m3: '0.3000',
            m4: '0.0000',
            m5: '0.2500',
            m6: '1.0000',
            finalG1Usd: '0.005000',
            gxFromUsd: '5000.00',
            usdFromG1: '600000.00',
            gxFromG1: '16666666.67',
            tokenAmountG1ForCalculations: '144.00',
          },
        ]);
        axiosStub.withArgs(PATCHWALLET_TX_STATUS_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });
      it('Should return true after 10 min of trying to get status', async function () {
        const result = await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(result).to.be.true;
      });
      it('Should not send tokens after 10 min of trying to get status', async function () {
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });
      it('Should update reward database with a failure status after 10 min of trying to get status', async function () {
        await handleNewOrder({
          orderType: Ordertype.USD,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersUSD.concat([
              {
                orderType: 'usd',
                quoteId: mockOrderID,
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1001.00',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: null,
                userOpHash: mockUserOpHash,
                status: TransactionStatus.FAILURE,
                tokenAmount: '100.10',
                tokenAddress: mockTokenAddress1,
                chainId: mockChainId1,
                m1: '0.2000',
                m2: '0.4000',
                m3: '0.3000',
                m4: '0.0000',
                m5: '0.2500',
                m6: '1.0000',
                finalG1Usd: '0.005000',
                gxFromUsd: '5000.00',
                usdFromG1: '600000.00',
                gxFromG1: '16666666.67',
                tokenAmountG1ForCalculations: '144.00',
              },
            ]),
          );
      });
    });
  });
});
