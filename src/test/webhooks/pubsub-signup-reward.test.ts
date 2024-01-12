import chai, { expect } from 'chai';
import {
  mockResponsePath,
  mockUserHandle,
  mockUserName,
  mockUserTelegramID,
  mockWallet,
  mockAccessToken,
  mockTransactionHash,
  mockUserOpHash,
  mockChainName,
  mockTokenAddress,
  getCollectionUsersMock,
  getCollectionRewardsMock,
  mockChainId,
  mockEventId,
} from '../utils';
import { handleSignUpReward } from '../../webhooks/signup-reward';
import Sinon from 'sinon';
import axios from 'axios';

import chaiExclude from 'chai-exclude';
import {
  DEFAULT_CHAIN_NAME,
  FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK,
  PATCHWALLET_AUTH_URL,
  PATCHWALLET_TX_STATUS_URL,
  PATCHWALLET_TX_URL,
} from '../../utils/constants';
import {
  FLOWXO_WEBHOOK_API_KEY,
  G1_POLYGON_ADDRESS,
  SOURCE_TG_ID,
} from '../../../secrets';
import * as web3 from '../../utils/web3';
import { ContractStub } from '../../types/tests.types';
import { TransactionStatus } from 'grindery-nexus-common-utils';

chai.use(chaiExclude);

