import chai, { expect } from 'chai';
import {
  mockResponsePath,
  mockUserName,
  mockUserTelegramID,
  mockUserTelegramID1,
  mockWallet,
  mockAccessToken,
  mockTransactionHash,
  mockUserHandle,
  mockUserOpHash,
  mockChainName,
  mockTokenAddress,
  mockChainId,
  getCollectionUsersMock,
  getCollectionTransfersMock,
} from '../utils';
import Sinon from 'sinon';
import axios from 'axios';
import chaiExclude from 'chai-exclude';
import {
  FLOWXO_NEW_TRANSACTION_WEBHOOK,
  G1_TOKEN_SYMBOL,
  PATCHWALLET_AUTH_URL,
  PATCHWALLET_RESOLVER_URL,
  PATCHWALLET_TX_STATUS_URL,
  PATCHWALLET_TX_URL,
  SEGMENT_TRACK_URL,
  nativeTokenAddresses,
} from '../../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { handleNewTransaction } from '../../webhooks/transaction';
import { FLOWXO_WEBHOOK_API_KEY, G1_POLYGON_ADDRESS } from '../../../secrets';
import * as web3 from '../../utils/web3';
import { ContractStub } from '../../types/tests.types';
import { TransactionStatus } from 'grindery-nexus-common-utils';

chai.use(chaiExclude);

