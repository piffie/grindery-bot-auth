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
  mockToSwap,
  mockDataSwap,
  mockTokenIn,
  mockAmountIn,
  mockTokenOut,
  mockAmountOut,
  mockPriceImpact,
  mockGas,
  mockFromSwap,
  mockTokenInSymbol,
  mockTokenOutSymbol,
  mockChainId,
  getCollectionUsersMock,
  getCollectionSwapsMock,
  mockValue,
  mockEventId,
} from '../utils';
import Sinon from 'sinon';
import axios from 'axios';
import * as web3 from '../../utils/web3';
import chaiExclude from 'chai-exclude';
import {
  FLOWXO_NEW_SWAP_WEBHOOK,
  PATCHWALLET_AUTH_URL,
  PATCHWALLET_RESOLVER_URL,
  PATCHWALLET_TX_STATUS_URL,
  PATCHWALLET_TX_URL,
  SEGMENT_TRACK_URL,
} from '../../utils/constants';
import { handleSwap } from '../../webhooks/swap';
import { FLOWXO_WEBHOOK_API_KEY } from '../../../secrets';
import { CHAIN_MAPPING } from '../../utils/chains';
import { ContractStub } from '../../types/tests.types';
import { TransactionStatus } from 'grindery-nexus-common-utils';

chai.use(chaiExclude);

