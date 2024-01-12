import chai, { expect } from 'chai';
import {
  mockResponsePath,
  mockUserHandle,
  mockUserName,
  mockUserTelegramID,
  mockWallet,
  mockAccessToken,
  mockTransactionHash,
  mockUserTelegramID1,
  mockUserOpHash,
  mockTokenAddress,
  mockChainName,
  getCollectionUsersMock,
  getCollectionRewardsMock,
  mockChainId,
  mockEventId,
} from '../utils';
import Sinon from 'sinon';
import axios from 'axios';
import * as web3 from '../../utils/web3';

import chaiExclude from 'chai-exclude';
import {
  FLOWXO_NEW_LINK_REWARD_WEBHOOK,
  PATCHWALLET_AUTH_URL,
  PATCHWALLET_RESOLVER_URL,
  PATCHWALLET_TX_STATUS_URL,
  PATCHWALLET_TX_URL,
  RewardReason,
} from '../../utils/constants';
import { FLOWXO_WEBHOOK_API_KEY, SOURCE_TG_ID } from '../../../secrets';
import { handleLinkReward } from '../../webhooks/link-reward';
import { ContractStub } from '../../types/tests.types';
import { TransactionStatus } from 'grindery-nexus-common-utils';

chai.use(chaiExclude);

describe('handleLinkReward function', async function () {
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

      if (url === PATCHWALLET_RESOLVER_URL) {
        return Promise.resolve({
          data: {
            users: [{ accountAddress: mockWallet }],
          },
        });
      }

      if (url == FLOWXO_NEW_LINK_REWARD_WEBHOOK) {
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
              '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000008ac7230489e80000',
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

  describe('Referent is not a user', async function () {
    it('Should return true if referent is not a user', async function () {
      expect(
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if referent is not a user', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not fill the reward database if referent is not a user', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });

      expect(await collectionRewardsMock.find({}).toArray()).to.be.empty;
    });

    it('Should not call FlowXO if referent is not a user', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_LINK_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('User already sponsored someone else without eventId', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
      });

      await collectionRewardsMock.insertOne({
        sponsoredUserTelegramID: mockUserTelegramID,
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: RewardReason.LINK,
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '10',
        message: 'Referral link',
        transactionHash: mockTransactionHash,
      });
    });

    it('Should return true if user already sponsored someone else in another reward process without eventId', async function () {
      expect(
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if user already sponsored someone else in another reward process without eventId', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not update the database if user already sponsored someone else in another reward process without eventId', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });
      expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            sponsoredUserTelegramID: mockUserTelegramID,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: RewardReason.LINK,
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '10',
            message: 'Referral link',
            transactionHash: mockTransactionHash,
          },
        ]);
    });

    it('Should not call FlowXO if user already sponsored someone else in another reward process without eventId', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_LINK_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('User already sponsored someone else with another eventId', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
      });

      await collectionRewardsMock.insertOne({
        eventId: 'anotherEventId',
        sponsoredUserTelegramID: mockUserTelegramID,
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: RewardReason.LINK,
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '10',
        message: 'Referral link',
        transactionHash: mockTransactionHash,
      });
    });

    it('Should return true if user already sponsored someone else in another reward process with another eventId', async function () {
      expect(
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if user already sponsored someone else in another reward process with another eventId', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not update the database if user already sponsored someone else in another reward process with another eventId', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });
      expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: 'anotherEventId',
            sponsoredUserTelegramID: mockUserTelegramID,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: RewardReason.LINK,
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '10',
            message: 'Referral link',
            transactionHash: mockTransactionHash,
          },
        ]);
    });

    it('Should not call FlowXO if user already sponsored someone else in another reward process with another eventId', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_LINK_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('This eventId link reward is already a success', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
      });

      await collectionRewardsMock.insertOne({
        eventId: mockEventId,
        sponsoredUserTelegramID: mockUserTelegramID,
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: RewardReason.LINK,
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '10',
        message: 'Referral link',
        transactionHash: mockTransactionHash,
        status: TransactionStatus.SUCCESS,
      });
    });

    it('Should return true if This eventId link reward is already a success', async function () {
      expect(
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if This eventId link reward is already a success', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });

      expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not update the database if This eventId link reward is already a success', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });
      expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: mockEventId,
            sponsoredUserTelegramID: mockUserTelegramID,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: RewardReason.LINK,
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '10',
            message: 'Referral link',
            transactionHash: mockTransactionHash,
            status: TransactionStatus.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO if This eventId link reward is already a success', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_LINK_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('Normal process for a new user', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
    });

    it('Should call the sendTokens function properly if the user is new', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
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
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000008ac7230489e80000',
        ],
        auth: '',
      });
    });

    it('Should call the sendTokens function properly if the user is new with delegate call', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
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
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000008ac7230489e80000',
        ],
        auth: '',
      });
    });

    it('Should insert a new element in the reward collection of the database if the user is new', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });

      const rewards = await collectionRewardsMock.find({}).toArray();

      expect(rewards.length).to.equal(1);
      expect(rewards[0]).excluding(['_id', 'dateAdded']).to.deep.equal({
        eventId: mockEventId,
        sponsoredUserTelegramID: mockUserTelegramID,
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: RewardReason.LINK,
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '10',
        message: 'Referral link',
        transactionHash: mockTransactionHash,
        status: TransactionStatus.SUCCESS,
        userOpHash: null,
      });
      expect(rewards[0].dateAdded).to.be.greaterThanOrEqual(
        new Date(Date.now() - 20000),
      ); // 20 seconds
      expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should return true if the user is new', async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
      });
      expect(
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        }),
      ).to.be.true;
    });

    it('Should call FlowXO webhook properly if the user is new', async function () {
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });

      const FlowXOCallArgs = axiosStub
        .getCalls()
        .find((e) => e.firstArg === FLOWXO_NEW_LINK_REWARD_WEBHOOK).args[1];

      expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
        sponsoredUserTelegramID: mockUserTelegramID,
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: RewardReason.LINK,
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '10',
        message: 'Referral link',
        transactionHash: mockTransactionHash,
        apiKey: FLOWXO_WEBHOOK_API_KEY,
      });

      expect(FlowXOCallArgs.dateAdded).to.be.greaterThanOrEqual(
        new Date(Date.now() - 20000),
      ); // 20 seconds
      expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
    });
  });

  it('Should return true if there is an error in FlowXO webhook call', async function () {
    axiosStub
      .withArgs(FLOWXO_NEW_LINK_REWARD_WEBHOOK)
      .rejects(new Error('Service not available'));

    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
    });

    expect(
      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      }),
    ).to.be.true;
  });

  describe('PatchWallet transaction error', function () {
    it('Should return false if there is an error in the transaction', async function () {
      axiosStub
        .withArgs(PATCHWALLET_TX_URL)
        .rejects(new Error('Service not available'));

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
      });

      expect(
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        }),
      ).to.be.false;
    });

    it('Should add pending reward in the database if there is an error in the transaction', async function () {
      axiosStub
        .withArgs(PATCHWALLET_TX_URL)
        .rejects(new Error('Service not available'));

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
      });

      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });
      expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: mockEventId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: RewardReason.LINK,
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '10',
            message: 'Referral link',
            sponsoredUserTelegramID: mockUserTelegramID,
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

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
      });

      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_LINK_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('PatchWallet transaction without hash', function () {
    it('Should return false if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
        data: {
          error: 'service non available',
        },
      });

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
      });

      expect(
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        }),
      ).to.be.false;
    });

    it('Should add pending reward in the database if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
        data: {
          error: 'service non available',
        },
      });

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
      });

      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });
      expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: mockEventId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: RewardReason.LINK,
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '10',
            message: 'Referral link',
            sponsoredUserTelegramID: mockUserTelegramID,
            status: TransactionStatus.PENDING,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
        data: {
          error: 'service non available',
        },
      });

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
      });

      await handleLinkReward({
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        referentUserTelegramID: mockUserTelegramID1,
      });

      expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_LINK_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('Get transaction hash via userOpHash if transaction hash is empty first', async function () {
    describe('Transaction hash is empty in tx PatchWallet endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return false if transaction hash is empty in tx PatchWallet endpoint', async function () {
        const result = await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(result).to.be.false;
      });

      it('Should update reward database with a pending_hash status and userOpHash if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: mockEventId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: RewardReason.LINK,
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '10',
              message: 'Referral link',
              sponsoredUserTelegramID: mockUserTelegramID,
              status: TransactionStatus.PENDING_HASH,
              userOpHash: mockUserOpHash,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_LINK_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction hash is present in PatchWallet status endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        await collectionRewardsMock.insertOne({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: RewardReason.LINK,
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '10',
          message: 'Referral link',
          sponsoredUserTelegramID: mockUserTelegramID,
          status: TransactionStatus.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });
      });

      it('Should return true if transaction hash is present in PatchWallet status endpoint', async function () {
        const result = await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update the database with a success status if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: mockEventId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: RewardReason.LINK,
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '10',
              message: 'Referral link',
              sponsoredUserTelegramID: mockUserTelegramID,
              transactionHash: mockTransactionHash,
              status: TransactionStatus.SUCCESS,
              userOpHash: mockUserOpHash,
            },
          ]);
      });

      it('Should call FlowXO webhook properly if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        const FlowXOCallArgs = axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_LINK_REWARD_WEBHOOK).args[1];

        expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
          sponsoredUserTelegramID: mockUserTelegramID,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: RewardReason.LINK,
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '10',
          message: 'Referral link',
          transactionHash: mockTransactionHash,
          apiKey: FLOWXO_WEBHOOK_API_KEY,
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
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        await collectionRewardsMock.insertOne({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: RewardReason.LINK,
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '10',
          message: 'Referral link',
          sponsoredUserTelegramID: mockUserTelegramID,
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
        const result = await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(result).to.be.false;
      });

      it('Should not send tokens if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should not update database if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: mockEventId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: RewardReason.LINK,
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '10',
              message: 'Referral link',
              sponsoredUserTelegramID: mockUserTelegramID,
              status: TransactionStatus.PENDING_HASH,
              userOpHash: mockUserOpHash,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_LINK_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Error in PatchWallet get status endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        await collectionRewardsMock.insertOne({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: RewardReason.LINK,
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '10',
          message: 'Referral link',
          sponsoredUserTelegramID: mockUserTelegramID,
          status: TransactionStatus.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });

        axiosStub
          .withArgs(PATCHWALLET_TX_STATUS_URL)
          .rejects(new Error('Service not available'));
      });

      it('Should return false if Error in PatchWallet get status endpoint', async function () {
        const result = await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(result).to.be.false;
      });

      it('Should not send tokens if Error in PatchWallet get status endpoint', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should not update database if Error in PatchWallet get status endpoint', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: mockEventId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: RewardReason.LINK,
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '10',
              message: 'Referral link',
              sponsoredUserTelegramID: mockUserTelegramID,
              status: TransactionStatus.PENDING_HASH,
              userOpHash: mockUserOpHash,
            },
          ]);
      });

      it('Should not call FlowXO webhook if Error in PatchWallet get status endpoint', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_LINK_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction is set to success without transaction hash if pending_hash without userOpHash', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        await collectionRewardsMock.insertOne({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: RewardReason.LINK,
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '10',
          message: 'Referral link',
          sponsoredUserTelegramID: mockUserTelegramID,
          status: TransactionStatus.PENDING_HASH,
        });
      });

      it('Should return true if transaction hash is pending_hash without userOpHash', async function () {
        const result = await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is pending_hash without userOpHash', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update reward database with a success status if transaction hash is pending_hash without userOpHash', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: mockEventId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: RewardReason.LINK,
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '10',
              message: 'Referral link',
              sponsoredUserTelegramID: mockUserTelegramID,
              status: TransactionStatus.SUCCESS,
              transactionHash: null,
              userOpHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_LINK_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction is considered as failure after 10 min of trying to get status', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });

        await collectionRewardsMock.insertOne({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: RewardReason.LINK,
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '10',
          message: 'Referral link',
          sponsoredUserTelegramID: mockUserTelegramID,
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
        const result = await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(result).to.be.true;
      });

      it('Should not send tokens after 10 min of trying to get status', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update reward database with a failure status after 10 min of trying to get status', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: mockEventId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: RewardReason.LINK,
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '10',
              message: 'Referral link',
              sponsoredUserTelegramID: mockUserTelegramID,
              status: TransactionStatus.FAILURE,
              transactionHash: null,
              userOpHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook after 10 min of trying to get status', async function () {
        await handleLinkReward({
          eventId: mockEventId,
          userTelegramID: mockUserTelegramID,
          referentUserTelegramID: mockUserTelegramID1,
        });

        expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_LINK_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });
  });
});
