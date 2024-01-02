import chai from 'chai';
import chaiHttp from 'chai-http';
import Sinon from 'sinon';
import * as g1gx from '../utils/g1gx';
import app from '../index';
import { getApiKey } from '../../secrets';
import {
  avax_address_polygon,
  getCollectionGXOrderMock,
  getCollectionGXQuoteMock,
  isUUIDv4,
  mockAccessToken,
  mockChainName,
  mockOrderID,
  mockOrderID1,
  mockTokenAddress,
  mockTransactionHash,
  mockTransactionHash1,
  mockUserOpHash,
  mockUserOpHash1,
  mockUserTelegramID,
  mockUserTelegramID1,
  mockWallet,
} from './utils';
import chaiExclude from 'chai-exclude';
import {
  PATCHWALLET_AUTH_URL,
  PATCHWALLET_RESOLVER_URL,
  PATCHWALLET_TX_STATUS_URL,
  PATCHWALLET_TX_URL,
  GX_ORDER_STATUS,
  ANKR_MULTICHAIN_API_URL,
} from '../utils/constants';
import axios from 'axios';

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

    sandbox = Sinon.createSandbox();
    sandbox.stub(g1gx, 'computeG1ToGxConversion').returns({
      tokenAmount_G1: '1000.00',
      usd_from_usd_investment: '1',
      usd_from_g1_holding: '1',
      usd_from_mvu: '1',
      usd_from_time: '1',
      equivalent_usd_invested: '1',
      gx_before_mvu: '1',
      gx_mvu_effect: '1',
      gx_time_effect: '1',
      equivalent_gx_usd_exchange_rate: '1',
      standard_gx_usd_exchange_rate: '1',
      discount_received: '1',
      gx_received: '1',
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
          usdQuantity: '10',
          g1Quantity: '4',
          userTelegramID: mockUserTelegramID,
        });

      chai.expect(isUUIDv4(res.body.quoteId)).to.be.true;

      delete res.body.date;
      delete res.body.quoteId;

      chai.expect(res.body).to.deep.equal({
        userTelegramID: mockUserTelegramID,
        tokenAmount_G1: '1000.00',
        usd_from_usd_investment: '1',
        usd_from_g1_holding: '1',
        usd_from_mvu: '1',
        usd_from_time: '1',
        equivalent_usd_invested: '1',
        gx_before_mvu: '1',
        gx_mvu_effect: '1',
        gx_time_effect: '1',
        equivalent_gx_usd_exchange_rate: '1',
        standard_gx_usd_exchange_rate: '1',
        discount_received: '1',
        gx_received: '1',
      });
    });

    it('Should fill the quote database with a quote ID and conversion informations', async function () {
      await chai
        .request(app)
        .get('/v1/tge/quote')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          usdQuantity: '10',
          g1Quantity: '4',
          userTelegramID: mockUserTelegramID,
        });

      const quotes = await collectionQuotesMock.find({}).toArray();

      chai
        .expect(quotes)
        .excluding(['_id', 'date', 'quoteId'])
        .to.deep.equal([
          {
            tokenAmount_G1: '1000.00',
            usd_from_usd_investment: '1',
            usd_from_g1_holding: '1',
            usd_from_mvu: '1',
            usd_from_time: '1',
            equivalent_usd_invested: '1',
            gx_before_mvu: '1',
            gx_mvu_effect: '1',
            gx_time_effect: '1',
            equivalent_gx_usd_exchange_rate: '1',
            standard_gx_usd_exchange_rate: '1',
            discount_received: '1',
            gx_received: '1',
            userTelegramID: mockUserTelegramID,
          },
        ]);

      chai.expect(isUUIDv4(quotes[0].quoteId)).to.be.true;
    });
  });

  describe('Endpoint to get quotes for a user', async function () {
    beforeEach(async function () {
      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmount_G1: '500.00',
          usd_from_usd_investment: '1',
          usd_from_g1_holding: '1',
          usd_from_mvu: '1',
          usd_from_time: '1',
          equivalent_usd_invested: '1',
          gx_before_mvu: '1',
          gx_mvu_effect: '1',
          gx_time_effect: '1',
          equivalent_gx_usd_exchange_rate: '1',
          standard_gx_usd_exchange_rate: '1',
          discount_received: '1',
          gx_received: '1',
          userTelegramID: mockUserTelegramID,
        },
        {
          quoteId: mockOrderID1,
          tokenAmount_G1: '1000.00',
          usd_from_usd_investment: '1',
          usd_from_g1_holding: '1',
          usd_from_mvu: '1',
          usd_from_time: '1',
          equivalent_usd_invested: '1',
          gx_before_mvu: '1',
          gx_mvu_effect: '1',
          gx_time_effect: '1',
          equivalent_gx_usd_exchange_rate: '1',
          standard_gx_usd_exchange_rate: '1',
          discount_received: '1',
          gx_received: '1',
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

      chai
        .expect(res.body)
        .excluding(['_id'])
        .to.deep.equal([
          {
            quoteId: mockOrderID,
            tokenAmount_G1: '500.00',
            usd_from_usd_investment: '1',
            usd_from_g1_holding: '1',
            usd_from_mvu: '1',
            usd_from_time: '1',
            equivalent_usd_invested: '1',
            gx_before_mvu: '1',
            gx_mvu_effect: '1',
            gx_time_effect: '1',
            equivalent_gx_usd_exchange_rate: '1',
            standard_gx_usd_exchange_rate: '1',
            discount_received: '1',
            gx_received: '1',
            userTelegramID: mockUserTelegramID,
          },
          {
            quoteId: mockOrderID1,
            tokenAmount_G1: '1000.00',
            usd_from_usd_investment: '1',
            usd_from_g1_holding: '1',
            usd_from_mvu: '1',
            usd_from_time: '1',
            equivalent_usd_invested: '1',
            gx_before_mvu: '1',
            gx_mvu_effect: '1',
            gx_time_effect: '1',
            equivalent_gx_usd_exchange_rate: '1',
            standard_gx_usd_exchange_rate: '1',
            discount_received: '1',
            gx_received: '1',
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

      chai.expect(res.body).to.be.empty;
    });
  });

  describe('Endpoint to get orders for a user', async function () {
    beforeEach(async function () {
      await collectionOrdersMock.insertMany([
        {
          orderId: mockOrderID,
          status: GX_ORDER_STATUS.COMPLETE,
          userTelegramID: mockUserTelegramID,
        },
        {
          orderId: mockOrderID1,
          status: GX_ORDER_STATUS.COMPLETE,
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

      chai
        .expect(res.body)
        .excluding(['_id'])
        .to.deep.equal([
          {
            orderId: mockOrderID,
            status: GX_ORDER_STATUS.COMPLETE,
            userTelegramID: mockUserTelegramID,
          },
          {
            orderId: mockOrderID1,
            status: GX_ORDER_STATUS.COMPLETE,
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

      chai.expect(res.body).to.be.empty;
    });
  });

  describe('Endpoint to catch the order status', async function () {
    beforeEach(async function () {
      await collectionQuotesMock.insertOne({
        quoteId: mockOrderID,
        tokenAmount_G1: '1000.00',
        usd_from_usd_investment: '1',
        usd_from_g1_holding: '1',
        usd_from_mvu: '1',
        usd_from_time: '1',
        equivalent_usd_invested: '1',
        gx_before_mvu: '1',
        gx_mvu_effect: '1',
        gx_time_effect: '1',
        equivalent_gx_usd_exchange_rate: '1',
        standard_gx_usd_exchange_rate: '1',
        discount_received: '1',
        gx_received: '1',
        userTelegramID: mockUserTelegramID,
      });

      await collectionOrdersMock.insertOne({
        orderId: mockOrderID,
        status: GX_ORDER_STATUS.COMPLETE,
      });
    });

    it('Should return the order status if orderId is present in database', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          orderId: mockOrderID,
        });

      chai.expect(res.body).excluding(['_id']).to.deep.equal({
        orderId: mockOrderID,
        status: GX_ORDER_STATUS.COMPLETE,
        quoteId: mockOrderID,
        tokenAmount_G1: '1000.00',
        usd_from_usd_investment: '1',
        usd_from_g1_holding: '1',
        usd_from_mvu: '1',
        usd_from_time: '1',
        equivalent_usd_invested: '1',
        gx_before_mvu: '1',
        gx_mvu_effect: '1',
        gx_time_effect: '1',
        equivalent_gx_usd_exchange_rate: '1',
        standard_gx_usd_exchange_rate: '1',
        discount_received: '1',
        gx_received: '1',
        userTelegramID: mockUserTelegramID,
      });
    });

    it('Should return an empty result if orderId is not present in database', async function () {
      const res = await chai
        .request(app)
        .get('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .query({
          orderId: 'another_order_ID',
        });

      chai.expect(res.body).to.deep.equal({ msg: 'Order or quote not found' });
    });
  });

  describe('Endpoint to do preorder', async function () {
    beforeEach(async function () {
      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmount_G1: '1000.00',
          usd_from_usd_investment: '1',
          usd_from_g1_holding: '1',
          usd_from_mvu: '1',
          usd_from_time: '1',
          equivalent_usd_invested: '1',
          gx_before_mvu: '1',
          gx_mvu_effect: '1',
          gx_time_effect: '1',
          equivalent_gx_usd_exchange_rate: '1',
          standard_gx_usd_exchange_rate: '1',
          discount_received: '1',
          gx_received: '1',
          userTelegramID: mockUserTelegramID,
        },
        {
          quoteId: mockOrderID1,
          tokenAmount_G1: '1000.00',
          usd_from_usd_investment: '0',
          usd_from_g1_holding: '1',
          usd_from_mvu: '1',
          usd_from_time: '1',
          equivalent_usd_invested: '1',
          gx_before_mvu: '1',
          gx_mvu_effect: '1',
          gx_time_effect: '1',
          equivalent_gx_usd_exchange_rate: '1',
          standard_gx_usd_exchange_rate: '1',
          discount_received: '1',
          gx_received: '1',
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

      chai.expect(res.body).to.deep.equal({
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

      chai.expect(res.body).to.deep.equal({
        success: false,
        msg: 'Quote ID is not linked to the provided user Telegram ID',
      });
    });

    it('Should return an error message if order is pending', async function () {
      await collectionOrdersMock.insertOne({
        orderId: mockOrderID,
        status: GX_ORDER_STATUS.PENDING,
      });

      const res = await chai
        .request(app)
        .post('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID,
          userTelegramID: mockUserTelegramID,
        });

      chai.expect(res.body).to.deep.equal({
        success: false,
        msg: 'This order is already being processed',
      });
    });

    it('Should return an error message if order is success', async function () {
      await collectionOrdersMock.insertOne({
        orderId: mockOrderID,
        status: GX_ORDER_STATUS.COMPLETE,
      });

      const res = await chai
        .request(app)
        .post('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID,
          userTelegramID: mockUserTelegramID,
        });

      chai.expect(res.body).to.deep.equal({
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

      chai
        .expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
            .args[1],
        )
        .to.deep.equal({
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

      delete res.body.order.date;

      chai.expect(res.body).to.deep.equal({
        success: true,
        order: {
          orderId: mockOrderID,
          status: GX_ORDER_STATUS.WAITING_USD,
          userTelegramID: mockUserTelegramID,
          tokenAmount_G1: '1000.00',
          transactionHash_G1: mockTransactionHash,
          userOpHash_G1: mockUserOpHash,
        },
      });
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

      chai
        .expect(orders)
        .excluding(['_id', 'date'])
        .to.deep.equal([
          {
            transactionHash_G1: mockTransactionHash,
            userOpHash_G1: mockUserOpHash,
            userTelegramID: mockUserTelegramID,
            status: GX_ORDER_STATUS.WAITING_USD,
            tokenAmount_G1: '1000.00',
            orderId: mockOrderID,
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

      chai
        .expect(orders)
        .excluding(['_id', 'date'])
        .to.deep.equal([
          {
            transactionHash_G1: mockTransactionHash,
            userOpHash_G1: mockUserOpHash,
            userTelegramID: mockUserTelegramID,
            status: GX_ORDER_STATUS.COMPLETE,
            tokenAmount_G1: '1000.00',
            orderId: mockOrderID1,
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

      chai
        .expect(orders)
        .excluding(['_id', 'date'])
        .to.deep.equal([
          {
            userTelegramID: mockUserTelegramID,
            status: GX_ORDER_STATUS.FAILURE_G1,
            tokenAmount_G1: '1000.00',
            orderId: mockOrderID1,
          },
        ]);

      chai.expect(res.body.msg).to.be.equal('An error occurred');
    });
  });

  describe('Endpoint to make USD order for a user', async function () {
    beforeEach(async function () {
      await collectionQuotesMock.insertMany([
        {
          quoteId: mockOrderID,
          tokenAmount_G1: '1000.00',
          usd_from_usd_investment: '250.00',
          usd_from_g1_holding: '1',
          usd_from_mvu: '1',
          usd_from_time: '1',
          equivalent_usd_invested: '1',
          gx_before_mvu: '1',
          gx_mvu_effect: '1',
          gx_time_effect: '1',
          equivalent_gx_usd_exchange_rate: '1',
          standard_gx_usd_exchange_rate: '1',
          discount_received: '1',
          gx_received: '1',
          userTelegramID: mockUserTelegramID,
        },
        {
          quoteId: mockOrderID1,
          tokenAmount_G1: '1000.00',
          usd_from_usd_investment: '600.00',
          usd_from_g1_holding: '1',
          usd_from_mvu: '1',
          usd_from_time: '1',
          equivalent_usd_invested: '1',
          gx_before_mvu: '1',
          gx_mvu_effect: '1',
          gx_time_effect: '1',
          equivalent_gx_usd_exchange_rate: '1',
          standard_gx_usd_exchange_rate: '1',
          discount_received: '1',
          gx_received: '1',
          userTelegramID: mockUserTelegramID1,
        },
      ]);

      await collectionOrdersMock.insertMany([
        {
          orderId: mockOrderID,
          date: new Date(),
          status: GX_ORDER_STATUS.WAITING_USD,
          userTelegramID: mockUserTelegramID,
          tokenAmount_G1: '1000.00',
          transactionHash_G1: mockTransactionHash,
          userOpHash_G1: mockUserOpHash,
        },
        {
          orderId: mockOrderID1,
          date: new Date(),
          status: GX_ORDER_STATUS.FAILURE_G1,
          userTelegramID: mockUserTelegramID1,
          tokenAmount_G1: '500.00',
          transactionHash_G1: mockTransactionHash1,
          userOpHash_G1: mockUserOpHash1,
        },
      ]);
    });

    it('Should return an error message if no quote available for the given quote ID', async function () {
      const res = await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: 'not_existing_quote',
          userTelegramID: mockUserTelegramID,
          chainId: 'eip155:137',
          token_address: avax_address_polygon,
        });

      chai.expect(res.body).to.deep.equal({
        success: false,
        msg: 'No quote available for this ID',
      });
    });

    it('Should return an error message if user Telegram ID is wrong', async function () {
      const res = await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID,
          userTelegramID: 'not_existing_user',
          chainId: 'eip155:137',
          token_address: avax_address_polygon,
        });

      chai.expect(res.body).to.deep.equal({
        success: false,
        msg: 'Quote ID is not linked to the provided user Telegram ID',
      });
    });

    it('Should fail with a message if order status is not waiting_usd', async function () {
      const res = await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID1,
          userTelegramID: mockUserTelegramID1,
          chainId: 'eip155:137',
          token_address: avax_address_polygon,
        });

      chai.expect(res.body).to.deep.equal({
        msg: 'Status of the order is not ready to process USD payment',
      });
    });

    it('Should call the sendTokens properly if order is not present in database', async function () {
      await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID,
          userTelegramID: mockUserTelegramID,
          chainId: 'eip155:137',
          token_address: avax_address_polygon,
        });

      chai
        .expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
            .args[1],
        )
        .to.deep.equal({
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
          quoteId: mockOrderID,
          userTelegramID: mockUserTelegramID,
          chainId: 'eip155:137',
          token_address: avax_address_polygon,
        });
      const orders = await collectionOrdersMock.find({}).toArray();

      chai
        .expect(orders)
        .excluding(['_id', 'date', 'dateUSD'])
        .to.deep.equal([
          {
            orderId: mockOrderID,
            status: GX_ORDER_STATUS.COMPLETE,
            userTelegramID: mockUserTelegramID,
            tokenAmount_G1: '1000.00',
            transactionHash_G1: mockTransactionHash,
            userOpHash_G1: mockUserOpHash,
            amount_USD: '250.00',
            tokenAmount_USD: '25.00',
            tokenAddress_USD: avax_address_polygon,
            chainId_USD: 'eip155:137',
            transactionHash_USD: mockTransactionHash,
            userOpHash_USD: mockUserOpHash,
          },
          {
            orderId: mockOrderID1,
            status: GX_ORDER_STATUS.FAILURE_G1,
            userTelegramID: mockUserTelegramID1,
            tokenAmount_G1: '500.00',
            transactionHash_G1: mockTransactionHash1,
            userOpHash_G1: mockUserOpHash1,
          },
        ]);
    });

    it('Should return a proper payload if everything is ok', async function () {
      const res = await chai
        .request(app)
        .patch('/v1/tge/order')
        .set('Authorization', `Bearer ${await getApiKey()}`)
        .send({
          quoteId: mockOrderID,
          userTelegramID: mockUserTelegramID,
          chainId: 'eip155:137',
          token_address: avax_address_polygon,
        });

      delete res.body.order.dateUSD;

      chai.expect(res.body).to.deep.equal({
        success: true,
        order: {
          orderId: mockOrderID,
          status: GX_ORDER_STATUS.COMPLETE,
          userTelegramID: mockUserTelegramID,
          transactionHash_USD: mockTransactionHash,
          userOpHash_USD: mockUserOpHash,
          amount_USD: '250.00',
          tokenAmount_USD: '25.00',
          tokenAddress_USD: avax_address_polygon,
          chainId_USD: 'eip155:137',
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
          quoteId: mockOrderID,
          userTelegramID: mockUserTelegramID,
          chainId: 'eip155:137',
          token_address: avax_address_polygon,
        });

      const orders = await collectionOrdersMock.find({}).toArray();

      chai
        .expect(orders)
        .excluding(['_id', 'date', 'dateUSD'])
        .to.deep.equal([
          {
            orderId: mockOrderID,
            status: GX_ORDER_STATUS.FAILURE_USD,
            userTelegramID: mockUserTelegramID,
            tokenAmount_G1: '1000.00',
            transactionHash_G1: mockTransactionHash,
            userOpHash_G1: mockUserOpHash,
          },
          {
            orderId: mockOrderID1,
            status: GX_ORDER_STATUS.FAILURE_G1,
            userTelegramID: mockUserTelegramID1,
            tokenAmount_G1: '500.00',
            transactionHash_G1: mockTransactionHash1,
            userOpHash_G1: mockUserOpHash1,
          },
        ]);

      chai
        .expect(res.body)
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
          quoteId: mockOrderID,
          userTelegramID: mockUserTelegramID,
          chainId: 'eip155:137',
          token_address: avax_address_polygon,
        });

      const orders = await collectionOrdersMock.find({}).toArray();

      chai
        .expect(orders)
        .excluding(['_id', 'date', 'dateUSD'])
        .to.deep.equal([
          {
            orderId: mockOrderID,
            status: GX_ORDER_STATUS.FAILURE_USD,
            userTelegramID: mockUserTelegramID,
            tokenAmount_G1: '1000.00',
            transactionHash_G1: mockTransactionHash,
            userOpHash_G1: mockUserOpHash,
            amount_USD: '250.00',
            tokenAmount_USD: '25.00',
            tokenAddress_USD: avax_address_polygon,
            chainId_USD: 'eip155:137',
          },
          {
            orderId: mockOrderID1,
            status: GX_ORDER_STATUS.FAILURE_G1,
            userTelegramID: mockUserTelegramID1,
            tokenAmount_G1: '500.00',
            transactionHash_G1: mockTransactionHash1,
            userOpHash_G1: mockUserOpHash1,
          },
        ]);

      chai.expect(res.body).excluding(['error']).to.deep.equal({
        success: false,
        msg: 'An error occurred',
      });
    });
  });
});