describe('handleSignUpReward function', async function () {
  let sandbox: Sinon.SinonSandbox;
  let axiosStub;
  let collectionUsersMock;
  let collectionRewardsMock;
  let contractStub: ContractStub;
  let getContract;

  beforeEach(async function () {
    collectionUsersMock = await getCollectionUsersMock();
    collectionRewardsMock = await getCollectionRewardsMock();

    sandbox = Sinon.createSandbox();
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

      if (url === PATCHWALLET_TX_STATUS_URL) {
        return Promise.resolve({
          data: {
            txHash: mockTransactionHash,
            userOpHash: mockUserOpHash,
          },
        });
      }

      if (url == FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK) {
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
              '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
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
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('Sign up reward already exists with same eventId and is a success', async function () {
    beforeEach(async function () {
      await collectionRewardsMock.insertOne({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        reason: 'user_sign_up',
        status: TransactionStatus.SUCCESS,
      });
    });

    it('Should return true if Sign up reward already exists with same eventId and is a success', async function () {
      const result = await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(result).to.be.true;
    });

    it('Should send tokens if Sign up reward already exists with same eventId and is a success', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not update the dabatase if Sign up reward already exists with same eventId and is a success', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: mockEventId,
            userTelegramID: mockUserTelegramID,
            reason: 'user_sign_up',
            status: TransactionStatus.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO if Sign up reward already exists with same eventId and is a success', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('Sign up reward already exists with another eventId', async function () {
    beforeEach(async function () {
      await collectionRewardsMock.insertOne({
        eventId: 'anotherEventId',
        userTelegramID: mockUserTelegramID,
        reason: 'user_sign_up',
        status: TransactionStatus.SUCCESS,
      });
    });

    it('Should return true if Sign up reward already exists with another eventId', async function () {
      const result = await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(result).to.be.true;
    });

    it('Should send tokens if Sign up reward already exists with another eventId', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not update the dabatase if Sign up reward already exists with another eventId', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: 'anotherEventId',
            userTelegramID: mockUserTelegramID,
            reason: 'user_sign_up',
            status: TransactionStatus.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO if Sign up reward already exists with another eventId', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('Sign up reward already exists with no eventId', async function () {
    beforeEach(async function () {
      await collectionRewardsMock.insertOne({
        userTelegramID: mockUserTelegramID,
        reason: 'user_sign_up',
        status: TransactionStatus.SUCCESS,
      });
    });

    it('Should return true if Sign up reward already exists with no eventId', async function () {
      const result = await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(result).to.be.true;
    });

    it('Should send tokens if Sign up reward already exists with no eventId', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not update the dabatase if Sign up reward already exists with no eventId', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            userTelegramID: mockUserTelegramID,
            reason: 'user_sign_up',
            status: TransactionStatus.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO if Sign up reward already exists with no eventId', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('Sign up reward status pending at the beginning with same eventID', async function () {
    beforeEach(async function () {
      await collectionRewardsMock.insertMany([
        {
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          reason: '2x_reward',
          status: TransactionStatus.PENDING,
        },
        {
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          reason: 'user_sign_up',
          status: TransactionStatus.PENDING,
        },
      ]);
    });

    it('Should return true if Sign up reward status pending at the beginning with same eventID', async function () {
      const result = await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(result).to.be.true;
    });

    it('Should call the sendTokens function properly if Sign up reward status pending at the beginning with same eventID', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${SOURCE_TG_ID}`,
        chain: DEFAULT_CHAIN_NAME,
        to: [G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
        ],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should update the database with a success if Sign up reward status pending at the beginning with same eventID', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: mockEventId,
            userTelegramID: mockUserTelegramID,
            reason: '2x_reward',
            status: TransactionStatus.PENDING,
          },
          {
            eventId: mockEventId,
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: 'user_sign_up',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '100',
            message: 'Sign up reward',
            transactionHash: mockTransactionHash,
            status: TransactionStatus.SUCCESS,
            userOpHash: null,
          },
        ]);
    });

    it('Should call FlowXO properly if Sign up reward status pending at the beginning with same eventID', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const FlowXOCallArgs = axiosStub
        .getCalls()
        .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK).args[1];

      expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: 'user_sign_up',
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '100',
        message: 'Sign up reward',
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

  describe('Sign up reward status failure at the beginning with same eventID', async function () {
    beforeEach(async function () {
      await collectionRewardsMock.insertOne({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        reason: 'user_sign_up',
        status: TransactionStatus.FAILURE,
      });
    });

    it('Should return true if Sign up reward status is failure at beginning with same eventID', async function () {
      const result = await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(result).to.be.true;
    });

    it('Should call the sendTokens function properly if Sign up reward status is failure at beginning with same eventID', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${SOURCE_TG_ID}`,
        chain: DEFAULT_CHAIN_NAME,
        to: [G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
        ],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should update reward status if Sign up reward status is failure at beginning with same eventID', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const rewards = await collectionRewardsMock.find({}).toArray();

      expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: mockEventId,
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: 'user_sign_up',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '100',
            message: 'Sign up reward',
            transactionHash: mockTransactionHash,
            status: TransactionStatus.SUCCESS,
            userOpHash: null,
          },
        ]);

      expect(rewards[0].dateAdded).to.be.greaterThanOrEqual(
        new Date(Date.now() - 20000),
      ); // 20 seconds
      expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should call FlowXO properly if Sign up reward status is failure at beginning with same eventID', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const FlowXOCallArgs = axiosStub
        .getCalls()
        .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK).args[1];

      expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: 'user_sign_up',
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '100',
        message: 'Sign up reward',
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

  describe('Normal process with a new user', async function () {
    it('Should call the sendTokens function properly if the user is new', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        tokenAddress: mockTokenAddress,
        chainId: mockChainId,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${SOURCE_TG_ID}`,
        chain: mockChainName,
        to: [mockTokenAddress],
        value: ['0x00'],
        delegatecall: 0,
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
        ],
        auth: '',
      });
    });

    it('Should call the sendTokens function properly with delegate call if specified', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        tokenAddress: mockTokenAddress,
        chainId: mockChainId,
        delegatecall: 1,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
          .args[1],
      ).to.deep.equal({
        userId: `grindery:${SOURCE_TG_ID}`,
        chain: mockChainName,
        to: [mockTokenAddress],
        value: ['0x00'],
        delegatecall: 1,
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
        ],
        auth: '',
      });
    });

    it('Should insert a new element in the reward collection of the database if the user is new', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const rewards = await collectionRewardsMock.find({}).toArray();

      expect(rewards.length).to.equal(1);
      expect(rewards[0]).excluding(['_id', 'dateAdded']).to.deep.equal({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: 'user_sign_up',
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '100',
        message: 'Sign up reward',
        transactionHash: mockTransactionHash,
        status: TransactionStatus.SUCCESS,
        userOpHash: null,
      });
      expect(rewards[0].dateAdded).to.be.greaterThanOrEqual(
        new Date(Date.now() - 20000),
      ); // 20 seconds
      expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should call FlowXO webhook properly if the user is new', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const FlowXOCallArgs = axiosStub
        .getCalls()
        .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK).args[1];

      expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: 'user_sign_up',
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '100',
        message: 'Sign up reward',
        transactionHash: mockTransactionHash,
        apiKey: FLOWXO_WEBHOOK_API_KEY,
        status: TransactionStatus.SUCCESS,
      });

      expect(FlowXOCallArgs.dateAdded).to.be.greaterThanOrEqual(
        new Date(Date.now() - 20000),
      ); // 20 seconds
      expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should return true if the user is new', async function () {
      expect(
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        }),
      ).to.be.true;
    });

    it('Should not add the user in the database (in handleSignUpReward) if the user is new', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
    });
  });

  it('Should return true if there is an error in FlowXO', async function () {
    axiosStub
      .withArgs(FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)
      .rejects(new Error('Service not available'));

    expect(
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      }),
    ).to.be.true;
  });

  describe('PatchWallet transaction error', function () {
    it('Should return false if there is an error in the transaction', async function () {
      axiosStub
        .withArgs(PATCHWALLET_TX_URL)
        .rejects(new Error('Service not available'));

      expect(
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        }),
      ).to.be.false;
    });

    it('Should set signup reward to pending in db if there is an error in the transaction', async function () {
      axiosStub
        .withArgs(PATCHWALLET_TX_URL)
        .rejects(new Error('Service not available'));

      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: mockEventId,
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: 'user_sign_up',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '100',
            message: 'Sign up reward',
            dateAdded: new Date(),
            status: TransactionStatus.PENDING,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if there is an error in the transaction', async function () {
      axiosStub
        .withArgs(PATCHWALLET_TX_URL)
        .rejects(new Error('Service not available'));

      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('PatchWallet transaction without hash field in response', function () {
    beforeEach(async function () {
      axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
        data: {
          error: 'service non available',
        },
      });
    });

    it('Should return false if there is no hash in PatchWallet response', async function () {
      expect(
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        }),
      ).to.be.false;
    });

    it('Should set signup reward to pending in db if there is no hash in PatchWallet response', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: mockEventId,
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: 'user_sign_up',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '100',
            message: 'Sign up reward',
            status: TransactionStatus.PENDING,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if there is no hash in PatchWallet response', async function () {
      await handleSignUpReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('Get transaction hash via userOpHash if transaction hash is empty first', async function () {
    describe('Transaction hash is empty in tx PatchWallet endpoint', async function () {
      beforeEach(async function () {
        axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return false if transaction hash is empty in tx PatchWallet endpoint', async function () {
        const result = await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(result).to.be.false;
      });

      it('Should update reward database with a pending_hash status and userOpHash if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: mockEventId,
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'user_sign_up',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '100',
              message: 'Sign up reward',
              status: TransactionStatus.PENDING_HASH,
              userOpHash: mockUserOpHash,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction hash is present in PatchWallet status endpoint', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
          status: TransactionStatus.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });
      });

      it('Should return true if transaction hash is present in PatchWallet status endpoint', async function () {
        const result = await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update the database with a success status if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: mockEventId,
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'user_sign_up',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '100',
              message: 'Sign up reward',
              status: TransactionStatus.SUCCESS,
              transactionHash: mockTransactionHash,
              userOpHash: mockUserOpHash,
            },
          ]);
      });

      it('Should call FlowXO webhook properly if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        const FlowXOCallArgs = axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK).args[1];

        expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
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
        await collectionRewardsMock.insertOne({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
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
        const result = await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(result).to.be.false;
      });

      it('Should not send tokens if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should not update database if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: mockEventId,
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'user_sign_up',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '100',
              message: 'Sign up reward',
              status: TransactionStatus.PENDING_HASH,
              userOpHash: mockUserOpHash,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Error in PatchWallet get status endpoint', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
          status: TransactionStatus.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });

        axiosStub
          .withArgs(PATCHWALLET_TX_STATUS_URL)
          .rejects(new Error('Service not available'));
      });

      it('Should return false if Error in PatchWallet get status endpoint', async function () {
        const result = await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(result).to.be.false;
      });

      it('Should not send tokens if Error in PatchWallet get status endpoint', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should not update database if Error in PatchWallet get status endpoint', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: mockEventId,
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'user_sign_up',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '100',
              message: 'Sign up reward',
              status: TransactionStatus.PENDING_HASH,
              userOpHash: mockUserOpHash,
            },
          ]);
      });

      it('Should not call FlowXO webhook if Error in PatchWallet get status endpoint', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction is set to success without transaction hash if pending_hash without userOpHash', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
          status: TransactionStatus.PENDING_HASH,
        });
      });

      it('Should return true if transaction hash is pending_hash without userOpHash', async function () {
        const result = await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is pending_hash without userOpHash', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update reward database with a success status if transaction hash is pending_hash without userOpHash', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: mockEventId,
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'user_sign_up',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '100',
              message: 'Sign up reward',
              status: TransactionStatus.SUCCESS,
              transactionHash: null,
              userOpHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction is considered as failure after 10 min of trying to get status', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
          status: TransactionStatus.PENDING_HASH,
          userOpHash: mockUserOpHash,
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
        const result = await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens after 10 min of trying to get status', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update reward database with a failure status after 10 min of trying to get status', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: mockEventId,
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'user_sign_up',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '100',
              message: 'Sign up reward',
              userOpHash: mockUserOpHash,
              status: TransactionStatus.FAILURE,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook after 10 min of trying to get status', async function () {
        await handleSignUpReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });
  });
});