describe('handleNewTransaction function', async function () {
  let sandbox: Sinon.SinonSandbox;
  let axiosStub;
  let txId: string;
  let collectionUsersMock;
  let collectionTransfersMock;
  let contractStub: ContractStub;
  let getContract;

  beforeEach(async function () {
    collectionUsersMock = await getCollectionUsersMock();
    collectionTransfersMock = await getCollectionTransfersMock();

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

      if (url == FLOWXO_NEW_TRANSACTION_WEBHOOK) {
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

    contractStub = {
      methods: {
        decimals: sandbox.stub().resolves('18'),
        transfer: sandbox.stub().returns({
          encodeABI: sandbox
            .stub()
            .returns(
              '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000000000000000000064',
            ),
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

    txId = uuidv4();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('Normal process to handle a transaction', async function () {
    beforeEach(async function () {
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
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        }),
      ).to.be.true;
    });

    it('Should populate transfers database', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
        chainId: mockChainId,
        tokenAddress: mockTokenAddress,
      });

      const transfers = await collectionTransfersMock.find({}).toArray();

      expect(transfers)
        .excluding(['dateAdded', '_id'])
        .to.deep.equal([
          {
            eventId: txId,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: mockTokenAddress,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipientTgId: mockUserTelegramID1,
            recipientWallet: mockWallet,
            tokenAmount: '100',
            transactionHash: mockTransactionHash,
            status: TransactionStatus.SUCCESS,
            userOpHash: null,
          },
        ]);
      expect(transfers[0].dateAdded).to.be.a('date');
    });

    it('Should call the sendTokens function properly for ERC20 token transfer', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: mockChainName,
        to: [G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000000000000000000064',
        ],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should call the sendTokens function properly for ERC20 token transfer with delegate call', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
        delegatecall: 1,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: mockChainName,
        to: [G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000000000000000000064',
        ],
        delegatecall: 1,
        auth: '',
      });
    });

    it('Should call the sendTokens function properly for Native token transfer', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
        tokenAddress: nativeTokenAddresses[0],
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: mockChainName,
        to: [mockWallet],
        value: [web3.scaleDecimals('100', 18)],
        data: ['0x'],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should call the sendTokens function properly for Native token transfer with delegate call', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
        tokenAddress: nativeTokenAddresses[0],
        delegatecall: 1,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: mockChainName,
        to: [mockWallet],
        value: [web3.scaleDecimals('100', 18)],
        data: ['0x'],
        delegatecall: 1,
        auth: '',
      });
    });

    it('Should populate the segment transfer properly', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
        tokenSymbol: 'USDC',
        tokenAddress: '0xe36BD65609c08Cd17b53520293523CF4560533d2',
        chainId: mockChainId,
      });

      const segmentIdentityCall = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === SEGMENT_TRACK_URL);

      expect(segmentIdentityCall[0].args[1])
        .excluding(['timestamp'])
        .to.deep.equal({
          userId: mockUserTelegramID,
          event: 'Transfer',
          properties: {
            chainId: mockChainId,
            tokenSymbol: 'USDC',
            tokenAddress: '0xe36BD65609c08Cd17b53520293523CF4560533d2',
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipientTgId: mockUserTelegramID1,
            recipientWallet: mockWallet,
            tokenAmount: '100',
            transactionHash: mockTransactionHash,
            eventId: txId,
          },
        });
    });

    it('Should call FlowXO webhook properly for new transactions', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      const FlowXOCallArgs = axiosStub
        .getCalls()
        .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK).args[1];

      expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
        senderResponsePath: mockResponsePath,
        chainId: mockChainId,
        tokenSymbol: G1_TOKEN_SYMBOL,
        tokenAddress: G1_POLYGON_ADDRESS,
        senderTgId: mockUserTelegramID,
        senderWallet: mockWallet,
        senderName: mockUserName,
        senderHandle: mockUserHandle,
        recipientTgId: mockUserTelegramID1,
        recipientWallet: mockWallet,
        tokenAmount: '100',
        transactionHash: mockTransactionHash,
        apiKey: FLOWXO_WEBHOOK_API_KEY,
        status: TransactionStatus.SUCCESS,
      });
    });
  });

  describe('Normal process to handle a transaction with a float number', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });
    });

    it('Should populate transfers database', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '10.002',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
        chainId: mockChainId,
        tokenAddress: mockTokenAddress,
      });

      const transfers = await collectionTransfersMock.find({}).toArray();

      expect(transfers)
        .excluding(['dateAdded', '_id'])
        .to.deep.equal([
          {
            eventId: txId,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: mockTokenAddress,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipientTgId: mockUserTelegramID1,
            recipientWallet: mockWallet,
            tokenAmount: '10.002',
            transactionHash: mockTransactionHash,
            status: TransactionStatus.SUCCESS,
            userOpHash: null,
          },
        ]);
      expect(transfers[0].dateAdded).to.be.a('date');
    });

    it('Should call the sendTokens function properly for ERC20 token transfer', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '10.9',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: mockChainName,
        to: [G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000000000000000000064',
        ],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should call the sendTokens function properly for Native token transfer', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '10.3',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
        tokenAddress: nativeTokenAddresses[0],
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${mockUserTelegramID}`,
        chain: mockChainName,
        to: [mockWallet],
        value: ['10300000000000000000'],
        data: ['0x'],
        delegatecall: 0,
        auth: '',
      });
    });
  });

  describe('Transaction is already a success', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionTransfersMock.insertOne({
        eventId: txId,
        status: TransactionStatus.SUCCESS,
      });
    });

    it('Should return true and no token sending if transaction is already a success', async function () {
      expect(
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if transaction is already a success', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if transaction is already a success', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(await collectionTransfersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: txId,
            status: TransactionStatus.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO is already a success', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment is already a success', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  describe('Transaction if is already a failure', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionTransfersMock.insertOne({
        eventId: txId,
        status: TransactionStatus.FAILURE,
      });
    });

    it('Should return true and no token sending if transaction if is already a failure', async function () {
      expect(
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if transaction if is already a failure', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if transaction if is already a failure', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(await collectionTransfersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: txId,
            status: TransactionStatus.FAILURE,
          },
        ]);
    });

    it('Should not call FlowXO if is already a failure', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if is already a failure', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  describe('Transaction if is already a failure 503', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionTransfersMock.insertOne({
        eventId: txId,
        status: TransactionStatus.FAILURE_503,
      });
    });

    it('Should return true and no token sending if transaction if is already a failure', async function () {
      expect(
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if transaction if is already a failure', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if transaction if is already a failure', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(await collectionTransfersMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: txId,
            status: TransactionStatus.FAILURE_503,
          },
        ]);
    });

    it('Should not call FlowXO if is already a failure', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if is already a failure', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
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

      axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
        data: {
          error: 'service non available',
        },
      });
    });

    it('Should return false if there is an error in the send tokens request', async function () {
      const result = await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(result).to.be.false;
    });

    it('Should not modify transaction status in the database if there is an error in the send tokens request', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(await collectionTransfersMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: txId,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: G1_POLYGON_ADDRESS,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipientTgId: mockUserTelegramID1,
            recipientWallet: mockWallet,
            tokenAmount: '100',
            status: TransactionStatus.PENDING,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if there is an error in the send tokens request', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if there is an error in the send tokens request', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  it('Should not add new transaction if one with the same eventId already exists', async function () {
    await collectionTransfersMock.insertOne({
      eventId: txId,
    });

    const objectId = (
      await collectionTransfersMock.findOne({
        eventId: txId,
      })
    )._id.toString();

    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
      userName: mockUserName,
      userHandle: mockUserHandle,
      patchwallet: mockWallet,
    });

    await handleNewTransaction({
      senderTgId: mockUserTelegramID,
      amount: '100',
      recipientTgId: mockUserTelegramID1,
      eventId: txId,
    });

    expect(
      (await collectionTransfersMock.find({}).toArray())[0]._id.toString(),
    ).to.equal(objectId);
  });

  describe('Sender is not a user', async function () {
    it('Should return true if sender is not a user', async function () {
      const result = await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(result).to.be.true;
    });

    it('Should not add anything in database if sender is not a user', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(await collectionTransfersMock.find({}).toArray()).to.be.empty;
    });

    it('Should not send tokens if sender is not a user', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not call FlowXO if sender is not a user', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if sender is not a user', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  describe('Error in PatchWallet get address', async function () {
    beforeEach(async function () {
      axiosStub
        .withArgs(PATCHWALLET_RESOLVER_URL)
        .rejects(new Error('Service not available'));

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });
    });

    it('Should return false if error in PatchWallet get address', async function () {
      const result = await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(result).to.be.false;
    });

    it('Should not add anything in the database if error in PatchWallet get address', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(await collectionTransfersMock.find({}).toArray()).to.be.empty;
    });

    it('Should not send tokens if error in PatchWallet get address', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not call FlowXO if error in PatchWallet get address', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if error in PatchWallet get address', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL))
        .to.be.undefined;
    });
  });

  it('Should return true if error in Segment Webhook', async function () {
    axiosStub
      .withArgs(SEGMENT_TRACK_URL)
      .rejects(new Error('Service not available'));

    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
      userName: mockUserName,
      userHandle: mockUserHandle,
      patchwallet: mockWallet,
      responsePath: mockResponsePath,
    });

    const result = await handleNewTransaction({
      senderTgId: mockUserTelegramID,
      amount: '100',
      recipientTgId: mockUserTelegramID1,
      eventId: txId,
    });

    expect(result).to.be.true;
  });

  it('Should return true if error in FlowXO Webhook', async function () {
    axiosStub
      .withArgs(FLOWXO_NEW_TRANSACTION_WEBHOOK)
      .rejects(new Error('Service not available'));

    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
      userName: mockUserName,
      userHandle: mockUserHandle,
      patchwallet: mockWallet,
      responsePath: mockResponsePath,
    });

    const result = await handleNewTransaction({
      senderTgId: mockUserTelegramID,
      amount: '100',
      recipientTgId: mockUserTelegramID1,
      eventId: txId,
    });

    expect(result).to.be.true;
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
      const result = await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(result).to.be.false;
    });

    it('Should not modify database if error in PatchWallet transaction', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(await collectionTransfersMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: txId,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: G1_POLYGON_ADDRESS,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipientTgId: mockUserTelegramID1,
            recipientWallet: mockWallet,
            tokenAmount: '100',
            status: TransactionStatus.PENDING,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if error in PatchWallet transaction', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if error in PatchWallet transaction', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
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
      const result = await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(result).to.be.true;
    });

    it('Should complete db status to failure in database if error 470 in PatchWallet transaction', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(await collectionTransfersMock.find({}).toArray())
        .excluding(['dateAdded', '_id'])
        .to.deep.equal([
          {
            eventId: txId,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: G1_POLYGON_ADDRESS,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipientTgId: mockUserTelegramID1,
            recipientWallet: mockWallet,
            tokenAmount: '100',
            status: TransactionStatus.FAILURE,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if error 470 in PatchWallet transaction', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if error 470 in PatchWallet transaction', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
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
      const result = await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(result).to.be.true;
    });

    it('Should complete db status to failure 503 in database if error 503 in PatchWallet transaction', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(await collectionTransfersMock.find({}).toArray())
        .excluding(['dateAdded', '_id'])
        .to.deep.equal([
          {
            eventId: txId,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: G1_POLYGON_ADDRESS,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipientTgId: mockUserTelegramID1,
            recipientWallet: mockWallet,
            tokenAmount: '100',
            status: TransactionStatus.FAILURE_503,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if error 503 in PatchWallet transaction', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if error 503 in PatchWallet transaction', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
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
      const result = await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(result).to.be.false;
    });

    it('Should do no transaction status modification in database if no hash in PatchWallet transaction', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(await collectionTransfersMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: txId,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: G1_POLYGON_ADDRESS,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipientTgId: mockUserTelegramID1,
            recipientWallet: mockWallet,
            tokenAmount: '100',
            status: TransactionStatus.PENDING,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if no hash in PatchWallet transaction', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if no hash in PatchWallet transaction', async function () {
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
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
        const result = await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(result).to.be.false;
      });

      it('Should update reward database with a pending_hash status and userOpHash if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(await collectionTransfersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipientTgId: mockUserTelegramID1,
              recipientWallet: mockWallet,
              tokenAmount: '100',
              status: TransactionStatus.PENDING_HASH,
              userOpHash: mockUserOpHash,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
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
          responsePath: mockResponsePath,
        });

        await collectionTransfersMock.insertOne({
          eventId: txId,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipientTgId: mockUserTelegramID1,
          recipientWallet: mockWallet,
          tokenAmount: '100',
          status: TransactionStatus.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });
      });

      it('Should return true if transaction hash is present in PatchWallet status endpoint', async function () {
        const result = await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update the database with a success status if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(await collectionTransfersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipientTgId: mockUserTelegramID1,
              recipientWallet: mockWallet,
              tokenAmount: '100',
              status: TransactionStatus.SUCCESS,
              userOpHash: mockUserOpHash,
              transactionHash: mockTransactionHash,
            },
          ]);
      });

      it('Should call FlowXO webhook properly if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        const FlowXOCallArgs = axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK).args[1];

        expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
          senderResponsePath: mockResponsePath,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipientTgId: mockUserTelegramID1,
          recipientWallet: mockWallet,
          tokenAmount: '100',
          transactionHash: mockTransactionHash,
          apiKey: FLOWXO_WEBHOOK_API_KEY,
          status: TransactionStatus.SUCCESS,
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

        await collectionTransfersMock.insertOne({
          eventId: txId,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipientTgId: mockUserTelegramID1,
          recipientWallet: mockWallet,
          tokenAmount: '100',
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
        const result = await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(result).to.be.false;
      });

      it('Should not send tokens if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should not update database if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(await collectionTransfersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipientTgId: mockUserTelegramID1,
              recipientWallet: mockWallet,
              tokenAmount: '100',
              status: TransactionStatus.PENDING_HASH,
              userOpHash: mockUserOpHash,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
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

        await collectionTransfersMock.insertOne({
          eventId: txId,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipientTgId: mockUserTelegramID1,
          recipientWallet: mockWallet,
          tokenAmount: '100',
          status: TransactionStatus.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });

        axiosStub
          .withArgs(PATCHWALLET_TX_STATUS_URL)
          .rejects(new Error('Service not available'));
      });

      it('Should return false if Error in PatchWallet get status endpoint', async function () {
        const result = await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(result).to.be.false;
      });

      it('Should not send tokens if Error in PatchWallet get status endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should not update database if Error in PatchWallet get status endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(await collectionTransfersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipientTgId: mockUserTelegramID1,
              recipientWallet: mockWallet,
              tokenAmount: '100',
              status: TransactionStatus.PENDING_HASH,
              userOpHash: mockUserOpHash,
            },
          ]);
      });

      it('Should not call FlowXO webhook if Error in PatchWallet get status endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
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

        await collectionTransfersMock.insertOne({
          eventId: txId,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipientTgId: mockUserTelegramID1,
          recipientWallet: mockWallet,
          tokenAmount: '100',
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
        const result = await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens if Error 470 in PatchWallet get status endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update database with failure status if Error 470 in PatchWallet get status endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(await collectionTransfersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipientTgId: mockUserTelegramID1,
              recipientWallet: mockWallet,
              tokenAmount: '100',
              status: TransactionStatus.FAILURE,
              userOpHash: mockUserOpHash,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if Error 470 in PatchWallet get status endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
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

        await collectionTransfersMock.insertOne({
          eventId: txId,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipientTgId: mockUserTelegramID1,
          recipientWallet: mockWallet,
          tokenAmount: '100',
          status: TransactionStatus.PENDING_HASH,
        });
      });

      it('Should return true if transaction hash is pending_hash without userOpHash', async function () {
        const result = await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is pending_hash without userOpHash', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update reward database with a success status if transaction hash is pending_hash without userOpHash', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(await collectionTransfersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipientTgId: mockUserTelegramID1,
              recipientWallet: mockWallet,
              tokenAmount: '100',
              status: TransactionStatus.SUCCESS,
              transactionHash: null,
              userOpHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
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

        await collectionTransfersMock.insertOne({
          eventId: txId,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipientTgId: mockUserTelegramID1,
          recipientWallet: mockWallet,
          tokenAmount: '100',
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
        const result = await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens after 10 min of trying to get status', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update reward database with a failure status after 10 min of trying to get status', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(await collectionTransfersMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipientTgId: mockUserTelegramID1,
              recipientWallet: mockWallet,
              tokenAmount: '100',
              status: TransactionStatus.FAILURE,
              transactionHash: null,
              userOpHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook after 10 min of trying to get status', async function () {
        await handleNewTransaction({
          senderTgId: mockUserTelegramID,
          amount: '100',
          recipientTgId: mockUserTelegramID1,
          eventId: txId,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_TRANSACTION_WEBHOOK),
        ).to.be.undefined;
      });
    });
  });
});