describe('handleSwap function', async function () {
  let sandbox: Sinon.SinonSandbox;
  let axiosStub;
  let collectionUsersMock;
  let collectionSwapsMock;

  beforeEach(async function () {
    collectionUsersMock = await getCollectionUsersMock();
    collectionSwapsMock = await getCollectionSwapsMock();

    sandbox = Sinon.createSandbox();
    axiosStub = sandbox.stub(axios, 'post').callsFake(async (url: string) => {
      if (url === PATCHWALLET_RESOLVER_URL) {
        return Promise.resolve({
          data: {
            users: [{ accountAddress: mockWallet }],
          },
        });
      }

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

      if (url == FLOWXO_NEW_SWAP_WEBHOOK) {
        return Promise.resolve({
          result: 'success',
        });
      }

      if (url == SEGMENT_TRACK_URL) {
        return Promise.resolve({
          result: 'success',
        });
      }

      throw new Error('Unexpected URL encountered');
    });
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('Normal process to handle a swap', async function () {
    let contractStub: ContractStub;
    let getContract;

    beforeEach(async function () {
      contractStub = {
        methods: {
          decimals: sandbox.stub().resolves('18'),
        },
      };
      contractStub.methods.decimals = sandbox.stub().returns({
        call: sandbox.stub().resolves('18'),
      });
      getContract = () => {
        return contractStub;
      };
      sandbox.stub(web3, 'getContract').callsFake(getContract);

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });
    });

    it('Should return true', async function () {
      expect(
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          to: mockToSwap,
          data: mockDataSwap,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        }),
      ).to.be.true;
    });

    it('Should populate swaps database', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        to: mockToSwap,
        data: mockDataSwap,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
        chainIn: mockChainId,
        chainOut: mockChainId,
      });

      const swaps = await collectionSwapsMock.find({}).toArray();

      expect(swaps)
        .excluding(['dateAdded', '_id'])
        .to.deep.equal([
          {
            eventId: mockEventId,
            userTelegramID: mockUserTelegramID,
            userWallet: mockWallet,
            userName: mockUserName,
            userHandle: mockUserHandle,
            tokenIn: mockTokenIn,
            amountIn: mockAmountIn,
            tokenOut: mockTokenOut,
            amountOut: mockAmountOut,
            priceImpact: mockPriceImpact,
            gas: mockGas,
            from: mockFromSwap,
            tokenInSymbol: mockTokenInSymbol,
            tokenOutSymbol: mockTokenOutSymbol,
            status: TransactionStatus.SUCCESS,
            transactionHash: mockTransactionHash,
            to: mockToSwap,
            userOpHash: null,
            chainIn: mockChainId,
            chainOut: mockChainId,
          },
        ]);
      expect(swaps[0].dateAdded).to.be.a('date');
    });

    it('Should populate the segment swap properly', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        to: mockToSwap,
        data: mockDataSwap,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
        chainIn: mockChainId,
        chainOut: mockChainId,
      });

      const segmentIdentityCall = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === SEGMENT_TRACK_URL);

      expect(segmentIdentityCall[0].args[1])
        .excluding(['timestamp'])
        .to.deep.equal({
          userId: mockUserTelegramID,
          event: 'Swap',
          properties: {
            eventId: mockEventId,
            userTelegramID: mockUserTelegramID,
            tokenIn: mockTokenIn,
            amountIn: mockAmountIn,
            tokenOut: mockTokenOut,
            amountOut: mockAmountOut,
            priceImpact: mockPriceImpact,
            gas: mockGas,
            to: mockToSwap,
            from: mockFromSwap,
            tokenInSymbol: mockTokenInSymbol,
            tokenOutSymbol: mockTokenOutSymbol,
            status: TransactionStatus.SUCCESS,
            transactionHash: mockTransactionHash,
            chainIn: mockChainId,
            chainOut: mockChainId,
          },
        });
    });

    it('Should call FlowXO webhook properly for new swaps', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: '1000000000000000000',
        tokenOut: mockTokenOut,
        amountOut: '1000000000000000000',
        priceImpact: mockPriceImpact,
        gas: mockGas,
        to: mockToSwap,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
        chainIn: mockChainId,
        chainOut: mockChainId,
      });

      const FlowXOCallArgs = axiosStub
        .getCalls()
        .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK).args[1];

      expect(FlowXOCallArgs)
        .excluding(['dateAdded'])
        .to.deep.equal({
          userResponsePath: mockResponsePath,
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          userWallet: mockWallet,
          tokenIn: mockTokenIn,
          amountIn: '1',
          tokenOut: mockTokenOut,
          amountOut: '1',
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
          status: TransactionStatus.SUCCESS,
          transactionHash: mockTransactionHash,
          apiKey: FLOWXO_WEBHOOK_API_KEY,
          chainIn: mockChainId,
          chainOut: mockChainId,
          chainInName: 'Polygon',
          chainOutName: 'Polygon',
          transactionLink:
            CHAIN_MAPPING[mockChainId].explorer + mockTransactionHash,
        });
    });

    it('Should call the swapTokens function properly', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        chainIn: 'eip155:59144',
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        to: mockToSwap,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
        data: '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000000000000000000064',
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: 'linea',
        to: [mockToSwap],
        value: [mockValue],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000000000000000000064',
        ],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should call the swapTokens function with delegate call if specified', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        chainIn: 'eip155:59144',
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        to: mockToSwap,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
        data: '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000000000000000000064',
        delegatecall: 1,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: 'linea',
        to: [mockToSwap],
        value: [mockValue],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000000000000000000064',
        ],
        delegatecall: 1,
        auth: '',
      });
    });
  });

  describe('Swap is already a success', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionSwapsMock.insertOne({
        eventId: mockEventId,
        status: TransactionStatus.SUCCESS,
      });
    });

    it('Should return true if swap is already a success', async function () {
      expect(
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        }),
      ).to.be.true;
    });

    it('Should not swap token if swap is already a success', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if swap is already a success', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(await collectionSwapsMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: mockEventId,
            status: TransactionStatus.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO if swap is already a success', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if swap is already a success', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  describe('Transaction if swap is already a failure', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionSwapsMock.insertOne({
        eventId: mockEventId,
        status: TransactionStatus.FAILURE,
      });
    });

    it('Should return true if swap is already a failure', async function () {
      expect(
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        }),
      ).to.be.true;
    });

    it('Should not swap if swap if is already a failure', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if swap is already a failure', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(await collectionSwapsMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: mockEventId,
            status: TransactionStatus.FAILURE,
          },
        ]);
    });

    it('Should not call FlowXO if swap is already a failure', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if swap is already a failure', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  describe('Transaction if swap is already a failure 503', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionSwapsMock.insertOne({
        eventId: mockEventId,
        status: TransactionStatus.FAILURE_503,
      });
    });

    it('Should return true if swap is already a failure', async function () {
      expect(
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        }),
      ).to.be.true;
    });

    it('Should not swap if swap if is already a failure', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if swap is already a failure', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(await collectionSwapsMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: mockEventId,
            status: TransactionStatus.FAILURE_503,
          },
        ]);
    });

    it('Should not call FlowXO if swap is already a failure', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if swap is already a failure', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  describe('Error in swap token request', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
        data: {
          error: 'service non available',
        },
      });
    });

    it('Should return false if there is an error in the swap tokens request', async function () {
      const result = await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(result).to.be.false;
    });

    it('Should not modify transaction status in the database if there is an error in the swap tokens request', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        to: mockToSwap,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
        chainIn: mockChainId,
        chainOut: mockChainId,
      });

      expect(await collectionSwapsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            userTelegramID: mockUserTelegramID,
            tokenIn: mockTokenIn,
            amountIn: mockAmountIn,
            tokenOut: mockTokenOut,
            amountOut: mockAmountOut,
            priceImpact: mockPriceImpact,
            gas: mockGas,
            to: mockToSwap,
            from: mockFromSwap,
            tokenInSymbol: mockTokenInSymbol,
            tokenOutSymbol: mockTokenOutSymbol,
            eventId: mockEventId,
            status: TransactionStatus.PENDING,
            transactionHash: null,
            userHandle: mockUserHandle,
            userName: mockUserName,
            userOpHash: null,
            userWallet: mockWallet,
            chainIn: mockChainId,
            chainOut: mockChainId,
          },
        ]);
    });

    it('Should not call FlowXO if there is an error in the swap tokens request', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if there is an error in the swap tokens request', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });
      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  it('Should not add new swap if one with the same eventId already exists', async function () {
    await collectionSwapsMock.insertOne({
      eventId: mockEventId,
    });

    const objectId = (
      await collectionSwapsMock.findOne({
        eventId: mockEventId,
      })
    )._id.toString();

    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
      userName: mockUserName,
      userHandle: mockUserHandle,
      patchwallet: mockWallet,
    });

    await handleSwap({
      value: mockAmountIn,
      eventId: mockEventId,

      userTelegramID: mockUserTelegramID,
      tokenIn: mockTokenIn,
      amountIn: mockAmountIn,
      tokenOut: mockTokenOut,
      amountOut: mockAmountOut,
      priceImpact: mockPriceImpact,
      gas: mockGas,
      from: mockFromSwap,
      tokenInSymbol: mockTokenInSymbol,
      tokenOutSymbol: mockTokenOutSymbol,
    });

    expect(
      (await collectionSwapsMock.find({}).toArray())[0]._id.toString(),
    ).to.equal(objectId);
  });

  describe('Sender is not a user', async function () {
    it('Should return true if sender is not a user', async function () {
      const result = await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(result).to.be.true;
    });

    it('Should not save swap in database if sender is not a user', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(await collectionSwapsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([]);
    });

    it('Should not swap tokens if sender is not a user', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not call FlowXO if sender is not a user', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if sender is not a user', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  describe('Error in PatchWallet transaction', async function () {
    beforeEach(async function () {
      axiosStub
        .withArgs(PATCHWALLET_TX_URL)
        .rejects(new Error('Service not available'));

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });
    });

    it('Should return false if error in PatchWallet transaction', async function () {
      const result = await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(result).to.be.false;
    });

    it('Should not modify database if error in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        to: mockToSwap,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
        chainIn: mockChainId,
        chainOut: mockChainId,
      });

      expect(await collectionSwapsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            userTelegramID: mockUserTelegramID,
            tokenIn: mockTokenIn,
            amountIn: mockAmountIn,
            tokenOut: mockTokenOut,
            amountOut: mockAmountOut,
            priceImpact: mockPriceImpact,
            gas: mockGas,
            to: mockToSwap,
            from: mockFromSwap,
            tokenInSymbol: mockTokenInSymbol,
            tokenOutSymbol: mockTokenOutSymbol,
            eventId: mockEventId,
            status: TransactionStatus.PENDING,
            transactionHash: null,
            userOpHash: null,
            userHandle: mockUserHandle,
            userName: mockUserName,
            userWallet: mockWallet,
            chainIn: mockChainId,
            chainOut: mockChainId,
          },
        ]);
    });

    it('Should not call FlowXO if error in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if error in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  describe('PatchWallet 470 error', async function () {
    beforeEach(async function () {
      axiosStub.withArgs(PATCHWALLET_TX_URL).rejects({
        response: {
          status: 470,
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

    it('Should return true if error 470 in PatchWallet transaction', async function () {
      const result = await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(result).to.be.true;
    });

    it('Should complete db status to failure in database if error 470 in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        to: mockToSwap,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
        chainIn: mockChainId,
        chainOut: mockChainId,
      });

      expect(await collectionSwapsMock.find({}).toArray())
        .excluding(['dateAdded', '_id'])
        .to.deep.equal([
          {
            userTelegramID: mockUserTelegramID,
            userName: mockUserName,
            userHandle: mockUserHandle,
            userWallet: mockWallet,
            tokenIn: mockTokenIn,
            amountIn: mockAmountIn,
            tokenOut: mockTokenOut,
            amountOut: mockAmountOut,
            priceImpact: mockPriceImpact,
            gas: mockGas,
            to: mockToSwap,
            from: mockFromSwap,
            tokenInSymbol: mockTokenInSymbol,
            tokenOutSymbol: mockTokenOutSymbol,
            eventId: mockEventId,
            status: TransactionStatus.FAILURE,
            transactionHash: null,
            userOpHash: null,
            chainIn: mockChainId,
            chainOut: mockChainId,
          },
        ]);
    });

    it('Should not call FlowXO if error 470 in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if error 470 in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  describe('PatchWallet 503 error', async function () {
    beforeEach(async function () {
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
      const result = await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,

        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(result).to.be.true;
    });

    it('Should complete db status to failure in database if error 503 in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        to: mockToSwap,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
        chainIn: mockChainId,
        chainOut: mockChainId,
      });

      expect(await collectionSwapsMock.find({}).toArray())
        .excluding(['dateAdded', '_id'])
        .to.deep.equal([
          {
            userTelegramID: mockUserTelegramID,
            userName: mockUserName,
            userHandle: mockUserHandle,
            userWallet: mockWallet,
            tokenIn: mockTokenIn,
            amountIn: mockAmountIn,
            tokenOut: mockTokenOut,
            amountOut: mockAmountOut,
            priceImpact: mockPriceImpact,
            gas: mockGas,
            to: mockToSwap,
            from: mockFromSwap,
            tokenInSymbol: mockTokenInSymbol,
            tokenOutSymbol: mockTokenOutSymbol,
            eventId: mockEventId,
            status: TransactionStatus.FAILURE_503,
            transactionHash: null,
            userOpHash: null,
            chainIn: mockChainId,
            chainOut: mockChainId,
          },
        ]);
    });

    it('Should not call FlowXO if error 503 in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if error 503 in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  describe('PatchWallet 400 error', async function () {
    beforeEach(async function () {
      axiosStub.withArgs(PATCHWALLET_TX_URL).rejects({
        response: {
          status: 400,
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

    it('Should return true if error 400 in PatchWallet transaction', async function () {
      const result = await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(result).to.be.true;
    });

    it('Should complete db status to failure in database if error 400 in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        to: mockToSwap,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
        chainIn: mockChainId,
        chainOut: mockChainId,
      });

      expect(await collectionSwapsMock.find({}).toArray())
        .excluding(['dateAdded', '_id'])
        .to.deep.equal([
          {
            userTelegramID: mockUserTelegramID,
            userName: mockUserName,
            userHandle: mockUserHandle,
            userWallet: mockWallet,
            tokenIn: mockTokenIn,
            amountIn: mockAmountIn,
            tokenOut: mockTokenOut,
            amountOut: mockAmountOut,
            priceImpact: mockPriceImpact,
            gas: mockGas,
            to: mockToSwap,
            from: mockFromSwap,
            tokenInSymbol: mockTokenInSymbol,
            tokenOutSymbol: mockTokenOutSymbol,
            eventId: mockEventId,
            status: TransactionStatus.FAILURE,
            transactionHash: null,
            userOpHash: null,
            chainIn: mockChainId,
            chainOut: mockChainId,
          },
        ]);
    });

    it('Should not call FlowXO if error 400 in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if error 400 in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  describe('No hash in PatchWallet transaction', async function () {
    beforeEach(async function () {
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
      const result = await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(result).to.be.false;
    });

    it('Should do no swap status modification in database if no hash in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        to: mockToSwap,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
        chainIn: mockChainId,
        chainOut: mockChainId,
      });

      expect(await collectionSwapsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            userTelegramID: mockUserTelegramID,
            tokenIn: mockTokenIn,
            amountIn: mockAmountIn,
            tokenOut: mockTokenOut,
            amountOut: mockAmountOut,
            priceImpact: mockPriceImpact,
            gas: mockGas,
            to: mockToSwap,
            from: mockFromSwap,
            tokenInSymbol: mockTokenInSymbol,
            tokenOutSymbol: mockTokenOutSymbol,
            eventId: mockEventId,
            status: TransactionStatus.PENDING,
            transactionHash: null,
            userOpHash: null,
            userHandle: mockUserHandle,
            userName: mockUserName,
            userWallet: mockWallet,
            chainIn: mockChainId,
            chainOut: mockChainId,
          },
        ]);
    });

    it('Should not call FlowXO if no hash in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if no hash in PatchWallet transaction', async function () {
      await handleSwap({
        value: mockAmountIn,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        tokenIn: mockTokenIn,
        amountIn: mockAmountIn,
        tokenOut: mockTokenOut,
        amountOut: mockAmountOut,
        priceImpact: mockPriceImpact,
        gas: mockGas,
        from: mockFromSwap,
        tokenInSymbol: mockTokenInSymbol,
        tokenOutSymbol: mockTokenOutSymbol,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
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
          responsePath: mockResponsePath,
        });

        axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return false if transaction hash is empty in tx PatchWallet endpoint', async function () {
        const result = await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(result).to.be.false;
      });

      it('Should update reward database with a pending_hash status and userOpHash if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
          chainIn: mockChainId,
          chainOut: mockChainId,
        });

        expect(await collectionSwapsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              userTelegramID: mockUserTelegramID,
              userName: mockUserName,
              userHandle: mockUserHandle,
              userWallet: mockWallet,
              tokenIn: mockTokenIn,
              amountIn: mockAmountIn,
              tokenOut: mockTokenOut,
              amountOut: mockAmountOut,
              priceImpact: mockPriceImpact,
              gas: mockGas,
              to: mockToSwap,
              from: mockFromSwap,
              tokenInSymbol: mockTokenInSymbol,
              tokenOutSymbol: mockTokenOutSymbol,
              eventId: mockEventId,
              status: TransactionStatus.PENDING_HASH,
              userOpHash: mockUserOpHash,
              transactionHash: null,
              chainIn: mockChainId,
              chainOut: mockChainId,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction hash is present in PatchWallet status endpoint', async function () {
      let contractStub: ContractStub;
      let getContract;

      beforeEach(async function () {
        contractStub = {
          methods: {
            decimals: sandbox.stub().resolves('18'),
          },
        };
        contractStub.methods.decimals = sandbox.stub().returns({
          call: sandbox.stub().resolves('18'),
        });
        getContract = () => {
          return contractStub;
        };
        sandbox.stub(web3, 'getContract').callsFake(getContract);

        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
          responsePath: mockResponsePath,
        });

        await collectionSwapsMock.insertOne({
          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
          eventId: mockEventId,
          status: TransactionStatus.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });
      });

      it('Should return true if transaction hash is present in PatchWallet status endpoint', async function () {
        const result = await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update the database with a success status if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
          chainIn: mockChainId,
          chainOut: mockChainId,
        });

        expect(await collectionSwapsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              transactionHash: mockTransactionHash,

              userTelegramID: mockUserTelegramID,
              userName: mockUserName,
              userHandle: mockUserHandle,
              userWallet: mockWallet,
              tokenIn: mockTokenIn,
              amountIn: mockAmountIn,
              tokenOut: mockTokenOut,
              amountOut: mockAmountOut,
              priceImpact: mockPriceImpact,
              gas: mockGas,
              to: mockToSwap,
              from: mockFromSwap,
              tokenInSymbol: mockTokenInSymbol,
              tokenOutSymbol: mockTokenOutSymbol,
              eventId: mockEventId,
              userOpHash: mockUserOpHash,
              status: TransactionStatus.SUCCESS,
              chainIn: mockChainId,
              chainOut: mockChainId,
            },
          ]);
      });

      it('Should call FlowXO webhook properly if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: '1000000000000000000',
          tokenOut: mockTokenOut,
          amountOut: '1000000000000000000',
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
          chainIn: mockChainId,
          chainOut: mockChainId,
        });
        const FlowXOCallArgs = axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK).args[1];

        expect(FlowXOCallArgs)
          .excluding(['dateAdded'])
          .to.deep.equal({
            userResponsePath: mockResponsePath,
            eventId: mockEventId,
            userTelegramID: mockUserTelegramID,
            userName: mockUserName,
            userHandle: mockUserHandle,
            userWallet: mockWallet,
            tokenIn: mockTokenIn,
            amountIn: '1',
            tokenOut: mockTokenOut,
            amountOut: '1',
            priceImpact: mockPriceImpact,
            gas: mockGas,
            to: mockToSwap,
            from: mockFromSwap,
            tokenInSymbol: mockTokenInSymbol,
            tokenOutSymbol: mockTokenOutSymbol,
            transactionHash: mockTransactionHash,
            status: TransactionStatus.SUCCESS,
            apiKey: FLOWXO_WEBHOOK_API_KEY,
            chainIn: mockChainId,
            chainOut: mockChainId,
            chainInName: 'Polygon',
            chainOutName: 'Polygon',
            transactionLink:
              CHAIN_MAPPING[mockChainId].explorer + mockTransactionHash,
          });

        expect(FlowXOCallArgs.dateAdded).to.be.greaterThanOrEqual(
          new Date(Date.now() - 20000),
        ); // 20 seconds
        expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
      });
    });

    describe('Transaction hash is not present in PatchWallet status endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
          responsePath: mockResponsePath,
        });

        await collectionSwapsMock.insertOne({
          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
          eventId: mockEventId,
          status: TransactionStatus.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });

        axiosStub.withArgs(PATCHWALLET_TX_STATUS_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return false if transaction hash is not present in PatchWallet status endpoint', async function () {
        const result = await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(result).to.be.false;
      });

      it('Should not swap tokens if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should not update database if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
          chainIn: mockChainId,
          chainOut: mockChainId,
        });

        expect(await collectionSwapsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              userTelegramID: mockUserTelegramID,
              userName: mockUserName,
              userHandle: mockUserHandle,
              userWallet: mockWallet,
              tokenIn: mockTokenIn,
              amountIn: mockAmountIn,
              tokenOut: mockTokenOut,
              amountOut: mockAmountOut,
              priceImpact: mockPriceImpact,
              gas: mockGas,
              to: mockToSwap,
              from: mockFromSwap,
              tokenInSymbol: mockTokenInSymbol,
              tokenOutSymbol: mockTokenOutSymbol,
              eventId: mockEventId,
              status: TransactionStatus.PENDING_HASH,
              userOpHash: mockUserOpHash,
              transactionHash: null,
              chainIn: mockChainId,
              chainOut: mockChainId,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
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
          responsePath: mockResponsePath,
        });

        await collectionSwapsMock.insertOne({
          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
          eventId: mockEventId,
          status: TransactionStatus.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });

        axiosStub
          .withArgs(PATCHWALLET_TX_STATUS_URL)
          .rejects(new Error('Service not available'));
      });

      it('Should return false if Error in PatchWallet get status endpoint', async function () {
        const result = await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(result).to.be.false;
      });

      it('Should not send tokens if Error in PatchWallet get status endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should not update database if Error in PatchWallet get status endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(await collectionSwapsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              userTelegramID: mockUserTelegramID,
              tokenIn: mockTokenIn,
              amountIn: mockAmountIn,
              tokenOut: mockTokenOut,
              amountOut: mockAmountOut,
              priceImpact: mockPriceImpact,
              gas: mockGas,
              to: mockToSwap,
              from: mockFromSwap,
              tokenInSymbol: mockTokenInSymbol,
              tokenOutSymbol: mockTokenOutSymbol,
              eventId: mockEventId,
              status: TransactionStatus.PENDING_HASH,
              userOpHash: mockUserOpHash,
            },
          ]);
      });

      it('Should not call FlowXO webhook if Error in PatchWallet get status endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
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
          responsePath: mockResponsePath,
        });

        await collectionSwapsMock.insertOne({
          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
          eventId: mockEventId,
          status: TransactionStatus.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });

        axiosStub.withArgs(PATCHWALLET_TX_STATUS_URL).rejects({
          response: {
            status: 470,
          },
        });
      });

      it('Should return true if Error 470 in PatchWallet get status endpoint', async function () {
        const result = await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens if Error 470 in PatchWallet get status endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update database with failure status if Error 470 in PatchWallet get status endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
          chainIn: mockChainId,
          chainOut: mockChainId,
        });

        expect(await collectionSwapsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              userTelegramID: mockUserTelegramID,
              userName: mockUserName,
              userHandle: mockUserHandle,
              userWallet: mockWallet,
              tokenIn: mockTokenIn,
              amountIn: mockAmountIn,
              tokenOut: mockTokenOut,
              amountOut: mockAmountOut,
              priceImpact: mockPriceImpact,
              gas: mockGas,
              to: mockToSwap,
              from: mockFromSwap,
              tokenInSymbol: mockTokenInSymbol,
              tokenOutSymbol: mockTokenOutSymbol,
              eventId: mockEventId,
              status: TransactionStatus.FAILURE,
              userOpHash: mockUserOpHash,
              transactionHash: null,
              chainIn: mockChainId,
              chainOut: mockChainId,
            },
          ]);
      });

      it('Should not call FlowXO webhook if Error 470 in PatchWallet get status endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
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
          responsePath: mockResponsePath,
        });

        await collectionSwapsMock.insertOne({
          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
          eventId: mockEventId,
          status: TransactionStatus.PENDING_HASH,
        });
      });

      it('Should return true if transaction hash is pending_hash without userOpHash', async function () {
        const result = await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is pending_hash without userOpHash', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update reward database with a success status if transaction hash is pending_hash without userOpHash', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(await collectionSwapsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              userTelegramID: mockUserTelegramID,
              userName: mockUserName,
              userHandle: mockUserHandle,
              userWallet: mockWallet,
              tokenIn: mockTokenIn,
              amountIn: mockAmountIn,
              tokenOut: mockTokenOut,
              amountOut: mockAmountOut,
              priceImpact: mockPriceImpact,
              gas: mockGas,
              to: mockToSwap,
              from: mockFromSwap,
              tokenInSymbol: mockTokenInSymbol,
              tokenOutSymbol: mockTokenOutSymbol,
              eventId: mockEventId,
              status: TransactionStatus.SUCCESS,
              transactionHash: null,
              userOpHash: null,
              chainIn: null,
              chainOut: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction is considered as failure after 10 min of trying to get status', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
          responsePath: mockResponsePath,
        });

        await collectionSwapsMock.insertOne({
          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
          eventId: mockEventId,
          status: TransactionStatus.PENDING_HASH,
          dateAdded: new Date(Date.now() - 12 * 60 * 1000),
        });

        axiosStub.withArgs(PATCHWALLET_TX_STATUS_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return true after 10 min of trying to get status', async function () {
        const result = await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens after 10 min of trying to get status', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update reward database with a failure status after 10 min of trying to get status', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          to: mockToSwap,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
          chainIn: mockChainId,
          chainOut: mockChainId,
        });

        expect(await collectionSwapsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              userTelegramID: mockUserTelegramID,
              userName: mockUserName,
              userHandle: mockUserHandle,
              userWallet: mockWallet,
              tokenIn: mockTokenIn,
              amountIn: mockAmountIn,
              tokenOut: mockTokenOut,
              amountOut: mockAmountOut,
              priceImpact: mockPriceImpact,
              gas: mockGas,
              to: mockToSwap,
              from: mockFromSwap,
              tokenInSymbol: mockTokenInSymbol,
              tokenOutSymbol: mockTokenOutSymbol,
              eventId: mockEventId,
              status: TransactionStatus.FAILURE,
              transactionHash: null,
              userOpHash: null,
              chainIn: mockChainId,
              chainOut: mockChainId,
            },
          ]);
      });

      it('Should not call FlowXO webhook after 10 min of trying to get status', async function () {
        await handleSwap({
          value: mockAmountIn,
          eventId: mockEventId,

          userTelegramID: mockUserTelegramID,
          tokenIn: mockTokenIn,
          amountIn: mockAmountIn,
          tokenOut: mockTokenOut,
          amountOut: mockAmountOut,
          priceImpact: mockPriceImpact,
          gas: mockGas,
          from: mockFromSwap,
          tokenInSymbol: mockTokenInSymbol,
          tokenOutSymbol: mockTokenOutSymbol,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_SWAP_WEBHOOK),
        ).to.be.undefined;
      });
    });
  });
});
