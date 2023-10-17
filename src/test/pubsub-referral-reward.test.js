import chai from 'chai';
import {
  collectionRewardsMock,
  dbMock,
  mockResponsePath,
  mockUserHandle,
  mockUserName,
  mockUserTelegramID,
  mockWallet,
  mockAccessToken,
  mockTransactionHash,
  collectionUsersMock,
  mockUserTelegramID1,
  collectionTransfersMock,
  mockTransactionHash1,
  patchwalletAuthUrl,
  patchwalletTxUrl,
  patchwalletResolverUrl,
  patchwalletTxStatusUrl,
  mockUserOpHash,
  mockTransactionHash2,
} from './utils.js';
import { handleReferralReward } from '../utils/webhook.js';
import Sinon from 'sinon';
import axios from 'axios';
import 'dotenv/config';
import chaiExclude from 'chai-exclude';
import { v4 as uuidv4 } from 'uuid';
import { TRANSACTION_STATUS } from '../utils/constants.js';

chai.use(chaiExclude);

describe('handleReferralReward function', function () {
  let sandbox;
  let axiosStub;
  let rewardId;

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
            },
          });
        }

        if (url === patchwalletTxStatusUrl) {
          return Promise.resolve({
            data: {
              txHash: mockTransactionHash,
              userOpHash: mockUserOpHash,
            },
          });
        }

        if (url === patchwalletResolverUrl) {
          return Promise.resolve({
            data: {
              users: [{ accountAddress: mockWallet }],
            },
          });
        }

        if (url === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK) {
          return Promise.resolve({
            result: 'success',
          });
        }
      });
    rewardId = uuidv4();
  });

  afterEach(function () {
    sandbox.restore();
  });

  // ###########################################
  // ###########################################
  // ###########################################

  describe('No transactions are eligible for a reward', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          patchwallet: mockWallet,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
        },
        {
          patchwallet: mockWallet,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID,
          recipientTgId: 'anotherRecipient',
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: 'anotherRecipient1',
        },
      ]);
    });

    it('Should return true if No transactions are eligible for a reward', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(result).to.be.true;
    });

    it('Should not send any tokens if No transactions are eligible for a reward', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
      ).to.be.undefined;
    });

    it('Should not update the reward database if No transactions are eligible for a reward', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(await collectionRewardsMock.find({}).toArray()).to.be.empty;
    });

    it('Should not call FlowXO if No transactions are eligible for a reward', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(
        axiosStub
          .getCalls()
          .find(
            (e) => e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
          )
      ).to.be.undefined;
    });
  });

  // ###########################################
  // ###########################################
  // ###########################################

  // ###########################################
  // ###########################################
  // ###########################################

  describe('The transaction is already rewarded with the same eventId', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          patchwallet: mockWallet,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
        },
        {
          patchwallet: mockWallet,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID,
          recipientTgId: 'anotherRecipient',
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: 'anotherRecipient1',
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          eventId: rewardId,
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash,
          status: TRANSACTION_STATUS.SUCCESS,
        },
        {
          eventId: rewardId,
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash1,
          status: TRANSACTION_STATUS.SUCCESS,
        },
      ]);
    });

    it('Should return true if The transaction is already rewarded with the same eventId', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(result).to.be.true;
    });

    it('Should not send any tokens if The transaction is already rewarded with the same eventId', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
      ).to.be.undefined;
    });

    it('Should not update the database if The transaction is already rewarded with the same eventId', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            reason: '2x_reward',
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
          },
          {
            eventId: rewardId,
            reason: '2x_reward',
            parentTransactionHash: mockTransactionHash1,
            status: TRANSACTION_STATUS.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO if The transaction is already rewarded with the same eventId', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(
        axiosStub
          .getCalls()
          .find(
            (e) => e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
          )
      ).to.be.undefined;
    });
  });

  // ###########################################
  // ###########################################
  // ###########################################

  // ###########################################
  // ###########################################
  // ###########################################

  describe('The transaction is already rewarded with another eventId', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          patchwallet: mockWallet,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
        },
        {
          patchwallet: mockWallet,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID,
          recipientTgId: 'anotherRecipient',
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: 'anotherRecipient1',
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          eventId: 'anotherEventId',
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash,
        },
        {
          eventId: 'anotherEventId',
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash1,
        },
      ]);
    });

    it('Should return true if The transaction is already rewarded with another eventId', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(result).to.be.true;
    });

    it('Should not send any tokens if The transaction is already rewarded with another eventId', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
      ).to.be.undefined;
    });

    it('Should not update the database if The transaction is already rewarded with another eventId', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: 'anotherEventId',
            reason: '2x_reward',
            parentTransactionHash: mockTransactionHash,
          },
          {
            eventId: 'anotherEventId',
            reason: '2x_reward',
            parentTransactionHash: mockTransactionHash1,
          },
        ]);
    });

    it('Should not call FlowXO if The transaction is already rewarded with another eventId', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(
        axiosStub
          .getCalls()
          .find(
            (e) => e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
          )
      ).to.be.undefined;
    });
  });

  // ###########################################
  // ###########################################
  // ###########################################

  // ###########################################
  // ###########################################
  // ###########################################

  describe('The transaction is already rewarded with no eventId', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          patchwallet: mockWallet,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
        },
        {
          patchwallet: mockWallet,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID,
          recipientTgId: 'anotherRecipient',
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: 'anotherRecipient1',
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash,
        },
        {
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash1,
        },
      ]);
    });

    it('Should return true if The transaction is already rewarded with no eventId', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(result).to.be.true;
    });

    it('Should not send any tokens if The transaction is already rewarded with no eventId', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
      ).to.be.undefined;
    });

    it('Should not update the database if The transaction is already rewarded with no eventId', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            reason: '2x_reward',
            parentTransactionHash: mockTransactionHash,
          },
          {
            reason: '2x_reward',
            parentTransactionHash: mockTransactionHash1,
          },
        ]);
    });

    it('Should not call FlowXO if The transaction is already rewarded with no eventId', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(
        axiosStub
          .getCalls()
          .find(
            (e) => e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
          )
      ).to.be.undefined;
    });
  });

  // ###########################################
  // ###########################################
  // ###########################################

  // ###########################################
  // ###########################################
  // ###########################################

  describe('Reward status are pending at the beginning', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          eventId: rewardId,
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash,
          status: TRANSACTION_STATUS.PENDING,
        },
        {
          eventId: rewardId,
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash1,
          status: TRANSACTION_STATUS.PENDING,
        },
      ]);
    });

    it('Should return true if Reward status are pending at the beginning', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(result).to.be.true;
    });

    it('Should call the sendTokens function properly if Reward status are pending at the beginning', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      const sendTokensCalls = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === patchwalletTxUrl);

      chai.expect(sendTokensCalls.length).to.equal(2);
      chai.expect(sendTokensCalls[0].args[1]).to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe5000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        auth: '',
      });
      chai.expect(sendTokensCalls[1].args[1]).to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe5000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        auth: '',
      });
    });

    it('Should add success reward in database if Reward status are pending at the beginning', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      const rewards = await collectionRewardsMock.find({}).toArray();
      chai.expect(rewards.length).to.equal(2);
      chai
        .expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash1,
            status: TRANSACTION_STATUS.SUCCESS,
          },
        ]);
      chai
        .expect(rewards[0].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
      chai
        .expect(rewards[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[1].dateAdded).to.be.lessThanOrEqual(new Date());
    });
  });

  // ###########################################
  // ###########################################
  // ###########################################

  // ###########################################
  // ###########################################
  // ###########################################

  describe('Reward status are failure at the beginning', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          eventId: rewardId,
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash,
          status: TRANSACTION_STATUS.FAILURE,
        },
        {
          eventId: rewardId,
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash1,
          status: TRANSACTION_STATUS.FAILURE,
        },
      ]);
    });

    it('Should return true if Reward status are failure at the beginning', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(result).to.be.true;
    });

    it('Should send tokens properly if Reward status are failure at the beginning', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      const sendTokensCalls = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === patchwalletTxUrl);

      chai.expect(sendTokensCalls.length).to.equal(2);
      chai.expect(sendTokensCalls[0].args[1]).to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe5000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        auth: '',
      });
      chai.expect(sendTokensCalls[1].args[1]).to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe5000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        auth: '',
      });
    });

    it('Should add success reward in database if Reward status are failure at the beginning', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      const rewards = await collectionRewardsMock.find({}).toArray();
      chai.expect(rewards.length).to.equal(2);
      chai
        .expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash1,
            status: TRANSACTION_STATUS.SUCCESS,
          },
        ]);
      chai
        .expect(rewards[0].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
      chai
        .expect(rewards[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[1].dateAdded).to.be.lessThanOrEqual(new Date());
    });
  });

  // ###########################################
  // ###########################################
  // ###########################################

  // ###########################################
  // ###########################################
  // ###########################################

  describe('Normal process with a new user and transactions to be rewarded', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
      ]);
    });

    it('Should return true if transactions to be rewarded', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai.expect(result).to.be.true;
    });

    it('Should call the sendTokens function properly if transactions to be rewarded', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      const sendTokensCalls = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === patchwalletTxUrl);

      chai.expect(result).to.be.true;
      chai.expect(sendTokensCalls.length).to.equal(2);
      chai.expect(sendTokensCalls[0].args[1]).to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe5000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        auth: '',
      });
      chai.expect(sendTokensCalls[1].args[1]).to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe5000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        auth: '',
      });
    });

    it('Should add success reward in database if transactions to be rewarded', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      const rewards = await collectionRewardsMock.find({}).toArray();
      chai.expect(rewards.length).to.equal(2);
      chai
        .expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash1,
            status: TRANSACTION_STATUS.SUCCESS,
          },
        ]);
      chai
        .expect(rewards[0].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
      chai
        .expect(rewards[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[1].dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should call FlowXO properly if transactions to be rewarded', async function () {
      const result = await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      const flowXOCalls = axiosStub
        .getCalls()
        .filter(
          (e) => e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
        );
      chai.expect(flowXOCalls.length).to.equal(2);

      chai
        .expect(flowXOCalls[0].args[1])
        .excluding(['dateAdded'])
        .to.deep.equal({
          newUserTgId: mockUserTelegramID,
          newUserResponsePath: mockResponsePath,
          newUserUserHandle: mockUserHandle,
          newUserUserName: mockUserName,
          newUserPatchwallet: mockWallet,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: '2x_reward',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '50',
          message: 'Referral reward',
          transactionHash: mockTransactionHash,
          parentTransactionHash: mockTransactionHash,
        });
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.lessThanOrEqual(new Date());

      chai
        .expect(flowXOCalls[1].args[1])
        .excluding(['dateAdded'])
        .to.deep.equal({
          newUserTgId: mockUserTelegramID,
          newUserResponsePath: mockResponsePath,
          newUserUserHandle: mockUserHandle,
          newUserUserName: mockUserName,
          newUserPatchwallet: mockWallet,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: '2x_reward',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '50',
          message: 'Referral reward',
          transactionHash: mockTransactionHash,
          parentTransactionHash: mockTransactionHash1,
        });
      chai
        .expect(flowXOCalls[1].args[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai
        .expect(flowXOCalls[1].args[1].dateAdded)
        .to.be.lessThanOrEqual(new Date());
    });
  });

  // ###########################################
  // ###########################################
  // ###########################################

  it('Should call the sendTokens function properly if the user is new', async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      patchwallet: mockWallet,
    });
    await collectionTransfersMock.insertMany([
      {
        transactionHash: mockTransactionHash,
        senderTgId: mockUserTelegramID1,
        recipientTgId: mockUserTelegramID,
      },
      {
        transactionHash: mockTransactionHash1,
        senderTgId: mockUserTelegramID1,
        recipientTgId: mockUserTelegramID,
      },
    ]);

    const result = await handleReferralReward(
      dbMock,
      rewardId,
      mockUserTelegramID,
      mockResponsePath,
      mockUserHandle,
      mockUserName,
      mockWallet
    );

    const sendTokensCalls = axiosStub
      .getCalls()
      .filter((e) => e.firstArg === patchwalletTxUrl);

    chai.expect(result).to.be.true;
    chai.expect(sendTokensCalls.length).to.equal(2);
    chai.expect(sendTokensCalls[0].args[1]).to.deep.equal({
      userId: `grindery:${process.env.SOURCE_TG_ID}`,
      chain: 'matic',
      to: [process.env.G1_POLYGON_ADDRESS],
      value: ['0x00'],
      data: [
        '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe5000000000000000000000000000000000000000000000002b5e3af16b1880000',
      ],
      auth: '',
    });
    chai.expect(sendTokensCalls[1].args[1]).to.deep.equal({
      userId: `grindery:${process.env.SOURCE_TG_ID}`,
      chain: 'matic',
      to: [process.env.G1_POLYGON_ADDRESS],
      value: ['0x00'],
      data: [
        '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe5000000000000000000000000000000000000000000000002b5e3af16b1880000',
      ],
      auth: '',
    });
  });

  it('Should reward only one transaction if duplicate hash', async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      patchwallet: mockWallet,
    });
    await collectionTransfersMock.insertMany([
      {
        transactionHash: mockTransactionHash,
        senderTgId: mockUserTelegramID1,
        recipientTgId: mockUserTelegramID,
      },
      {
        transactionHash: mockTransactionHash,
        senderTgId: mockUserTelegramID1,
        recipientTgId: mockUserTelegramID,
      },
    ]);

    const result = await handleReferralReward(
      dbMock,
      rewardId,
      mockUserTelegramID,
      mockResponsePath,
      mockUserHandle,
      mockUserName,
      mockWallet
    );

    const sendTokensCalls = axiosStub
      .getCalls()
      .filter((e) => e.firstArg === patchwalletTxUrl);

    chai.expect(result).to.be.true;
    chai.expect(sendTokensCalls.length).to.equal(1);
  });

  it('Should insert the rewards properly in the database', async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      patchwallet: mockWallet,
    });
    await collectionTransfersMock.insertMany([
      {
        transactionHash: mockTransactionHash,
        senderTgId: mockUserTelegramID1,
        recipientTgId: 'newUserTgId',
      },
      {
        transactionHash: mockTransactionHash1,
        senderTgId: mockUserTelegramID1,
        recipientTgId: 'newUserTgId',
      },
    ]);

    await handleReferralReward(
      dbMock,
      rewardId,
      'newUserTgId',
      'newUserResponsePath',
      'newUserUserHandle',
      'newUserUserName',
      'patchwallet'
    );

    const rewards = await collectionRewardsMock.find({}).toArray();

    chai.expect(rewards.length).to.equal(2);
    chai.expect(rewards[0]).excluding(['_id', 'dateAdded']).to.deep.equal({
      eventId: rewardId,
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: '2x_reward',
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: '50',
      message: 'Referral reward',
      transactionHash: mockTransactionHash,
      parentTransactionHash: mockTransactionHash,
      status: TRANSACTION_STATUS.SUCCESS,
    });
    chai
      .expect(rewards[0].dateAdded)
      .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
    chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());

    chai.expect(rewards[1]).excluding(['_id', 'dateAdded']).to.deep.equal({
      eventId: rewardId,
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: '2x_reward',
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: '50',
      message: 'Referral reward',
      transactionHash: mockTransactionHash,
      parentTransactionHash: mockTransactionHash1,
      status: TRANSACTION_STATUS.SUCCESS,
    });
    chai
      .expect(rewards[1].dateAdded)
      .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
    chai.expect(rewards[1].dateAdded).to.be.lessThanOrEqual(new Date());
  });

  it('Should call FlowXO webhook properly if the user is new', async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      patchwallet: mockWallet,
    });
    await collectionTransfersMock.insertMany([
      {
        transactionHash: mockTransactionHash,
        senderTgId: mockUserTelegramID1,
        recipientTgId: 'newUserTgId',
      },
      {
        transactionHash: mockTransactionHash1,
        senderTgId: mockUserTelegramID1,
        recipientTgId: 'newUserTgId',
      },
    ]);

    await handleReferralReward(
      dbMock,
      rewardId,
      'newUserTgId',
      'newUserResponsePath',
      'newUserUserHandle',
      'newUserUserName',
      'patchwallet'
    );

    const flowXOCalls = axiosStub
      .getCalls()
      .filter(
        (e) => e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
      );
    chai.expect(flowXOCalls.length).to.equal(2);

    chai.expect(flowXOCalls[0].args[1]).excluding(['dateAdded']).to.deep.equal({
      newUserTgId: 'newUserTgId',
      newUserResponsePath: 'newUserResponsePath',
      newUserUserHandle: 'newUserUserHandle',
      newUserUserName: 'newUserUserName',
      newUserPatchwallet: 'patchwallet',
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: '2x_reward',
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: '50',
      message: 'Referral reward',
      transactionHash: mockTransactionHash,
      parentTransactionHash: mockTransactionHash,
    });
    chai
      .expect(flowXOCalls[0].args[1].dateAdded)
      .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
    chai
      .expect(flowXOCalls[0].args[1].dateAdded)
      .to.be.lessThanOrEqual(new Date());

    chai.expect(flowXOCalls[1].args[1]).excluding(['dateAdded']).to.deep.equal({
      newUserTgId: 'newUserTgId',
      newUserResponsePath: 'newUserResponsePath',
      newUserUserHandle: 'newUserUserHandle',
      newUserUserName: 'newUserUserName',
      newUserPatchwallet: 'patchwallet',
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: '2x_reward',
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: '50',
      message: 'Referral reward',
      transactionHash: mockTransactionHash,
      parentTransactionHash: mockTransactionHash1,
    });
    chai
      .expect(flowXOCalls[1].args[1].dateAdded)
      .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
    chai
      .expect(flowXOCalls[1].args[1].dateAdded)
      .to.be.lessThanOrEqual(new Date());
  });

  it('Should return true if there is an error in FlowXO webhook', async function () {
    axiosStub
      .withArgs(process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)
      .rejects(new Error('Service not available'));

    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      patchwallet: mockWallet,
    });
    await collectionTransfersMock.insertMany([
      {
        transactionHash: mockTransactionHash,
        senderTgId: mockUserTelegramID1,
        recipientTgId: 'newUserTgId',
      },
      {
        transactionHash: mockTransactionHash1,
        senderTgId: mockUserTelegramID1,
        recipientTgId: 'newUserTgId',
      },
    ]);

    chai.expect(
      await handleReferralReward(
        dbMock,
        rewardId,
        'newUserTgId',
        'newUserResponsePath',
        'newUserUserHandle',
        'newUserUserName',
        'patchwallet'
      )
    ).to.be.true;
  });

  describe('PatchWallet transaction error', function () {
    it('Should return false if there is an error during the token sending', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .rejects(new Error('Service not available'));

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      chai.expect(
        await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        )
      ).to.be.false;
    });

    it('Should return false if there is 1/2 error during the token sending', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .onCall(0)
        .rejects(new Error('Service not available'));

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      chai.expect(
        await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        )
      ).to.be.false;
    });

    it('Should have 1 SUCCESS and 1 PENDING in reward database if there is 1/2 error during the token sending', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .onCall(0)
        .rejects(new Error('Service not available'));

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      const rewards = await collectionRewardsMock.find({}).toArray();

      chai.expect(rewards.length).to.equal(2);
      chai.expect(rewards[0]).excluding(['_id', 'dateAdded']).to.deep.equal({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: '2x_reward',
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '50',
        message: 'Referral reward',
        parentTransactionHash: mockTransactionHash,
        status: TRANSACTION_STATUS.PENDING,
      });
      chai
        .expect(rewards[0].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());

      chai.expect(rewards[1]).excluding(['_id', 'dateAdded']).to.deep.equal({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: '2x_reward',
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '50',
        message: 'Referral reward',
        transactionHash: mockTransactionHash,
        parentTransactionHash: mockTransactionHash1,
        status: TRANSACTION_STATUS.SUCCESS,
      });
      chai
        .expect(rewards[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[1].dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should insert reward as pending in the database if there is an error during the token sending', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .rejects(new Error('Service not available'));

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.PENDING,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            parentTransactionHash: mockTransactionHash1,
            status: TRANSACTION_STATUS.PENDING,
          },
        ]);
    });

    it('Should not call FlowXO webhook if there is an error in the transaction', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .rejects(new Error('Service not available'));

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: 'newUserTgId',
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: 'newUserTgId',
        },
      ]);

      await handleReferralReward(
        dbMock,
        rewardId,
        'newUserTgId',
        'newUserResponsePath',
        'newUserUserHandle',
        'newUserUserName',
        'patchwallet'
      );

      chai.expect(
        axiosStub
          .getCalls()
          .filter(
            (e) => e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
          )
      ).to.be.empty;
    });

    it('Should call FlowXO webhook only 1 time if there is 1/2 error in the transaction', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .onCall(0)
        .rejects(new Error('Service not available'));

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: 'newUserTgId',
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: 'newUserTgId',
        },
      ]);

      await handleReferralReward(
        dbMock,
        rewardId,
        'newUserTgId',
        'newUserResponsePath',
        'newUserUserHandle',
        'newUserUserName',
        'patchwallet'
      );

      const flowXOCalls = axiosStub
        .getCalls()
        .filter(
          (e) => e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
        );

      chai.expect(flowXOCalls.length).to.equal(1);

      chai
        .expect(flowXOCalls[0].args[1])
        .excluding(['dateAdded'])
        .to.deep.equal({
          newUserTgId: 'newUserTgId',
          newUserResponsePath: 'newUserResponsePath',
          newUserUserHandle: 'newUserUserHandle',
          newUserUserName: 'newUserUserName',
          newUserPatchwallet: 'patchwallet',
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: '2x_reward',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '50',
          message: 'Referral reward',
          transactionHash: mockTransactionHash,
          parentTransactionHash: mockTransactionHash1,
        });
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.lessThanOrEqual(new Date());
    });
  });

  describe('PatchWallet transaction without hash', function () {
    it('Should return false if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(patchwalletTxUrl).resolves({
        data: {
          error: 'service non available',
        },
      });

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      chai.expect(
        await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        )
      ).to.be.false;
    });

    it('Should return false if there is 1/2 response without hash in PatchWallet', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .onCall(0)
        .resolves({
          data: {
            error: 'service non available',
          },
        });

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      chai.expect(
        await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        )
      ).to.be.false;
    });

    it('Should insert 1 pending and 1 success in reward database if there is 1/2 without hash in PatchWallet', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .onCall(0)
        .resolves({
          data: {
            error: 'service non available',
          },
        });

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      const rewards = await collectionRewardsMock.find({}).toArray();

      chai.expect(rewards.length).to.equal(2);
      chai.expect(rewards[0]).excluding(['_id', 'dateAdded']).to.deep.equal({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: '2x_reward',
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '50',
        message: 'Referral reward',
        parentTransactionHash: mockTransactionHash,
        status: TRANSACTION_STATUS.PENDING,
      });
      chai
        .expect(rewards[0].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());

      chai.expect(rewards[1]).excluding(['_id', 'dateAdded']).to.deep.equal({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: '2x_reward',
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '50',
        message: 'Referral reward',
        transactionHash: mockTransactionHash,
        parentTransactionHash: mockTransactionHash1,
        status: TRANSACTION_STATUS.SUCCESS,
      });
      chai
        .expect(rewards[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[1].dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should 2 pending in the rewards in the database if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(patchwalletTxUrl).resolves({
        data: {
          error: 'service non available',
        },
      });

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await handleReferralReward(
        dbMock,
        rewardId,
        mockUserTelegramID,
        mockResponsePath,
        mockUserHandle,
        mockUserName,
        mockWallet
      );

      // chai.expect(await collectionRewardsMock.find({}).toArray()).to.be.empty;

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.PENDING,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            parentTransactionHash: mockTransactionHash1,
            status: TRANSACTION_STATUS.PENDING,
          },
        ]);
    });

    it('Should not call FlowXO webhook if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(patchwalletTxUrl).resolves({
        data: {
          error: 'service non available',
        },
      });

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: 'newUserTgId',
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: 'newUserTgId',
        },
      ]);

      await handleReferralReward(
        dbMock,
        rewardId,
        'newUserTgId',
        'newUserResponsePath',
        'newUserUserHandle',
        'newUserUserName',
        'patchwallet'
      );

      chai.expect(
        axiosStub
          .getCalls()
          .filter(
            (e) => e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
          )
      ).to.be.empty;
    });

    it('Should call FlowXO webhook only 1 time if there is 1/2 with no hash in PatchWallet response', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .onCall(0)
        .resolves({
          data: {
            error: 'service non available',
          },
        });

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: 'newUserTgId',
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: 'newUserTgId',
        },
      ]);

      await handleReferralReward(
        dbMock,
        rewardId,
        'newUserTgId',
        'newUserResponsePath',
        'newUserUserHandle',
        'newUserUserName',
        'patchwallet'
      );

      const flowXOCalls = axiosStub
        .getCalls()
        .filter(
          (e) => e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
        );

      chai.expect(flowXOCalls.length).to.equal(1);

      chai
        .expect(flowXOCalls[0].args[1])
        .excluding(['dateAdded'])
        .to.deep.equal({
          newUserTgId: 'newUserTgId',
          newUserResponsePath: 'newUserResponsePath',
          newUserUserHandle: 'newUserUserHandle',
          newUserUserName: 'newUserUserName',
          newUserPatchwallet: 'patchwallet',
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: '2x_reward',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '50',
          message: 'Referral reward',
          transactionHash: mockTransactionHash,
          parentTransactionHash: mockTransactionHash1,
        });
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.lessThanOrEqual(new Date());
    });
  });

  describe('Get transaction hash via userOpHash if transaction hash is empty first', function () {
    describe('Transaction hash is empty in tx PatchWallet endpoint', async function () {
      beforeEach(async function () {
        axiosStub.withArgs(patchwalletTxUrl).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });

        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: 'anotherUserId',
          },
        ]);
      });

      it('Should return false if transaction hash is empty in tx PatchWallet endpoint', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(result).to.be.false;
      });

      it('Should update reward database with a pending_hash status and userOpHash if transaction hash is empty in tx PatchWallet endpoint', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              parentTransactionHash: mockTransactionHash,
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              parentTransactionHash: mockTransactionHash1,
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(
          axiosStub
            .getCalls()
            .find(
              (e) =>
                e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
            )
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

        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: 'anotherUserId',
          },
        ]);

        await collectionRewardsMock.insertMany([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash1,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.SUCCESS,
            parentTransactionHash: mockTransactionHash2,
          },
        ]);
      });

      it('Should return true if transaction hash is present in PatchWallet status endpoint', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is present in PatchWallet status endpoint', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
        ).to.be.undefined;
      });

      it('Should update the database with a success status if transaction hash is present in PatchWallet status endpoint', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash,
              transactionHash: mockTransactionHash,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash1,
              transactionHash: mockTransactionHash,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              parentTransactionHash: mockTransactionHash2,
            },
          ]);
      });

      it('Should call FlowXO webhook properly if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        const flowXOCalls = axiosStub
          .getCalls()
          .filter(
            (e) => e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
          );
        chai.expect(flowXOCalls.length).to.equal(2);

        chai
          .expect(flowXOCalls[0].args[1])
          .excluding(['dateAdded'])
          .to.deep.equal({
            newUserTgId: mockUserTelegramID,
            newUserResponsePath: mockResponsePath,
            newUserUserHandle: mockUserHandle,
            newUserUserName: mockUserName,
            newUserPatchwallet: mockWallet,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
          });
        chai
          .expect(flowXOCalls[0].args[1].dateAdded)
          .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
        chai
          .expect(flowXOCalls[0].args[1].dateAdded)
          .to.be.lessThanOrEqual(new Date());

        chai
          .expect(flowXOCalls[1].args[1])
          .excluding(['dateAdded'])
          .to.deep.equal({
            newUserTgId: mockUserTelegramID,
            newUserResponsePath: mockResponsePath,
            newUserUserHandle: mockUserHandle,
            newUserUserName: mockUserName,
            newUserPatchwallet: mockWallet,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash1,
          });
        chai
          .expect(flowXOCalls[1].args[1].dateAdded)
          .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
        chai
          .expect(flowXOCalls[1].args[1].dateAdded)
          .to.be.lessThanOrEqual(new Date());
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

        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: 'anotherUserId',
          },
        ]);

        await collectionRewardsMock.insertMany([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash1,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.SUCCESS,
            parentTransactionHash: mockTransactionHash2,
          },
        ]);

        axiosStub.withArgs(patchwalletTxStatusUrl).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return false if transaction hash is not present in PatchWallet status endpoint', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(result).to.be.false;
      });

      it('Should not send tokens if transaction hash is not present in PatchWallet status endpoint', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
        ).to.be.undefined;
      });

      it('Should not update database if transaction hash is not present in PatchWallet status endpoint', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash1,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              parentTransactionHash: mockTransactionHash2,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(
          axiosStub
            .getCalls()
            .find(
              (e) =>
                e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
            )
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

        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: 'anotherUserId',
          },
        ]);

        await collectionRewardsMock.insertMany([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash1,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.SUCCESS,
            parentTransactionHash: mockTransactionHash2,
          },
        ]);

        axiosStub
          .withArgs(patchwalletTxStatusUrl)
          .rejects(new Error('Service not available'));
      });

      it('Should return false if Error in PatchWallet get status endpoint', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(result).to.be.false;
      });

      it('Should not send tokens if Error in PatchWallet get status endpoint', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
        ).to.be.undefined;
      });

      it('Should not update database if Error in PatchWallet get status endpoint', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash1,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              parentTransactionHash: mockTransactionHash2,
            },
          ]);
      });

      it('Should not call FlowXO webhook if Error in PatchWallet get status endpoint', async function () {
        await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(
          axiosStub
            .getCalls()
            .find(
              (e) =>
                e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
            )
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

        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: 'anotherUserId',
          },
        ]);

        await collectionRewardsMock.insertMany([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            parentTransactionHash: mockTransactionHash,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            parentTransactionHash: mockTransactionHash1,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.SUCCESS,
            parentTransactionHash: mockTransactionHash2,
          },
        ]);
      });

      it('Should return true if transaction hash is pending_hash without userOpHash', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is pending_hash without userOpHash', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
        ).to.be.undefined;
      });

      it('Should update reward database with a success status if transaction hash is pending_hash without userOpHash', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              parentTransactionHash: mockTransactionHash,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              parentTransactionHash: mockTransactionHash1,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              parentTransactionHash: mockTransactionHash2,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(
          axiosStub
            .getCalls()
            .find(
              (e) =>
                e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
            )
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

        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: 'anotherUserId',
          },
        ]);

        await collectionRewardsMock.insertMany([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            parentTransactionHash: mockTransactionHash,
            dateAdded: new Date(Date.now() - 12 * 60 * 1000),
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            parentTransactionHash: mockTransactionHash1,
            dateAdded: new Date(Date.now() - 12 * 60 * 1000),
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.SUCCESS,
            parentTransactionHash: mockTransactionHash2,
            dateAdded: new Date(Date.now() - 12 * 60 * 1000),
          },
        ]);

        axiosStub.withArgs(patchwalletTxStatusUrl).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return true after 10 min of trying to get status', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(result).to.be.true;
      });

      it('Should not send tokens after 10 min of trying to get status', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
        ).to.be.undefined;
      });

      it('Should update reward database with a failure status after 10 min of trying to get status', async function () {
        const result = await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.FAILURE,
              parentTransactionHash: mockTransactionHash,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.FAILURE,
              parentTransactionHash: mockTransactionHash1,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: '2x_reward',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              parentTransactionHash: mockTransactionHash2,
            },
          ]);
      });

      it('Should not call FlowXO webhook after 10 min of trying to get status', async function () {
        await handleReferralReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        chai.expect(
          axiosStub
            .getCalls()
            .find(
              (e) =>
                e.firstArg === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK
            )
        ).to.be.undefined;
      });
    });
  });
});
