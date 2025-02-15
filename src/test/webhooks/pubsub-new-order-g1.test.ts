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
  mockChainName,
  getCollectionUsersMock,
  getCollectionGXQuoteMock,
  mockOrderID,
  mockOrderID1,
  getCollectionGXOrderMock,
  mockEventId1,
  mockEventId2,
  mockEventId,
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
import {
  G1_POLYGON_ADDRESS,
  SOURCE_WALLET_ADDRESS,
  ZAPIER_NEW_ORDER_WEBHOOK,
} from '../../../secrets';
import * as web3 from '../../utils/web3';
import { ContractStub } from '../../types/tests.types';
import { TransactionStatus } from 'grindery-nexus-common-utils';
import { handleNewOrder } from '../../webhooks/order';
import { spuriousOrdersG1 } from './samples/g1-orders-sample';

chai.use(chaiExclude);

describe('handleNewOrder function', async function () {
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

    await collectionOrdersMock.insertMany(spuriousOrdersG1);

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

      if (url == ZAPIER_NEW_ORDER_WEBHOOK) {
        return Promise.resolve({
          result: 'success',
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

  describe('Normal process to handle a G1 order', async function () {
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
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
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
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        }),
      ).to.be.true;
    });

    it('Should populate order database', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      const orders = await collectionOrdersMock.find({}).toArray();

      expect(orders)
        .excluding(['dateAdded', '_id'])
        .to.deep.equal(
          spuriousOrdersG1.concat([
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
              quoteId: mockOrderID,
              orderType: 'g1',
              tokenAmountG1: '5',
              usdFromUsdInvestment: '1',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
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

    it('Should call the sendTokens function properly as a G1 token transfer', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: mockChainName,
        to: [G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [`${SOURCE_WALLET_ADDRESS}+5000000000000000000`],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should call webhook properly', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      const webhookArgs = axiosStub
        .getCalls()
        .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK).args[1];

      expect(webhookArgs).excluding(['dateAdded']).to.deep.equal({
        quoteId: mockOrderID,
        orderType: 'g1',
        tokenAmountG1: '5',
        usdFromUsdInvestment: '1',
        equivalentUsdInvested: '1',
        GxUsdExchangeRate: '1',
        gxReceived: '1',
        userTelegramID: mockUserTelegramID,
        eventId: mockEventId,
        transactionHash: mockTransactionHash,
        userOpHash: undefined,
        status: TransactionStatus.SUCCESS,
        tokenAddress: undefined,
        tokenAmount: undefined,
        chainId: undefined,
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
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
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
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      const orders = await collectionOrdersMock.find({}).toArray();

      expect(orders)
        .excluding(['dateAdded', '_id'])
        .to.deep.equal(
          spuriousOrdersG1.concat([
            {
              quoteId: mockOrderID,
              orderType: 'g1',
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
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
      expect(orders[0].dateAdded).to.be.a('date');
    });

    it('Should call the sendTokens function properly for a G1 order', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: mockChainName,
        to: [G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [`${SOURCE_WALLET_ADDRESS}+500550000000000000000`],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should call webhook properly', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      const webhookArgs = axiosStub
        .getCalls()
        .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK).args[1];

      expect(webhookArgs).excluding(['dateAdded']).to.deep.equal({
        quoteId: mockOrderID,
        orderType: 'g1',
        tokenAmountG1: '500.55',
        usdFromUsdInvestment: '1',
        equivalentUsdInvested: '1',
        GxUsdExchangeRate: '1',
        gxReceived: '1',
        userTelegramID: mockUserTelegramID,
        eventId: mockEventId,
        transactionHash: mockTransactionHash,
        userOpHash: undefined,
        status: TransactionStatus.SUCCESS,
        tokenAddress: undefined,
        tokenAmount: undefined,
        chainId: undefined,
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
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
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
        quoteId: mockOrderID,
        orderType: 'g1',
        tokenAmountG1: '500.55',
        usdFromUsdInvestment: '1',
        equivalentUsdInvested: '1',
        GxUsdExchangeRate: '1',
        gxReceived: '1',
        userTelegramID: mockUserTelegramID,
        eventId: mockEventId,
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

    it('Should return true and no token sending if transaction is already a success', async function () {
      expect(
        await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if transaction is already a success', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
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
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal(
          spuriousOrdersG1.concat([
            {
              quoteId: mockOrderID,
              orderType: 'g1',
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
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

    it('Should not call webhook', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('Another USD order exists with a success status and not the same quote ID', async function () {
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
        orderType: Ordertype.USD,
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

    it('Should return true and no token sending if another USD order exists with a success status and not the same quote ID', async function () {
      expect(
        await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if another USD order exists with a success status and not the same quote ID', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if another USD order exists with a success status and not the same quote ID', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal(
          spuriousOrdersG1.concat([
            {
              quoteId: mockOrderID1,
              orderType: Ordertype.USD,
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

    it('Should not call webhook', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
      ).to.be.undefined;
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
        quoteId: mockOrderID,
        orderType: 'g1',
        tokenAmountG1: '500.55',
        usdFromUsdInvestment: '1',
        equivalentUsdInvested: '1',
        GxUsdExchangeRate: '1',
        gxReceived: '1',
        userTelegramID: mockUserTelegramID,
        eventId: mockEventId,
        transactionHash: mockTransactionHash,
        userOpHash: null,
        status: TransactionStatus.FAILURE,
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

    it('Should return true and no token sending if order if is already a failure', async function () {
      expect(
        await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if order if is already a failure', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
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
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal(
          spuriousOrdersG1.concat([
            {
              quoteId: mockOrderID,
              orderType: 'g1',
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: mockTransactionHash,
              userOpHash: null,
              status: TransactionStatus.FAILURE,
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

    it('Should not call webhook', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
      ).to.be.undefined;
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
        quoteId: mockOrderID,
        orderType: 'g1',
        tokenAmountG1: '500.55',
        usdFromUsdInvestment: '1',
        equivalentUsdInvested: '1',
        GxUsdExchangeRate: '1',
        gxReceived: '1',
        userTelegramID: mockUserTelegramID,
        eventId: mockEventId,
        transactionHash: mockTransactionHash,
        userOpHash: null,
        status: TransactionStatus.FAILURE_503,
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

    it('Should return true and no token sending if order if is already a failure', async function () {
      expect(
        await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if order if is already a failure', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
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
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal(
          spuriousOrdersG1.concat([
            {
              quoteId: mockOrderID,
              orderType: 'g1',
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: mockTransactionHash,
              userOpHash: null,
              status: TransactionStatus.FAILURE_503,
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

    it('Should not call webhook', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('Order if another G1 order exists with a success', async function () {
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
        quoteId: mockOrderID,
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

    it('Should return true and no token sending if another success G1 order exists for this user', async function () {
      expect(
        await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if another success G1 order exists for this user', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if another success G1 order exists for this user', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal(
          spuriousOrdersG1.concat([
            {
              quoteId: mockOrderID,
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

    it('Should not call webhook', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
      ).to.be.undefined;
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
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
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
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(result).to.be.false;
    });

    it('Should not modify transaction status in the database if there is an error in the send tokens request', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal(
          spuriousOrdersG1.concat([
            {
              quoteId: mockOrderID,
              orderType: 'g1',
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: null,
              userOpHash: null,
              status: TransactionStatus.PENDING,
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

    it('Should not call webhook', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
      ).to.be.undefined;
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
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(result).to.be.true;
    });

    it('Should not add anything in database if sender is not a user', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray()).to.deep.equal(
        spuriousOrdersG1,
      );
    });

    it('Should not send tokens if sender is not a user', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not call webhook', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
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
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(result).to.be.true;
    });

    it('Should not add anything in database if quote is not available', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray()).to.deep.equal(
        spuriousOrdersG1,
      );
    });

    it('Should not send tokens if quote is not available', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
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
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
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
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(result).to.be.true;
    });

    it('Should complete db status to failure in database if error 470 in PatchWallet transaction', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['dateAdded', '_id'])
        .to.deep.equal(
          spuriousOrdersG1.concat([
            {
              quoteId: mockOrderID,
              orderType: 'g1',
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: null,
              userOpHash: null,
              status: TransactionStatus.FAILURE,
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

    it('Should not call webhook', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
      ).to.be.undefined;
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
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
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
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(result).to.be.true;
    });

    it('Should complete db status to failure 503 in database if error 503 in PatchWallet transaction', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['dateAdded', '_id'])
        .to.deep.equal(
          spuriousOrdersG1.concat([
            {
              quoteId: mockOrderID,
              orderType: 'g1',
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: null,
              userOpHash: null,
              status: TransactionStatus.FAILURE_503,
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

    it('Should not call webhook', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
      ).to.be.undefined;
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
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
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
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(result).to.be.false;
    });

    it('Should do no transaction status modification in database if no hash in PatchWallet transaction', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(await collectionOrdersMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal(
          spuriousOrdersG1.concat([
            {
              quoteId: mockOrderID,
              orderType: 'g1',
              tokenAmountG1: '500.55',
              usdFromUsdInvestment: '1',
              equivalentUsdInvested: '1',
              GxUsdExchangeRate: '1',
              gxReceived: '1',
              userTelegramID: mockUserTelegramID,
              eventId: mockEventId,
              transactionHash: null,
              userOpHash: null,
              status: TransactionStatus.PENDING,
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

    it('Should not call webhook', async function () {
      await handleNewOrder({
        orderType: Ordertype.G1,
        userTelegramID: mockUserTelegramID,
        quoteId: mockOrderID,
        eventId: mockEventId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
      ).to.be.undefined;
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
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
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
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(result).to.be.false;
      });

      it('Should update reward database with a pending_hash status and userOpHash if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersG1.concat([
              {
                quoteId: mockOrderID,
                orderType: 'g1',
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: null,
                userOpHash: mockUserOpHash,
                status: TransactionStatus.PENDING_HASH,
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

      it('Should not call webhook', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
        ).to.be.undefined;
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
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
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
            orderType: 'g1',
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            eventId: mockEventId,
            transactionHash: null,
            userOpHash: mockUserOpHash,
            status: TransactionStatus.PENDING_HASH,
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
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
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
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersG1.concat([
              {
                quoteId: mockOrderID,
                orderType: 'g1',
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: mockTransactionHash,
                userOpHash: mockUserOpHash,
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

      it('Should call webhook properly', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        const webhookArgs = axiosStub
          .getCalls()
          .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK).args[1];

        expect(webhookArgs).excluding(['dateAdded']).to.deep.equal({
          quoteId: mockOrderID,
          orderType: 'g1',
          tokenAmountG1: '500.55',
          usdFromUsdInvestment: '1',
          equivalentUsdInvested: '1',
          GxUsdExchangeRate: '1',
          gxReceived: '1',
          userTelegramID: mockUserTelegramID,
          eventId: mockEventId,
          transactionHash: mockTransactionHash,
          userOpHash: mockUserOpHash,
          status: TransactionStatus.SUCCESS,
          tokenAddress: undefined,
          tokenAmount: undefined,
          chainId: undefined,
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
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
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
            orderType: 'g1',
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            eventId: mockEventId,
            transactionHash: null,
            userOpHash: mockUserOpHash,
            status: TransactionStatus.PENDING_HASH,
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
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(result).to.be.false;
      });

      it('Should not send tokens if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
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
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersG1.concat([
              {
                quoteId: mockOrderID,
                orderType: 'g1',
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: null,
                userOpHash: mockUserOpHash,
                status: TransactionStatus.PENDING_HASH,
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

      it('Should not call webhook', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
        ).to.be.undefined;
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
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
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
            quoteId: mockOrderID,
            orderType: 'g1',
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            eventId: mockEventId,
            transactionHash: null,
            userOpHash: mockUserOpHash,
            status: TransactionStatus.PENDING_HASH,
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
        ]);
        axiosStub
          .withArgs(PATCHWALLET_TX_STATUS_URL)
          .rejects(new Error('Service not available'));
      });

      it('Should return false if Error in PatchWallet get status endpoint', async function () {
        const result = await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(result).to.be.false;
      });

      it('Should not send tokens if Error in PatchWallet get status endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
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
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersG1.concat([
              {
                quoteId: mockOrderID,
                orderType: 'g1',
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: null,
                userOpHash: mockUserOpHash,
                status: TransactionStatus.PENDING_HASH,
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

      it('Should not call webhook', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
        ).to.be.undefined;
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
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
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
            orderType: 'g1',
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            eventId: mockEventId,
            transactionHash: null,
            userOpHash: mockUserOpHash,
            status: TransactionStatus.PENDING_HASH,
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
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(result).to.be.true;
      });

      it('Should not send tokens if Error 470 in PatchWallet get status endpoint', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
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
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersG1.concat([
              {
                quoteId: mockOrderID,
                orderType: 'g1',
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: null,
                userOpHash: mockUserOpHash,
                status: TransactionStatus.FAILURE,
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

      it('Should not call webhook', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
        ).to.be.undefined;
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
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
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
            orderType: 'g1',
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            eventId: mockEventId,
            transactionHash: null,
            status: TransactionStatus.PENDING_HASH,
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
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is pending_hash without userOpHash', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
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
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersG1.concat([
              {
                quoteId: mockOrderID,
                orderType: 'g1',
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: null,
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

      it('Should not call webhook', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
        ).to.be.undefined;
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
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
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
            orderType: 'g1',
            tokenAmountG1: '500.55',
            usdFromUsdInvestment: '1',
            equivalentUsdInvested: '1',
            GxUsdExchangeRate: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            eventId: mockEventId,
            transactionHash: null,
            userOpHash: mockUserOpHash,
            status: TransactionStatus.PENDING_HASH,
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
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(result).to.be.true;
      });

      it('Should not send tokens after 10 min of trying to get status', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
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
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });
        expect(await collectionOrdersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal(
            spuriousOrdersG1.concat([
              {
                quoteId: mockOrderID,
                orderType: 'g1',
                tokenAmountG1: '500.55',
                usdFromUsdInvestment: '1',
                equivalentUsdInvested: '1',
                GxUsdExchangeRate: '1',
                gxReceived: '1',
                userTelegramID: mockUserTelegramID,
                eventId: mockEventId,
                transactionHash: null,
                userOpHash: mockUserOpHash,
                status: TransactionStatus.FAILURE,
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

      it('Should not call webhook', async function () {
        await handleNewOrder({
          orderType: Ordertype.G1,
          userTelegramID: mockUserTelegramID,
          quoteId: mockOrderID,
          eventId: mockEventId,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === ZAPIER_NEW_ORDER_WEBHOOK),
        ).to.be.undefined;
      });
    });
  });
});
