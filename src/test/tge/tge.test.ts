import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import Sinon from 'sinon';
import * as g1gx from '../../utils/g1gx';
import app from '../../index';
import { getApiKey } from '../../../secrets';
import {
  avax_address_polygon,
  getCollectionGXOrderMock,
  getCollectionGXQuoteMock,
  getCollectionUsersMock,
  isUUIDv4,
  mockAccessToken,
  mockChainId,
  mockChainName,
  mockOrderID,
  mockOrderID1,
  mockOrderID2,
  mockQuoteID,
  mockTokenAddress,
  mockTransactionHash,
  mockTransactionHash1,
  mockTransactionHash2,
  mockUserOpHash,
  mockUserOpHash1,
  mockUserOpHash2,
  mockUserTelegramID,
  mockUserTelegramID1,
  mockUserTelegramID2,
  mockValue,
  mockWallet,
} from '../utils';
import chaiExclude from 'chai-exclude';
import {
  PATCHWALLET_AUTH_URL,
  PATCHWALLET_RESOLVER_URL,
  PATCHWALLET_TX_STATUS_URL,
  PATCHWALLET_TX_URL,
  ANKR_MULTICHAIN_API_URL,
  Ordertype,
} from '../../utils/constants';
import axios from 'axios';
import { GxOrderStatus } from 'grindery-nexus-common-utils';

chai.use(chaiHttp);
chai.use(chaiExclude);

