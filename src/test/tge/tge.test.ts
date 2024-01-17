import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import Sinon from 'sinon';
import * as g1gx from '../../utils/g1gx';
import app from '../../index';
import { getApiKey } from '../../../secrets';
import {
  getCollectionGXOrderMock,
  getCollectionGXQuoteMock,
  getCollectionUsersMock,
  isUUIDv4,
  mockChainId,
  mockOrderID,
  mockOrderID1,
  mockQuoteID,
  mockTokenAddress,
  mockTransactionHash,
  mockUserOpHash,
  mockUserTelegramID,
  mockUserTelegramID1,
  mockValue,
} from '../utils';
import chaiExclude from 'chai-exclude';
import { ANKR_MULTICHAIN_API_URL, Ordertype } from '../../utils/constants';
import axios from 'axios';
import { GxOrderStatus } from 'grindery-nexus-common-utils';
import * as web3 from '../../utils/web3';

chai.use(chaiHttp);
chai.use(chaiExclude);

describe('G1 to GX util functions', async function () {
  let sandbox: Sinon.SinonSandbox;
  let collectionQuotesMock;
  let collectionOrdersMock;
  let conversionStub;
  let balanceStub;
  let balanceStubNative;

  beforeEach(async function () {
    collectionQuotesMock = await getCollectionGXQuoteMock();
    collectionOrdersMock = await getCollectionGXOrderMock();
    const collectionUser = await getCollectionUsersMock();

    await collectionUser?.insertOne({
      userTelegramID: mockUserTelegramID,
      attributes: {
        aff_score: null,
        balance_100123: '500',
        host_score: null,
        isActiveUser: true,
        isBlacklist: false,
        isContributeUser: false,
        isDead: false,
        isDoubleSpent: false,
        isDrone: false,
        isDroneOwner: false,
        isGamer: false,
        isSlave: false,
        isWalkingDead: false,
        mvu_rounded: '5',
        mvu_score: '5.03',
        virtual_balance: '0',
      },
    });

    sandbox = Sinon.createSandbox();
    conversionStub = sandbox.stub(g1gx, 'computeG1ToGxConversion').returns({
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
      gxReceived: '16671666.67',
      equivalentUsdInvested: '2178.50',
      GxUsdExchangeRate: '10.00',
    });

    sandbox.stub(g1gx, 'getUserTgeBalance').resolves(555);
    balanceStub = sandbox.stub(web3, 'getUserBalanceERC20').resolves('10');
    balanceStubNative = sandbox
      .stub(web3, 'getUserBalanceNative')
      .resolves('20');

    sandbox.stub(axios, 'post').callsFake(async (url: string) => {
      if (url === ANKR_MULTICHAIN_API_URL) {
        return Promise.resolve({
          data: {
            jsonrpc: '2.0',
            id: 1,
            result: {
              usdPrice: '10',
              blockchain: 'polygon',
              contractAddress: '0x2c89bbc92bd86f8075d1decc58c7f4e0107f286b',
              syncStatus: {
                timestamp: 1704124545,
                lag: '-6s',
                status: 'synced',
              },
            },
          },
        });
      }

      throw new Error('Unexpected URL encountered');
    });
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('Endpoint for conversion information', async function () {
    it('With 0 USD', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/quote')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          tokenAmount: '0',
          chainId: undefined,
          tokenAddress: undefined,
          g1Quantity: '10',
          userTelegramID: mockUserTelegramID,
        });

      expect(isUUIDv4(res.body.quoteId)).to.be.true;

      delete res.body.date;
      delete res.body.quoteId;

      expect(res.body).to.deep.equal({
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
        gxReceived: '16671666.67',
        equivalentUsdInvested: '2178.50',
        GxUsdExchangeRate: '10.00',
        userTelegramID: mockUserTelegramID,
        tokenAmountG1: '10',
        usdFromUsdInvestment: '0',
        tokenAmount: '0',
        chainId: null,
        tokenAddress: null,
        tokenAmountG1ForCalculations: '555.00',
      });

      const quotes = await collectionQuotesMock.find({}).toArray();

      expect(quotes)
        .excluding(['_id', 'date', 'quoteId'])
        .to.deep.equal([
          {
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
            gxReceived: '16671666.67',
            equivalentUsdInvested: '2178.50',
            GxUsdExchangeRate: '10.00',
            userTelegramID: mockUserTelegramID,
            tokenAmountG1: '10',
            usdFromUsdInvestment: '0',
            tokenAmount: '0',
            chainId: null,
            tokenAddress: null,
            tokenAmountG1ForCalculations: '555.00',
          },
        ]);

      expect(isUUIDv4(quotes[0].quoteId)).to.be.true;
    });

    it('Should return an error if total amount invested is more than $10,000 USD', async function () {
      conversionStub.returns({
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
        gxReceived: '16671666.67',
        equivalentUsdInvested: '11000',
        GxUsdExchangeRate: '10.00',
      });

      const res = await chai
        .request(app)
        .get('/v1/tge/quote')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          tokenAmount: '10',
          chainId: mockChainId,
          tokenAddress: mockTokenAddress,
          g1Quantity: '10',
          userTelegramID: mockUserTelegramID,
        });

      expect(res.body).to.deep.equal({
        msg: 'The investment amount must not exceed $10,000 USD to proceed.',
      });

      expect(await collectionQuotesMock.find({}).toArray()).to.be.empty;
    });

    it('With undefined USD', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/quote')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          tokenAmount: undefined,
          chainId: undefined,
          tokenAddress: undefined,
          g1Quantity: '10',
          userTelegramID: mockUserTelegramID,
        });

      expect(isUUIDv4(res.body.quoteId)).to.be.true;

      delete res.body.date;
      delete res.body.quoteId;

      expect(res.body).to.deep.equal({
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
        gxReceived: '16671666.67',
        equivalentUsdInvested: '2178.50',
        GxUsdExchangeRate: '10.00',
        userTelegramID: mockUserTelegramID,
        tokenAmountG1: '10',
        usdFromUsdInvestment: '0',
        tokenAmount: '0',
        chainId: null,
        tokenAddress: null,
        tokenAmountG1ForCalculations: '555.00',
      });

      const quotes = await collectionQuotesMock.find({}).toArray();

      expect(quotes)
        .excluding(['_id', 'date', 'quoteId'])
        .to.deep.equal([
          {
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
            gxReceived: '16671666.67',
            equivalentUsdInvested: '2178.50',
            GxUsdExchangeRate: '10.00',
            userTelegramID: mockUserTelegramID,
            tokenAmountG1: '10',
            usdFromUsdInvestment: '0',
            tokenAmount: '0',
            chainId: null,
            tokenAddress: null,
            tokenAmountG1ForCalculations: '555.00',
          },
        ]);

      expect(isUUIDv4(quotes[0].quoteId)).to.be.true;
    });

    it('Should return an error if G1 token amount is 0', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/quote')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          tokenAmount: '10',
          chainId: mockChainId,
          tokenAddress: mockTokenAddress,
          g1Quantity: '0',
          userTelegramID: mockUserTelegramID,
        });

      expect(res.body).to.deep.equal({
        msg: 'The amount of G1 must be a positive number.',
      });

      expect(await collectionQuotesMock.find({}).toArray()).to.be.empty;
    });

    it('Should call the computeG1ToGxConversion with balance snapshot if balance snapshot > balance', async function () {
      await chai
        .request(app)
        .get('/v1/tge/quote')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          tokenAmount: '10',
          chainId: mockChainId,
          tokenAddress: mockTokenAddress,
          g1Quantity: '4',
          userTelegramID: mockUserTelegramID,
        });

      expect(conversionStub.getCalls()[0].args).to.deep.equal([
        500, 555, 100, 5.03,
      ]);
    });

    it('Should call the computeG1ToGxConversion with balance if balance snapshot < balance', async function () {
      balanceStub.returns(5000);

      await chai
        .request(app)
        .get('/v1/tge/quote')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          tokenAmount: '10',
          chainId: mockChainId,
          tokenAddress: mockTokenAddress,
          g1Quantity: '4',
          userTelegramID: mockUserTelegramID,
        });

      expect(conversionStub.getCalls()[0].args).to.deep.equal([
        5000, 555, 100, 5.03,
      ]);
    });

    it('Should return all conversion information', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/quote')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          tokenAmount: '10',
          chainId: mockChainId,
          tokenAddress: mockTokenAddress,
          g1Quantity: '4',
          userTelegramID: mockUserTelegramID,
        });

      expect(isUUIDv4(res.body.quoteId)).to.be.true;

      delete res.body.date;
      delete res.body.quoteId;

      expect(res.body).to.deep.equal({
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
        gxReceived: '16671666.67',
        equivalentUsdInvested: '2178.50',
        GxUsdExchangeRate: '10.00',
        userTelegramID: mockUserTelegramID,
        tokenAmountG1: '4',
        usdFromUsdInvestment: '100.00',
        tokenAmount: '10',
        chainId: mockChainId,
        tokenAddress: mockTokenAddress,
        tokenAmountG1ForCalculations: '555.00',
      });
    });

    it('Should fill the quote database with a quote ID and conversion informations', async function () {
      await chai
        .request(app)
        .get('/v1/tge/quote')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          tokenAmount: '10',
          chainId: mockChainId,
          tokenAddress: mockTokenAddress,
          g1Quantity: '4',
          userTelegramID: mockUserTelegramID,
        });

      const quotes = await collectionQuotesMock.find({}).toArray();

      expect(quotes)
        .excluding(['_id', 'date', 'quoteId'])
        .to.deep.equal([
          {
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
            gxReceived: '16671666.67',
            equivalentUsdInvested: '2178.50',
            GxUsdExchangeRate: '10.00',
            userTelegramID: mockUserTelegramID,
            tokenAmountG1: '4',
            usdFromUsdInvestment: '100.00',
            tokenAmount: '10',
            chainId: mockChainId,
            tokenAddress: mockTokenAddress,
            tokenAmountG1ForCalculations: '555.00',
          },
        ]);

      expect(isUUIDv4(quotes[0].quoteId)).to.be.true;
    });

    it('Should return an error if the G1 balance is less than the requested amount', async function () {
      balanceStub.returns('1');

      const res = await chai
        .request(app)
        .get('/v1/tge/quote')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          tokenAmount: '10',
          chainId: mockChainId,
          tokenAddress: mockTokenAddress,
          g1Quantity: '4',
          userTelegramID: mockUserTelegramID,
        });

      expect(res.body).to.deep.equal({
        msg: 'Insufficient G1 balance. The G1 balance must be greater than or equal to the requested token amount for the exchange.',
      });

      expect(await collectionQuotesMock.find({}).toArray()).to.be.empty;
    });

    it('Should return an error if the other token balance is less than the requested amount', async function () {
      balanceStub.returns('5');

      const res = await chai
        .request(app)
        .get('/v1/tge/quote')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          tokenAmount: '10',
          chainId: mockChainId,
          tokenAddress: mockTokenAddress,
          g1Quantity: '4',
          userTelegramID: mockUserTelegramID,
        });

      expect(res.body).to.deep.equal({
        msg: `Insufficient ${mockTokenAddress} balance. The ${mockTokenAddress} balance must be greater than or equal to the requested token amount for the exchange.`,
      });

      expect(await collectionQuotesMock.find({}).toArray()).to.be.empty;
    });

    it('Should return an error if the other token balance is less than the requested amount with lots of digits', async function () {
      balanceStubNative.returns('15.482128442114959219');

      const res = await chai
        .request(app)
        .get('/v1/tge/quote')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          tokenAmount: '15.48212844211496',
          chainId: 'eip155:137',
          tokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          g1Quantity: '4',
          userTelegramID: '5343013849',
        });

      expect(res.body).to.deep.equal({
        msg: 'Insufficient 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee balance. The 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee balance must be greater than or equal to the requested token amount for the exchange.',
      });

      expect(await collectionQuotesMock.find({}).toArray()).to.be.empty;
    });

    it('Should be a successful quote if amount and balance are the same with lots of digits', async function () {
      balanceStubNative.returns('15.482128442114959219');

      const res = await chai
        .request(app)
        .get('/v1/tge/quote')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          tokenAmount: '15.482128442114959219',
          chainId: 'eip155:137',
          tokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          g1Quantity: '4',
          userTelegramID: '5343013849',
        });

      expect(res.body).excluding(['date', 'quoteId']).to.deep.equal({
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
        gxReceived: '16671666.67',
        equivalentUsdInvested: '2178.50',
        GxUsdExchangeRate: '10.00',
        userTelegramID: '5343013849',
        tokenAmount: '15.482128442114959219',
        chainId: 'eip155:137',
        tokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenAmountG1: '4',
        usdFromUsdInvestment: '154.82',
        tokenAmountG1ForCalculations: '555.00',
      });

      const quotes = await collectionQuotesMock.find({}).toArray();

      expect(quotes)
        .excluding(['_id', 'date', 'quoteId'])
        .to.deep.equal([
          {
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
            gxReceived: '16671666.67',
            equivalentUsdInvested: '2178.50',
            GxUsdExchangeRate: '10.00',
            userTelegramID: '5343013849',
            tokenAmount: '15.482128442114959219',
            chainId: 'eip155:137',
            tokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            tokenAmountG1: '4',
            usdFromUsdInvestment: '154.82',
            tokenAmountG1ForCalculations: '555.00',
          },
        ]);

      expect(isUUIDv4(quotes[0].quoteId)).to.be.true;
    });
  });

  describe('Endpoint to get quotes for a user', async function () {
    beforeEach(async function () {
      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmountG1: '500.00',
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
        },
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
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
        },
      ]);
    });

    it('Should return the list of quotes for a given user', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/quotes')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          userTelegramID: mockUserTelegramID,
        });

      expect(res.body)
        .excluding(['_id'])
        .to.deep.equal([
          {
            quoteId: mockOrderID,
            tokenAmountG1: '500.00',
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
          },
          {
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
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
          },
        ]);
    });

    it('Should return an empty array if no quote for the user', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/quotes')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          userTelegramID: mockUserTelegramID1,
        });

      expect(res.body).to.be.empty;
    });
  });

  describe('Endpoint to get orders for a user', async function () {
    beforeEach(async function () {
      await collectionOrdersMock.insertMany([
        {
          orderId: mockOrderID,
          status: GxOrderStatus.COMPLETE,
          userTelegramID: mockUserTelegramID,
        },
        {
          orderId: mockOrderID1,
          status: GxOrderStatus.COMPLETE,
          userTelegramID: mockUserTelegramID,
        },
      ]);
    });

    it('Should return the list of quotes for a given user', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/orders')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          userTelegramID: mockUserTelegramID,
        });

      expect(res.body)
        .excluding(['_id'])
        .to.deep.equal([
          {
            orderId: mockOrderID,
            status: GxOrderStatus.COMPLETE,
            userTelegramID: mockUserTelegramID,
          },
          {
            orderId: mockOrderID1,
            status: GxOrderStatus.COMPLETE,
            userTelegramID: mockUserTelegramID,
          },
        ]);
    });

    it('Should return an empty array if no quote for the user', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/orders')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          userTelegramID: mockUserTelegramID1,
        });

      expect(res.body).to.be.empty;
    });
  });

  describe('Endpoint to get quote and order for a user', async function () {
    beforeEach(async function () {
      await collectionQuotesMock.insertMany([
        {
          quoteId: mockQuoteID,
          tokenAmountG1: '500.00',
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
        },
      ]);
    });

    it('Should return a 404 status if order is not found', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/status')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          quoteId: 'fake-quote-id',
        });

      expect(res.body).to.be.deep.equal({ msg: 'Order not found' });
      expect(res.status).to.be.equal(404);
    });

    it('Should global order status be SUCCESS when both G1 and USD orders are complete', async function () {
      await collectionOrdersMock.insertMany([
        {
          orderId: mockOrderID,
          status: GxOrderStatus.COMPLETE,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.G1,
          quoteId: mockQuoteID,
          dateG1: '2024-01-12T21:18:16.336Z',
          transactionHashG1: mockTransactionHash,
          userOpHashG1: mockUserOpHash,
        },
        {
          orderId: mockOrderID1,
          status: GxOrderStatus.COMPLETE,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.USD,
          quoteId: mockQuoteID,
          dateUSD: '2024-01-12T21:18:16.336Z',
          chainIdUSD: mockChainId,
          tokenAddressUSD: mockTokenAddress,
          tokenAmountUSD: mockValue,
          transactionHashUSD: mockTransactionHash,
          userOpHashUSD: mockUserOpHash,
        },
      ]);

      const res = await chai
        .request(app)
        .get('/v1/tge/status')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          quoteId: mockQuoteID,
        });

      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({
        quoteId: mockQuoteID,
        status: GxOrderStatus.COMPLETE,
        tokenAmountG1: '500.00',
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
        orderIdG1: mockOrderID,
        dateG1: '2024-01-12T21:18:16.336Z',
        transactionHashG1: mockTransactionHash,
        userOpHashG1: mockUserOpHash,
        orderIdUSD: mockOrderID1,
        dateUSD: '2024-01-12T21:18:16.336Z',
        chainIdUSD: mockChainId,
        tokenAddressUSD: mockTokenAddress,
        tokenAmountUSD: mockValue,
        transactionHashUSD: mockTransactionHash,
        userOpHashUSD: mockUserOpHash,
      });
    });

    it('Should global order status be SUCCESS when G1 is complete and USD is N/A', async function () {
      await collectionOrdersMock.insertMany([
        {
          orderId: mockOrderID,
          status: GxOrderStatus.COMPLETE,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.G1,
          quoteId: mockQuoteID,
          dateG1: '2024-01-12T21:18:16.336Z',
          transactionHashG1: mockTransactionHash,
          userOpHashG1: mockUserOpHash,
        },
      ]);

      const res = await chai
        .request(app)
        .get('/v1/tge/status')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          quoteId: mockQuoteID,
        });

      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({
        quoteId: mockQuoteID,
        status: GxOrderStatus.COMPLETE,
        tokenAmountG1: '500.00',
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
        orderIdG1: mockOrderID,
        dateG1: '2024-01-12T21:18:16.336Z',
        transactionHashG1: mockTransactionHash,
        userOpHashG1: mockUserOpHash,
        orderIdUSD: null,
        dateUSD: null,
        chainIdUSD: null,
        tokenAddressUSD: null,
        tokenAmountUSD: null,
        transactionHashUSD: null,
        userOpHashUSD: null,
      });
    });

    it('Should global order status be FAILED when G1 is complete and USD is failed', async function () {
      await collectionOrdersMock.insertMany([
        {
          orderId: mockOrderID,
          status: GxOrderStatus.COMPLETE,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.G1,
          quoteId: mockQuoteID,
          dateG1: '2024-01-12T21:18:16.336Z',
          transactionHashG1: mockTransactionHash,
          userOpHashG1: mockUserOpHash,
        },
        {
          orderId: mockOrderID1,
          status: GxOrderStatus.FAILURE_USD,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.USD,
          quoteId: mockQuoteID,
          dateUSD: '2024-01-12T21:18:16.336Z',
          chainIdUSD: mockChainId,
          tokenAddressUSD: mockTokenAddress,
          tokenAmountUSD: mockValue,
          transactionHashUSD: mockTransactionHash,
          userOpHashUSD: mockUserOpHash,
        },
      ]);

      const res = await chai
        .request(app)
        .get('/v1/tge/status')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          quoteId: mockQuoteID,
        });

      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({
        quoteId: mockQuoteID,
        status: GxOrderStatus.FAILURE_USD,
        tokenAmountG1: '500.00',
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
        orderIdG1: mockOrderID,
        dateG1: '2024-01-12T21:18:16.336Z',
        transactionHashG1: mockTransactionHash,
        userOpHashG1: mockUserOpHash,
        orderIdUSD: mockOrderID1,
        dateUSD: '2024-01-12T21:18:16.336Z',
        chainIdUSD: mockChainId,
        tokenAddressUSD: mockTokenAddress,
        tokenAmountUSD: mockValue,
        transactionHashUSD: mockTransactionHash,
        userOpHashUSD: mockUserOpHash,
      });
    });

    it('Should global order status be FAILED when G1 is failed and USD is complete', async function () {
      await collectionOrdersMock.insertMany([
        {
          orderId: mockOrderID,
          status: GxOrderStatus.FAILURE_G1,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.G1,
          quoteId: mockQuoteID,
          dateG1: '2024-01-12T21:18:16.336Z',
          transactionHashG1: mockTransactionHash,
          userOpHashG1: mockUserOpHash,
        },
        {
          orderId: mockOrderID1,
          status: GxOrderStatus.COMPLETE,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.USD,
          quoteId: mockQuoteID,
          dateUSD: '2024-01-12T21:18:16.336Z',
          chainIdUSD: mockChainId,
          tokenAddressUSD: mockTokenAddress,
          tokenAmountUSD: mockValue,
          transactionHashUSD: mockTransactionHash,
          userOpHashUSD: mockUserOpHash,
        },
      ]);

      const res = await chai
        .request(app)
        .get('/v1/tge/status')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          quoteId: mockQuoteID,
        });

      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({
        quoteId: mockQuoteID,
        status: GxOrderStatus.FAILURE_G1,
        tokenAmountG1: '500.00',
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
        orderIdG1: mockOrderID,
        dateG1: '2024-01-12T21:18:16.336Z',
        transactionHashG1: mockTransactionHash,
        userOpHashG1: mockUserOpHash,
        orderIdUSD: mockOrderID1,
        dateUSD: '2024-01-12T21:18:16.336Z',
        chainIdUSD: mockChainId,
        tokenAddressUSD: mockTokenAddress,
        tokenAmountUSD: mockValue,
        transactionHashUSD: mockTransactionHash,
        userOpHashUSD: mockUserOpHash,
      });
    });

    it('Should global order status be FAILED when G1 is failed and USD is failed', async function () {
      await collectionOrdersMock.insertMany([
        {
          orderId: mockOrderID,
          status: GxOrderStatus.FAILURE_G1,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.G1,
          quoteId: mockQuoteID,
          dateG1: '2024-01-12T21:18:16.336Z',
          transactionHashG1: mockTransactionHash,
          userOpHashG1: mockUserOpHash,
        },
        {
          orderId: mockOrderID1,
          status: GxOrderStatus.FAILURE_USD,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.USD,
          quoteId: mockQuoteID,
          dateUSD: '2024-01-12T21:18:16.336Z',
          chainIdUSD: mockChainId,
          tokenAddressUSD: mockTokenAddress,
          tokenAmountUSD: mockValue,
          transactionHashUSD: mockTransactionHash,
          userOpHashUSD: mockUserOpHash,
        },
      ]);

      const res = await chai
        .request(app)
        .get('/v1/tge/status')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          quoteId: mockQuoteID,
        });

      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({
        quoteId: mockQuoteID,
        status: GxOrderStatus.FAILURE_USD,
        tokenAmountG1: '500.00',
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
        orderIdG1: mockOrderID,
        dateG1: '2024-01-12T21:18:16.336Z',
        transactionHashG1: mockTransactionHash,
        userOpHashG1: mockUserOpHash,
        orderIdUSD: mockOrderID1,
        dateUSD: '2024-01-12T21:18:16.336Z',
        chainIdUSD: mockChainId,
        tokenAddressUSD: mockTokenAddress,
        tokenAmountUSD: mockValue,
        transactionHashUSD: mockTransactionHash,
        userOpHashUSD: mockUserOpHash,
      });
    });

    it('Should global order status be PENDING when G1 is pending and USD is complete', async function () {
      await collectionOrdersMock.insertMany([
        {
          orderId: mockOrderID,
          status: GxOrderStatus.PENDING,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.G1,
          quoteId: mockQuoteID,
          dateG1: '2024-01-12T21:18:16.336Z',
          transactionHashG1: mockTransactionHash,
          userOpHashG1: mockUserOpHash,
        },
        {
          orderId: mockOrderID1,
          status: GxOrderStatus.COMPLETE,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.USD,
          quoteId: mockQuoteID,
          dateUSD: '2024-01-12T21:18:16.336Z',
          chainIdUSD: mockChainId,
          tokenAddressUSD: mockTokenAddress,
          tokenAmountUSD: mockValue,
          transactionHashUSD: mockTransactionHash,
          userOpHashUSD: mockUserOpHash,
        },
      ]);

      const res = await chai
        .request(app)
        .get('/v1/tge/status')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          quoteId: mockQuoteID,
        });

      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({
        quoteId: mockQuoteID,
        status: GxOrderStatus.PENDING,
        tokenAmountG1: '500.00',
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
        orderIdG1: mockOrderID,
        dateG1: '2024-01-12T21:18:16.336Z',
        transactionHashG1: mockTransactionHash,
        userOpHashG1: mockUserOpHash,
        orderIdUSD: mockOrderID1,
        dateUSD: '2024-01-12T21:18:16.336Z',
        chainIdUSD: mockChainId,
        tokenAddressUSD: mockTokenAddress,
        tokenAmountUSD: mockValue,
        transactionHashUSD: mockTransactionHash,
        userOpHashUSD: mockUserOpHash,
      });
    });

    it('Should global order status be PENDING when G1 is complete and USD is pending', async function () {
      await collectionOrdersMock.insertMany([
        {
          orderId: mockOrderID,
          status: GxOrderStatus.COMPLETE,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.G1,
          quoteId: mockQuoteID,
          dateG1: '2024-01-12T21:18:16.336Z',
          transactionHashG1: mockTransactionHash,
          userOpHashG1: mockUserOpHash,
        },
        {
          orderId: mockOrderID1,
          status: GxOrderStatus.PENDING,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.USD,
          quoteId: mockQuoteID,
          dateUSD: '2024-01-12T21:18:16.336Z',
          chainIdUSD: mockChainId,
          tokenAddressUSD: mockTokenAddress,
          tokenAmountUSD: mockValue,
          transactionHashUSD: mockTransactionHash,
          userOpHashUSD: mockUserOpHash,
        },
      ]);

      const res = await chai
        .request(app)
        .get('/v1/tge/status')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          quoteId: mockQuoteID,
        });

      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({
        quoteId: mockQuoteID,
        status: GxOrderStatus.PENDING,
        tokenAmountG1: '500.00',
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
        orderIdG1: mockOrderID,
        dateG1: '2024-01-12T21:18:16.336Z',
        transactionHashG1: mockTransactionHash,
        userOpHashG1: mockUserOpHash,
        orderIdUSD: mockOrderID1,
        dateUSD: '2024-01-12T21:18:16.336Z',
        chainIdUSD: mockChainId,
        tokenAddressUSD: mockTokenAddress,
        tokenAmountUSD: mockValue,
        transactionHashUSD: mockTransactionHash,
        userOpHashUSD: mockUserOpHash,
      });
    });

    it('Should global order status be PENDING when G1 is pending and USD is pending', async function () {
      await collectionOrdersMock.insertMany([
        {
          orderId: mockOrderID,
          status: GxOrderStatus.PENDING,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.G1,
          quoteId: mockQuoteID,
          dateG1: '2024-01-12T21:18:16.336Z',
          transactionHashG1: mockTransactionHash,
          userOpHashG1: mockUserOpHash,
        },
        {
          orderId: mockOrderID1,
          status: GxOrderStatus.PENDING,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.USD,
          quoteId: mockQuoteID,
          dateUSD: '2024-01-12T21:18:16.336Z',
          chainIdUSD: mockChainId,
          tokenAddressUSD: mockTokenAddress,
          tokenAmountUSD: mockValue,
          transactionHashUSD: mockTransactionHash,
          userOpHashUSD: mockUserOpHash,
        },
      ]);

      const res = await chai
        .request(app)
        .get('/v1/tge/status')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          quoteId: mockQuoteID,
        });

      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({
        quoteId: mockQuoteID,
        status: GxOrderStatus.PENDING,
        tokenAmountG1: '500.00',
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
        orderIdG1: mockOrderID,
        dateG1: '2024-01-12T21:18:16.336Z',
        transactionHashG1: mockTransactionHash,
        userOpHashG1: mockUserOpHash,
        orderIdUSD: mockOrderID1,
        dateUSD: '2024-01-12T21:18:16.336Z',
        chainIdUSD: mockChainId,
        tokenAddressUSD: mockTokenAddress,
        tokenAmountUSD: mockValue,
        transactionHashUSD: mockTransactionHash,
        userOpHashUSD: mockUserOpHash,
      });
    });

    it('Should global order status be PENDING when G1 is complete and USD is waiting usd', async function () {
      await collectionOrdersMock.insertMany([
        {
          orderId: mockOrderID,
          status: GxOrderStatus.COMPLETE,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.G1,
          quoteId: mockQuoteID,
          dateG1: '2024-01-12T21:18:16.336Z',
          transactionHashG1: mockTransactionHash,
          userOpHashG1: mockUserOpHash,
        },
        {
          orderId: mockOrderID1,
          status: GxOrderStatus.WAITING_USD,
          userTelegramID: mockUserTelegramID,
          orderType: Ordertype.USD,
          quoteId: mockQuoteID,
          dateUSD: '2024-01-12T21:18:16.336Z',
          chainIdUSD: mockChainId,
          tokenAddressUSD: mockTokenAddress,
          tokenAmountUSD: mockValue,
          transactionHashUSD: mockTransactionHash,
          userOpHashUSD: mockUserOpHash,
        },
      ]);

      const res = await chai
        .request(app)
        .get('/v1/tge/status')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          quoteId: mockQuoteID,
        });

      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({
        quoteId: mockQuoteID,
        status: GxOrderStatus.PENDING,
        tokenAmountG1: '500.00',
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
        orderIdG1: mockOrderID,
        dateG1: '2024-01-12T21:18:16.336Z',
        transactionHashG1: mockTransactionHash,
        userOpHashG1: mockUserOpHash,
        orderIdUSD: mockOrderID1,
        dateUSD: '2024-01-12T21:18:16.336Z',
        chainIdUSD: mockChainId,
        tokenAddressUSD: mockTokenAddress,
        tokenAmountUSD: mockValue,
        transactionHashUSD: mockTransactionHash,
        userOpHashUSD: mockUserOpHash,
      });
    });
  });
});
