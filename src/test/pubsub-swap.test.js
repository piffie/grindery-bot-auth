import chai from 'chai';
import { handleSwap } from '../utils/webhooks/swap.js';
import {
  collectionSwapsMock,
  collectionUsersMock,
  mockAccessToken,
  mockAmountIn,
  mockAmountOut,
  mockDataSwap,
  mockGas,
  mockPriceImpact,
  mockToSwap,
  mockTokenIn,
  mockTokenOut,
  mockTransactionHash,
  mockUserHandle,
  mockUserName,
  mockUserOpHash,
  mockUserTelegramID,
  mockUserTelegramID1,
  mockWallet,
  patchwalletAuthUrl,
  patchwalletTxUrl,
} from './utils.js';
import { v4 as uuidv4 } from 'uuid';
import Sinon from 'sinon';
import axios from 'axios';
import chaiExclude from 'chai-exclude';
import { TRANSACTION_STATUS } from '../utils/constants.js';
import 'dotenv/config';

chai.use(chaiExclude);

describe('handleSwap function', async function () {
  let sandbox;
  let axiosStub;
  let swapId;

  beforeEach(function () {
    sandbox = Sinon.createSandbox();
    axiosStub = sandbox
      .stub(axios, 'post')
      .callsFake(async (url, data, options) => {
        if (url === patchwalletAuthUrl) {
          return Promise.resolve({
            data: {
              access_token: mockAccessToken,
            },
          });
        }

        if (url === patchwalletTxUrl) {
          return Promise.resolve({
            data: {
              txHash: mockTransactionHash,
              userOpHash: mockUserOpHash,
            },
          });
        }

        if (url === process.env.FLOWXO_NEW_SWAP_WEBHOOK) {
          return Promise.resolve({
            result: 'success',
          });
        }
      });
    swapId = uuidv4();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('User does not exist', async function () {
    it('Should return false if User does not exist', async function () {
      const result = await handleSwap({
        eventId: swapId,
        userTelegramID: mockUserTelegramID1,
      });

      chai.expect(result).to.be.false;
    });

    it('Should not swap tokens', async function () {
      await handleSwap({
        eventId: swapId,
        userTelegramID: mockUserTelegramID1,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
      ).to.be.undefined;
    });

    it('Should not save swap in swaps collection', async function () {
      await handleSwap({
        eventId: swapId,
        userTelegramID: mockUserTelegramID1,
      });

      chai.expect(await collectionSwapsMock.find({}).toArray()).to.be.empty;
    });

    it('Should not notify FlowXO', async function () {
      await handleSwap({
        eventId: swapId,
        userTelegramID: mockUserTelegramID1,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === process.env.FLOWXO_NEW_SWAP_WEBHOOK)
      ).to.be.undefined;
    });
  });

  describe('Swap already exist', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
      });

      await collectionSwapsMock.insertOne({
        eventId: swapId,
        userTelegramID: mockUserTelegramID1,
        status: TRANSACTION_STATUS.SUCCESS,
      });
    });

    it('Should return true if swap exist with status SUCCESS', async function () {
      const result = await handleSwap({
        eventId: swapId,
        userTelegramID: mockUserTelegramID1,
      });

      chai.expect(result).to.be.true;
    });

    it('Should not swap tokens', async function () {
      await handleSwap({
        eventId: swapId,
        userTelegramID: mockUserTelegramID1,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
      ).to.be.undefined;
    });

    it('Should not save swap in swaps collection', async function () {
      await handleSwap({
        eventId: swapId,
        userTelegramID: mockUserTelegramID1,
      });

      chai
        .expect(await collectionSwapsMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: swapId,
            userTelegramID: mockUserTelegramID1,
            status: TRANSACTION_STATUS.SUCCESS,
          },
        ]);
    });

    it('Should not notify FlowXO', async function () {
      await handleSwap({
        eventId: swapId,
        userTelegramID: mockUserTelegramID1,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === process.env.FLOWXO_NEW_SWAP_WEBHOOK)
      ).to.be.undefined;
    });
  });

  describe('Swap does not exist', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        userName: mockUserName,
      });
    });

    it('Should swap tokens', async function () {
      await handleSwap({
        eventId: swapId,
        userTelegramID: mockUserTelegramID,
        to: mockToSwap,
        data: mockDataSwap,
      });

      chai
        .expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
            .args[1]
        )
        .to.deep.equal({
          userId: `grindery:${mockUserTelegramID}`,
          chain: 'matic',
          to: [mockToSwap],
          value: ['0x00'],
          data: [mockDataSwap],
          delegatecall: 1,
          auth: '',
        });
    });

    it('Should save swap in swaps collection', async function () {
      await handleSwap({
        eventId: swapId,
        userTelegramID: mockUserTelegramID,
        to: mockToSwap,
        data: mockDataSwap,
        userWallet: mockWallet,
        userName: mockUserName,
        userHandle: mockUserHandle,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
      });

      chai
        .expect(await collectionSwapsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            txId: mockTransactionHash.substring(1, 8),
            chainId: 'eip155:137',
            userTgId: mockUserTelegramID,
            userWallet: mockWallet,
            userName: mockUserName,
            userHandle: mockUserHandle,
            tokenIn: mockTokenIn,
            amountIn: mockAmountIn,
            tokenOut: mockTokenOut,
            amountOut: mockAmountOut,
            priceImpact: mockPriceImpact,
            gas: mockGas,
            status: TRANSACTION_STATUS.SUCCESS,
            transactionHash: mockTransactionHash,
            userOpHash: mockUserOpHash,
          },
        ]);
    });

    it('Should notify FlowXO', async function () {
      await handleSwap({
        eventId: swapId,
        userTelegramID: mockUserTelegramID,
        to: mockToSwap,
        data: mockDataSwap,
        userWallet: mockWallet,
        userName: mockUserName,
        userHandle: mockUserHandle,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
      });

      const FlowXOCallArgs = axiosStub
        .getCalls()
        .find((e) => e.firstArg === process.env.FLOWXO_NEW_SWAP_WEBHOOK)
        .args[1];

      console.log(FlowXOCallArgs);
      chai
        .expect(FlowXOCallArgs)
        .excluding(['dateAdded'])
        .to.deep.equal({
          txId: mockTransactionHash.substring(1, 8),
          chainId: 'eip155:137',
          userTgId: mockUserTelegramID,
          userWallet: mockWallet,
          userName: mockUserName,
          userHandle: mockUserHandle,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          status: TRANSACTION_STATUS.SUCCESS,
          transactionHash: mockTransactionHash,
          userOpHash: mockUserOpHash,
        });
    });

    it('Should return true', async function () {
      const result = await handleSwap({
        eventId: swapId,
        userTelegramID: mockUserTelegramID,
        to: mockToSwap,
        data: mockDataSwap,
        userWallet: mockWallet,
        userName: mockUserName,
        userHandle: mockUserHandle,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
      });

      chai.expect(result).to.be.true;
    });
  });
});