describe('G1 to GX util functions', async function () {
  let sandbox: Sinon.SinonSandbox;
  let collectionQuotesMock;
  let collectionOrdersMock;
  let axiosStub;

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
    sandbox
      .stub(g1gx, 'computeG1ToGxConversion')
      .callsFake((_usdQuantity, _g1Quantity, mvu) => {
        return {
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '1',
          usdFromG1Investment: '1',
          usdFromMvu: '1',
          usdFromTime: '1',
          equivalentUsdInvested: '1',
          gxBeforeMvu: '1',
          gxMvuEffect: mvu.toString(),
          gxTimeEffect: '1',
          GxUsdExchangeRate: '1',
          standardGxUsdExchangeRate: '1',
          discountReceived: '1',
          gxReceived: '1',
        };
      });

    axiosStub = sandbox.stub(axios, 'post').callsFake(async (url: string) => {
      if (url === PATCHWALLET_AUTH_URL) {
        return Promise.resolve({
          data: {
            access_token: mockAccessToken,
          },
        });
      }

      if (url === PATCHWALLET_TX_URL) {
        return Promise.resolve({
          data: {
            txHash: mockTransactionHash,
            userOpHash: mockUserOpHash,
          },
        });
      }

      if (url === PATCHWALLET_RESOLVER_URL) {
        return Promise.resolve({
          data: {
            users: [{ accountAddress: mockWallet }],
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
        userTelegramID: mockUserTelegramID,
        tokenAmountG1: '1000.00',
        usdFromUsdInvestment: '1',
        usdFromG1Investment: '1',
        usdFromMvu: '1',
        usdFromTime: '1',
        equivalentUsdInvested: '1',
        gxBeforeMvu: '1',
        gxMvuEffect: '5.03',
        gxTimeEffect: '1',
        GxUsdExchangeRate: '1',
        standardGxUsdExchangeRate: '1',
        discountReceived: '1',
        gxReceived: '1',
        tokenAmount: '10',
        chainId: mockChainId,
        tokenAddress: mockTokenAddress,
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
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '1',
            usdFromG1Investment: '1',
            usdFromMvu: '1',
            usdFromTime: '1',
            equivalentUsdInvested: '1',
            gxBeforeMvu: '1',
            gxMvuEffect: '5.03',
            gxTimeEffect: '1',
            GxUsdExchangeRate: '1',
            standardGxUsdExchangeRate: '1',
            discountReceived: '1',
            gxReceived: '1',
            userTelegramID: mockUserTelegramID,
            tokenAmount: '10',
            chainId: mockChainId,
            tokenAddress: mockTokenAddress,
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

  describe('Endpoint to catch the order status', async function () {
    beforeEach(async function () {
      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
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
          userTelegramID: mockUserTelegramID1,
        },
      ]);

      await collectionOrdersMock.insertOne({
        orderId: mockOrderID,
        status: GxOrderStatus.COMPLETE,
        quoteId: mockOrderID,
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
      });
    });

    it('Should return the order status if order ID is present in database', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          orderId: mockOrderID,
        });

      delete res.body.order._id;

      expect(res.body).to.deep.equal({
        order: {
          orderId: mockOrderID,
          status: GxOrderStatus.COMPLETE,
          quoteId: mockOrderID,
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
      });
    });

    it('Should return the quote if order ID is not present in database but quote is', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          orderId: mockOrderID1,
        });

      delete res.body.quote._id;

      expect(res.body).to.deep.equal({
        quote: {
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
          userTelegramID: mockUserTelegramID1,
        },
      });
    });

    it('Should return an empty result if order ID and quote ID are not present in database', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          orderId: 'another_order_ID',
        });

      expect(res.body).to.deep.equal({ msg: 'Order and quote not found' });
    });
  });

  describe('Endpoint to do preorder', async function () {
    beforeEach(async function () {
      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
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
        {
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '0',
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

    it('Should return an error message if no quote available for the given quote ID', async function () {
      const res = await chai
        .request(app)
        .post('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: 'non_existing_quote_id',
          userTelegramID: mockUserTelegramID,
        });

      expect(res.body).to.deep.equal({
        success: false,
        msg: 'No quote available for this ID',
      });
    });

    it('Should return an error message if provided Telegram ID is incorrect', async function () {
      const res = await chai
        .request(app)
        .post('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID,
          userTelegramID: 'incorrect_user_id',
        });

      expect(res.body).to.deep.equal({
        success: false,
        msg: 'Quote ID is not linked to the provided user Telegram ID',
      });
    });

    it('Should return an error message if order is pending', async function () {
      await collectionOrdersMock.insertOne({
        orderId: mockOrderID,
        status: GxOrderStatus.PENDING,
      });

      const res = await chai
        .request(app)
        .post('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID,
          userTelegramID: mockUserTelegramID,
        });

      expect(res.body).to.deep.equal({
        success: false,
        msg: 'This order is already being processed',
      });
    });

    it('Should return an error message if order is success', async function () {
      await collectionOrdersMock.insertOne({
        orderId: mockOrderID,
        status: GxOrderStatus.COMPLETE,
      });

      const res = await chai
        .request(app)
        .post('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID,
          userTelegramID: mockUserTelegramID,
        });

      expect(res.body).to.deep.equal({
        success: false,
        msg: 'This order is already being processed',
      });
    });

    it('Should call the sendTokens properly if order is not present in database', async function () {
      await chai
        .request(app)
        .post('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID,
          userTelegramID: mockUserTelegramID,
        });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: mockChainName,
        to: [mockTokenAddress],
        value: ['0x00'],
        data: [
          '0xa9059cbb0000000000000000000000006ef802abd3108411afe86656c9a369946aff590d00000000000000000000000000000000000000000000003635c9adc5dea00000',
        ],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should return the transaction hash if order is not present in database', async function () {
      const res = await chai
        .request(app)
        .post('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID,
          userTelegramID: mockUserTelegramID,
        });

      delete res.body.order.dateG1;

      expect(res.body).to.deep.equal({
        success: true,
        order: {
          orderId: mockOrderID,
          status: GxOrderStatus.WAITING_USD,
          transactionHashG1: mockTransactionHash,
          userOpHashG1: mockUserOpHash,
          quote: {
            quoteId: mockOrderID,
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
        },
      });
    });

    it('Should delete quote from database if order is not present in database', async function () {
      await chai
        .request(app)
        .post('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID,
          userTelegramID: mockUserTelegramID,
        });

      expect(await collectionQuotesMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '0',
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

    it('Should update the database with a waiting USD status if order is not present in database and USD amount is positive', async function () {
      await chai
        .request(app)
        .post('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID,
          userTelegramID: mockUserTelegramID,
        });

      const orders = await collectionOrdersMock.find({}).toArray();

      expect(orders)
        .excluding(['_id', 'dateG1'])
        .to.deep.equal([
          {
            transactionHashG1: mockTransactionHash,
            userOpHashG1: mockUserOpHash,
            userTelegramID: mockUserTelegramID,
            status: GxOrderStatus.WAITING_USD,
            orderId: mockOrderID,
            quoteId: mockOrderID,
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
          },
        ]);
    });

    it('Should update the database with a complete status if order is not present in database and USD amount is 0', async function () {
      await chai
        .request(app)
        .post('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID1,
          userTelegramID: mockUserTelegramID,
        });

      const orders = await collectionOrdersMock.find({}).toArray();

      expect(orders)
        .excluding(['_id', 'dateG1'])
        .to.deep.equal([
          {
            transactionHashG1: mockTransactionHash,
            userOpHashG1: mockUserOpHash,
            userTelegramID: mockUserTelegramID,
            status: GxOrderStatus.COMPLETE,
            orderId: mockOrderID1,
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '0',
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
          },
        ]);
    });

    it('Should update the database with a failure status if order is not present in database and failure in token transfer', async function () {
      axiosStub.withArgs(PATCHWALLET_TX_URL).rejects({
        response: {
          status: 470,
        },
      });

      const res = await chai
        .request(app)
        .post('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID1,
          userTelegramID: mockUserTelegramID,
        });

      const orders = await collectionOrdersMock.find({}).toArray();

      expect(orders)
        .excluding(['_id', 'dateG1'])
        .to.deep.equal([
          {
            userTelegramID: mockUserTelegramID,
            status: GxOrderStatus.FAILURE_G1,
            orderId: mockOrderID1,
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '0',
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
          },
        ]);

      expect(res.body.msg).to.be.equal('An error occurred');
    });
  });

  describe('Endpoint to make USD order for a user', async function () {
    beforeEach(async function () {
      await collectionOrdersMock.insertMany([
        {
          orderId: mockOrderID,
          dateG1: new Date(),
          status: GxOrderStatus.WAITING_USD,
          transactionHashG1: mockTransactionHash,
          userOpHashG1: mockUserOpHash,
          quoteId: mockOrderID,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '250.00',
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
          orderId: mockOrderID1,
          dateG1: new Date(),
          status: GxOrderStatus.FAILURE_G1,
          transactionHashG1: mockTransactionHash1,
          userOpHashG1: mockUserOpHash1,
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '600.00',
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
          userTelegramID: mockUserTelegramID1,
        },
        {
          orderId: mockOrderID2,
          dateG1: new Date(),
          status: GxOrderStatus.FAILURE_USD,
          transactionHashG1: mockTransactionHash2,
          userOpHashG1: mockUserOpHash2,
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '100.00',
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
        },
      ]);
    });

    it('Should return an error message if no quote available for the given quote ID', async function () {
      const res = await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          orderId: 'not_existing_order',
          userTelegramID: mockUserTelegramID,
          chainId: 'eip155:137',
          tokenAddress: avax_address_polygon,
        });

      expect(res.body).to.deep.equal({
        success: false,
        msg: 'No order available for this ID',
      });
    });

    it('Should return an error message if user Telegram ID is wrong', async function () {
      const res = await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          orderId: mockOrderID,
          userTelegramID: 'not_existing_user',
          chainId: 'eip155:137',
          tokenAddress: avax_address_polygon,
        });

      expect(res.body).to.deep.equal({
        success: false,
        msg: 'Order ID is not linked to the provided user Telegram ID',
      });
    });

    it('Should fail with a message if order status is not waiting_usd', async function () {
      const res = await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          orderId: mockOrderID1,
          userTelegramID: mockUserTelegramID1,
          chainId: 'eip155:137',
          tokenAddress: avax_address_polygon,
        });

      expect(res.body).to.deep.equal({
        msg: 'Status of the order is not ready to process USD payment',
      });
    });

    it('Should call the sendTokens properly if order is not present in database', async function () {
      await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          orderId: mockOrderID,
          userTelegramID: mockUserTelegramID,
          chainId: 'eip155:137',
          tokenAddress: avax_address_polygon,
        });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: 'matic',
        to: [avax_address_polygon],
        value: ['0x00'],
        data: [
          '0xa9059cbb0000000000000000000000006ef802abd3108411afe86656c9a369946aff590d0000000000000000000000000000000000000000000000015af1d78b58c40000',
        ],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should update the database with a complete status if everything is ok', async function () {
      await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          orderId: mockOrderID,
          userTelegramID: mockUserTelegramID,
          chainId: 'eip155:137',
          tokenAddress: avax_address_polygon,
        });
      const orders = await collectionOrdersMock.find({}).toArray();

      expect(orders)
        .excluding(['_id', 'dateG1', 'dateUSD'])
        .to.deep.equal([
          {
            orderId: mockOrderID,
            status: GxOrderStatus.COMPLETE,
            transactionHashG1: mockTransactionHash,
            userOpHashG1: mockUserOpHash,
            tokenAmountUSD: '25.00',
            tokenAddressUSD: avax_address_polygon,
            chainIdUSD: 'eip155:137',
            transactionHashUSD: mockTransactionHash,
            userOpHashUSD: mockUserOpHash,
            quoteId: mockOrderID,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '250.00',
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
            orderId: mockOrderID1,
            dateG1: new Date(),
            status: GxOrderStatus.FAILURE_G1,
            transactionHashG1: mockTransactionHash1,
            userOpHashG1: mockUserOpHash1,
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '600.00',
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
            userTelegramID: mockUserTelegramID1,
          },
          {
            orderId: mockOrderID2,
            dateG1: new Date(),
            status: GxOrderStatus.FAILURE_USD,
            transactionHashG1: mockTransactionHash2,
            userOpHashG1: mockUserOpHash2,
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '100.00',
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
          },
        ]);
    });

    it('Should return a proper payload if everything is ok', async function () {
      const res = await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          orderId: mockOrderID,
          userTelegramID: mockUserTelegramID,
          chainId: 'eip155:137',
          tokenAddress: avax_address_polygon,
        });

      delete res.body.order.dateG1;
      delete res.body.order.dateUSD;

      expect(res.body).to.deep.equal({
        success: true,
        order: {
          orderId: mockOrderID,
          status: GxOrderStatus.COMPLETE,
          transactionHashG1: mockTransactionHash,
          userOpHashG1: mockUserOpHash,
          tokenAmountUSD: '25.00',
          tokenAddressUSD: avax_address_polygon,
          chainIdUSD: 'eip155:137',
          transactionHashUSD: mockTransactionHash,
          userOpHashUSD: mockUserOpHash,
          quoteId: mockOrderID,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '250.00',
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
      });
    });

    it('Should allow USD payment is status is a failure USD before the call', async function () {
      const res = await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          orderId: mockOrderID2,
          userTelegramID: mockUserTelegramID2,
          chainId: 'eip155:137',
          tokenAddress: avax_address_polygon,
        });

      delete res.body.order.dateG1;
      delete res.body.order.dateUSD;

      expect(res.body).to.deep.equal({
        success: true,
        order: {
          orderId: mockOrderID2,
          status: GxOrderStatus.COMPLETE,
          tokenAmountUSD: '10.00',
          tokenAddressUSD: avax_address_polygon,
          chainIdUSD: 'eip155:137',
          transactionHashUSD: mockTransactionHash,
          userOpHashUSD: mockUserOpHash,
          transactionHashG1: mockTransactionHash2,
          userOpHashG1: mockUserOpHash2,
          quoteId: mockOrderID1,
          tokenAmountG1: '1000.00',
          usdFromUsdInvestment: '100.00',
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
        },
      });
    });

    it('Should update the database with a failure status if there is an error in ANKR API to get token price', async function () {
      axiosStub.withArgs(ANKR_MULTICHAIN_API_URL).rejects({
        response: {
          status: 400,
        },
      });

      const res = await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          orderId: mockOrderID,
          userTelegramID: mockUserTelegramID,
          chainId: 'eip155:137',
          tokenAddress: avax_address_polygon,
        });

      const orders = await collectionOrdersMock.find({}).toArray();

      expect(orders)
        .excluding(['_id', 'dateG1', 'dateUSD'])
        .to.deep.equal([
          {
            orderId: mockOrderID,
            status: GxOrderStatus.FAILURE_USD,
            transactionHashG1: mockTransactionHash,
            userOpHashG1: mockUserOpHash,
            quoteId: mockOrderID,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '250.00',
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
            orderId: mockOrderID1,
            dateG1: new Date(),
            status: GxOrderStatus.FAILURE_G1,
            transactionHashG1: mockTransactionHash1,
            userOpHashG1: mockUserOpHash1,
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '600.00',
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
            userTelegramID: mockUserTelegramID1,
          },
          {
            orderId: mockOrderID2,
            dateG1: new Date(),
            status: GxOrderStatus.FAILURE_USD,
            transactionHashG1: mockTransactionHash2,
            userOpHashG1: mockUserOpHash2,
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '100.00',
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
          },
        ]);

      expect(res.body)
        .excluding(['error'])
        .to.deep.equal({ success: false, msg: 'An error occurred' });
    });

    it('Should update the database with a failure status if order is not present in database and failure in token transfer', async function () {
      axiosStub.withArgs(PATCHWALLET_TX_URL).rejects({
        response: {
          status: 470,
        },
      });

      const res = await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          orderId: mockOrderID,
          userTelegramID: mockUserTelegramID,
          chainId: 'eip155:137',
          tokenAddress: avax_address_polygon,
        });

      const orders = await collectionOrdersMock.find({}).toArray();

      expect(orders)
        .excluding(['_id', 'dateG1', 'dateUSD'])
        .to.deep.equal([
          {
            orderId: mockOrderID,
            status: GxOrderStatus.FAILURE_USD,
            transactionHashG1: mockTransactionHash,
            userOpHashG1: mockUserOpHash,
            tokenAmountUSD: '25.00',
            tokenAddressUSD: avax_address_polygon,
            chainIdUSD: 'eip155:137',
            quoteId: mockOrderID,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '250.00',
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
            orderId: mockOrderID1,
            dateG1: new Date(),
            status: GxOrderStatus.FAILURE_G1,
            transactionHashG1: mockTransactionHash1,
            userOpHashG1: mockUserOpHash1,
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '600.00',
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
            userTelegramID: mockUserTelegramID1,
          },
          {
            orderId: mockOrderID2,
            dateG1: new Date(),
            status: GxOrderStatus.FAILURE_USD,
            transactionHashG1: mockTransactionHash2,
            userOpHashG1: mockUserOpHash2,
            quoteId: mockOrderID1,
            tokenAmountG1: '1000.00',
            usdFromUsdInvestment: '100.00',
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
          },
        ]);

      expect(res.body).excluding(['error']).to.deep.equal({
        success: false,
        msg: 'An error occurred',
      });
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

    it('Should return a 404 status if order is not found', async () => {
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

    it('Should global order status be SUCCESS when both G1 and USD orders are complete', async () => {
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

    it('Should global order status be SUCCESS when G1 is complete and USD is N/A', async () => {
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

    it('Should global order status be FAILED when G1 is complete and USD is failed', async () => {
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

    it('Should global order status be FAILED when G1 is failed and USD is complete', async () => {
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

    it('Should global order status be FAILED when G1 is failed and USD is failed', async () => {
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

    it('Should global order status be PENDING when G1 is pending and USD is complete', async () => {
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

    it('Should global order status be PENDING when G1 is complete and USD is pending', async () => {
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

    it('Should global order status be PENDING when G1 is pending and USD is pending', async () => {
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

    it('Should global order status be PENDING when G1 is complete and USD is waiting usd', async () => {
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
