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
  mockUserTelegramID2,
  mockResponsePath1,
  mockUserHandle1,
  mockUserName1,
  mockWallet1,
  mockResponsePath2,
  mockUserHandle2,
  mockUserName2,
  mockWallet2,
  mockUserOpHash1,
  mockUserOpHash2,
  mockUserTelegramID3,
  mockResponsePath3,
  mockUserHandle3,
  mockUserName3,
  mockWallet3,
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
          patchwallet: mockWallet1,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
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

  describe('The transaction is already rewarded with the same eventId', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          patchwallet: mockWallet1,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
        },
        {
          patchwallet: mockWallet2,
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          eventId: rewardId,
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash,
          userTelegramID: mockUserTelegramID1,
          status: TRANSACTION_STATUS.SUCCESS,
        },
        {
          eventId: rewardId,
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash1,
          userTelegramID: mockUserTelegramID2,
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
            userTelegramID: mockUserTelegramID1,
            status: TRANSACTION_STATUS.SUCCESS,
          },
          {
            eventId: rewardId,
            reason: '2x_reward',
            parentTransactionHash: mockTransactionHash1,
            userTelegramID: mockUserTelegramID2,
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

  describe('The transaction is already rewarded with another eventId', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          patchwallet: mockWallet1,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
        },
        {
          patchwallet: mockWallet2,
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          eventId: 'anotherEventId',
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID1,
          parentTransactionHash: mockTransactionHash,
        },
        {
          eventId: 'anotherEventId',
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID2,
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
            userTelegramID: mockUserTelegramID1,
            parentTransactionHash: mockTransactionHash,
          },
          {
            eventId: 'anotherEventId',
            reason: '2x_reward',
            userTelegramID: mockUserTelegramID2,
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

  describe('The transaction is already rewarded with no eventId', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          patchwallet: mockWallet1,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
        },
        {
          patchwallet: mockWallet2,
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash,
        },
        {
          userTelegramID: mockUserTelegramID2,
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
            userTelegramID: mockUserTelegramID1,
            reason: '2x_reward',
            parentTransactionHash: mockTransactionHash,
          },
          {
            userTelegramID: mockUserTelegramID2,
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

  describe('Reward status are pending at the beginning', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          eventId: rewardId,
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID1,
          parentTransactionHash: mockTransactionHash,
          status: TRANSACTION_STATUS.PENDING,
        },
        {
          eventId: rewardId,
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID2,
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
          '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        auth: '',
      });
      chai.expect(sendTokensCalls[1].args[1]).to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb000000000000000000000000699791a03ac2b58e1b7ca29b601c69f223c78e9c000000000000000000000000000000000000000000000002b5e3af16b1880000',
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
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: '2x_reward',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
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

    it('Should call FlowXO properly if Reward status are pending at the beginning', async function () {
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
          responsePath: mockResponsePath1,
          walletAddress: mockWallet1,
          reason: '2x_reward',
          userHandle: mockUserHandle1,
          userName: mockUserName1,
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
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          walletAddress: mockWallet2,
          reason: '2x_reward',
          userHandle: mockUserHandle2,
          userName: mockUserName2,
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

  describe('Reward status are failure at the beginning', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          eventId: rewardId,
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID1,
          parentTransactionHash: mockTransactionHash,
          status: TRANSACTION_STATUS.FAILURE,
        },
        {
          eventId: rewardId,
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID2,
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

    it('Should call the sendTokens function properly if Reward status are failure at the beginning', async function () {
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
          '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        auth: '',
      });
      chai.expect(sendTokensCalls[1].args[1]).to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb000000000000000000000000699791a03ac2b58e1b7ca29b601c69f223c78e9c000000000000000000000000000000000000000000000002b5e3af16b1880000',
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
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: '2x_reward',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
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

    it('Should call FlowXO properly if Reward status are failure at the beginning', async function () {
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
          responsePath: mockResponsePath1,
          walletAddress: mockWallet1,
          reason: '2x_reward',
          userHandle: mockUserHandle1,
          userName: mockUserName1,
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
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          walletAddress: mockWallet2,
          reason: '2x_reward',
          userHandle: mockUserHandle2,
          userName: mockUserName2,
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

  describe('Normal process with a new user and transactions to be rewarded', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
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

      chai.expect(sendTokensCalls.length).to.equal(2);
      chai.expect(sendTokensCalls[0].args[1]).to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        auth: '',
      });
      chai.expect(sendTokensCalls[1].args[1]).to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb000000000000000000000000699791a03ac2b58e1b7ca29b601c69f223c78e9c000000000000000000000000000000000000000000000002b5e3af16b1880000',
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
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: '2x_reward',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
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
          responsePath: mockResponsePath1,
          walletAddress: mockWallet1,
          reason: '2x_reward',
          userHandle: mockUserHandle1,
          userName: mockUserName1,
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
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          walletAddress: mockWallet2,
          reason: '2x_reward',
          userHandle: mockUserHandle2,
          userName: mockUserName2,
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

  describe('Normal process with a new user and transactions to be rewarded with same hash', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
        },
      ]);
    });

    it('Should return true if transactions to be rewarded with same hash', async function () {
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

    it('Should call the sendTokens function properly if transactions to be rewarded with same hash', async function () {
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
          '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        auth: '',
      });
      chai.expect(sendTokensCalls[1].args[1]).to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb000000000000000000000000699791a03ac2b58e1b7ca29b601c69f223c78e9c000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        auth: '',
      });
    });

    it('Should add success reward in database if transactions to be rewarded with same hash', async function () {
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
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: '2x_reward',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
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

    it('Should call FlowXO properly if transactions to be rewarded with same hash', async function () {
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
          responsePath: mockResponsePath1,
          walletAddress: mockWallet1,
          reason: '2x_reward',
          userHandle: mockUserHandle1,
          userName: mockUserName1,
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
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          walletAddress: mockWallet2,
          reason: '2x_reward',
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          amount: '50',
          message: 'Referral reward',
          transactionHash: mockTransactionHash,
          parentTransactionHash: mockTransactionHash,
        });
      chai
        .expect(flowXOCalls[1].args[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai
        .expect(flowXOCalls[1].args[1].dateAdded)
        .to.be.lessThanOrEqual(new Date());
    });
  });

  describe('Duplicate user in transactions to be rewarded', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);

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

    it('Should return true if duplicate user in transactions to be rewarded', async function () {
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

    it('Should call the sendTokens function properly only once if duplicate user in transactions to be rewarded', async function () {
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

      chai.expect(sendTokensCalls.length).to.equal(1);
      chai.expect(sendTokensCalls[0].args[1]).to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        auth: '',
      });
    });

    it('Should add success reward in database only once if duplicate user in transactions to be rewarded', async function () {
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
      chai.expect(rewards.length).to.equal(1);
      chai
        .expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
          },
        ]);
      chai
        .expect(rewards[0].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should call FlowXO properly only one time if duplicate user in transactions to be rewarded', async function () {
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
      chai.expect(flowXOCalls.length).to.equal(1);

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
          responsePath: mockResponsePath1,
          walletAddress: mockWallet1,
          reason: '2x_reward',
          userHandle: mockUserHandle1,
          userName: mockUserName1,
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
    });
  });

  it('Should return true if there is an error in FlowXO webhook', async function () {
    axiosStub
      .withArgs(process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)
      .rejects(new Error('Service not available'));

    await collectionUsersMock.insertMany([
      {
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath1,
        userHandle: mockUserHandle1,
        userName: mockUserName1,
        patchwallet: mockWallet1,
      },
      {
        userTelegramID: mockUserTelegramID2,
        responsePath: mockResponsePath2,
        userHandle: mockUserHandle2,
        userName: mockUserName2,
        patchwallet: mockWallet2,
      },
    ]);
    await collectionTransfersMock.insertMany([
      {
        transactionHash: mockTransactionHash,
        senderTgId: mockUserTelegramID1,
        recipientTgId: mockUserTelegramID,
      },
      {
        transactionHash: mockTransactionHash1,
        senderTgId: mockUserTelegramID2,
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
    ).to.be.true;
  });

  describe('PatchWallet transaction error', function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
        },
      ]);
    });

    it('Should return false if there is an error during the token sending', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .rejects(new Error('Service not available'));

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
        responsePath: mockResponsePath1,
        walletAddress: mockWallet1,
        reason: '2x_reward',
        userHandle: mockUserHandle1,
        userName: mockUserName1,
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
        userTelegramID: mockUserTelegramID2,
        responsePath: mockResponsePath2,
        walletAddress: mockWallet2,
        reason: '2x_reward',
        userHandle: mockUserHandle2,
        userName: mockUserName2,
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
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.PENDING,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: '2x_reward',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
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

      chai.expect(flowXOCalls.length).to.equal(1);

      chai
        .expect(flowXOCalls[0].args[1])
        .excluding(['dateAdded'])
        .to.deep.equal({
          newUserTgId: mockUserTelegramID,
          newUserResponsePath: mockResponsePath,
          newUserUserHandle: mockUserHandle,
          newUserUserName: mockUserName,
          newUserPatchwallet: mockWallet,
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          walletAddress: mockWallet2,
          reason: '2x_reward',
          userHandle: mockUserHandle2,
          userName: mockUserName2,
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
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
        },
      ]);
    });

    it('Should return false if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(patchwalletTxUrl).resolves({
        data: {
          error: 'service non available',
        },
      });

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
      chai
        .expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.PENDING,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: '2x_reward',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
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

    it('Should 2 pending in the rewards in the database if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(patchwalletTxUrl).resolves({
        data: {
          error: 'service non available',
        },
      });

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
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.PENDING,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: '2x_reward',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
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

      chai.expect(flowXOCalls.length).to.equal(1);

      chai
        .expect(flowXOCalls[0].args[1])
        .excluding(['dateAdded'])
        .to.deep.equal({
          newUserTgId: mockUserTelegramID,
          newUserResponsePath: mockResponsePath,
          newUserUserHandle: mockUserHandle,
          newUserUserName: mockUserName,
          newUserPatchwallet: mockWallet,
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          walletAddress: mockWallet2,
          reason: '2x_reward',
          userHandle: mockUserHandle2,
          userName: mockUserName2,
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

        await collectionUsersMock.insertMany([
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            patchwallet: mockWallet2,
          },
        ]);

        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID2,
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
              responsePath: mockResponsePath1,
              walletAddress: mockWallet1,
              reason: '2x_reward',
              userHandle: mockUserHandle1,
              userName: mockUserName1,
              amount: '50',
              message: 'Referral reward',
              parentTransactionHash: mockTransactionHash,
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID2,
              responsePath: mockResponsePath2,
              walletAddress: mockWallet2,
              reason: '2x_reward',
              userHandle: mockUserHandle2,
              userName: mockUserName2,
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
        await collectionUsersMock.insertMany([
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            patchwallet: mockWallet2,
          },
          {
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            userHandle: mockUserHandle3,
            userName: mockUserName3,
            patchwallet: mockWallet3,
          },
        ]);

        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID2,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID3,
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
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash1,
            parentTransactionHash: mockTransactionHash,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: '2x_reward',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash2,
            parentTransactionHash: mockTransactionHash1,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            walletAddress: mockWallet3,
            reason: '2x_reward',
            userHandle: mockUserHandle3,
            userName: mockUserName3,
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
              responsePath: mockResponsePath1,
              walletAddress: mockWallet1,
              reason: '2x_reward',
              userHandle: mockUserHandle1,
              userName: mockUserName1,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              userOpHash: mockUserOpHash1,
              transactionHash: mockTransactionHash,
              parentTransactionHash: mockTransactionHash,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID2,
              responsePath: mockResponsePath2,
              walletAddress: mockWallet2,
              reason: '2x_reward',
              userHandle: mockUserHandle2,
              userName: mockUserName2,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              userOpHash: mockUserOpHash2,
              transactionHash: mockTransactionHash,
              parentTransactionHash: mockTransactionHash1,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID3,
              responsePath: mockResponsePath3,
              walletAddress: mockWallet3,
              reason: '2x_reward',
              userHandle: mockUserHandle3,
              userName: mockUserName3,
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
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
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
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: '2x_reward',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
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
        await collectionUsersMock.insertMany([
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            patchwallet: mockWallet2,
          },
          {
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            userHandle: mockUserHandle3,
            userName: mockUserName3,
            patchwallet: mockWallet3,
          },
        ]);

        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID2,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID3,
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
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: '2x_reward',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash1,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            walletAddress: mockWallet3,
            reason: '2x_reward',
            userHandle: mockUserHandle3,
            userName: mockUserName3,
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
              responsePath: mockResponsePath1,
              walletAddress: mockWallet1,
              reason: '2x_reward',
              userHandle: mockUserHandle1,
              userName: mockUserName1,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID2,
              responsePath: mockResponsePath2,
              walletAddress: mockWallet2,
              reason: '2x_reward',
              userHandle: mockUserHandle2,
              userName: mockUserName2,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash1,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID3,
              responsePath: mockResponsePath3,
              walletAddress: mockWallet3,
              reason: '2x_reward',
              userHandle: mockUserHandle3,
              userName: mockUserName3,
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
        await collectionUsersMock.insertMany([
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            patchwallet: mockWallet2,
          },
          {
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            userHandle: mockUserHandle3,
            userName: mockUserName3,
            patchwallet: mockWallet3,
          },
        ]);

        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID2,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID3,
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
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: '2x_reward',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash1,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            walletAddress: mockWallet3,
            reason: '2x_reward',
            userHandle: mockUserHandle3,
            userName: mockUserName3,
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
              responsePath: mockResponsePath1,
              walletAddress: mockWallet1,
              reason: '2x_reward',
              userHandle: mockUserHandle1,
              userName: mockUserName1,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID2,
              responsePath: mockResponsePath2,
              walletAddress: mockWallet2,
              reason: '2x_reward',
              userHandle: mockUserHandle2,
              userName: mockUserName2,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash1,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID3,
              responsePath: mockResponsePath3,
              walletAddress: mockWallet3,
              reason: '2x_reward',
              userHandle: mockUserHandle3,
              userName: mockUserName3,
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
        await collectionUsersMock.insertMany([
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            patchwallet: mockWallet2,
          },
          {
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            userHandle: mockUserHandle3,
            userName: mockUserName3,
            patchwallet: mockWallet3,
          },
        ]);

        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID2,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID3,
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
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            parentTransactionHash: mockTransactionHash,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: '2x_reward',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            parentTransactionHash: mockTransactionHash1,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            walletAddress: mockWallet3,
            reason: '2x_reward',
            userHandle: mockUserHandle3,
            userName: mockUserName3,
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
              responsePath: mockResponsePath1,
              walletAddress: mockWallet1,
              reason: '2x_reward',
              userHandle: mockUserHandle1,
              userName: mockUserName1,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              parentTransactionHash: mockTransactionHash,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID2,
              responsePath: mockResponsePath2,
              walletAddress: mockWallet2,
              reason: '2x_reward',
              userHandle: mockUserHandle2,
              userName: mockUserName2,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              parentTransactionHash: mockTransactionHash1,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID3,
              responsePath: mockResponsePath3,
              walletAddress: mockWallet3,
              reason: '2x_reward',
              userHandle: mockUserHandle3,
              userName: mockUserName3,
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
        await collectionUsersMock.insertMany([
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            patchwallet: mockWallet2,
          },
          {
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            userHandle: mockUserHandle3,
            userName: mockUserName3,
            patchwallet: mockWallet3,
          },
        ]);

        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID2,
            recipientTgId: mockUserTelegramID,
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID3,
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
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash,
            dateAdded: new Date(Date.now() - 12 * 60 * 1000),
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: '2x_reward',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash1,
            dateAdded: new Date(Date.now() - 12 * 60 * 1000),
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            walletAddress: mockWallet3,
            reason: '2x_reward',
            userHandle: mockUserHandle3,
            userName: mockUserName3,
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
              responsePath: mockResponsePath1,
              walletAddress: mockWallet1,
              reason: '2x_reward',
              userHandle: mockUserHandle1,
              userName: mockUserName1,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.FAILURE,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID2,
              responsePath: mockResponsePath2,
              walletAddress: mockWallet2,
              reason: '2x_reward',
              userHandle: mockUserHandle2,
              userName: mockUserName2,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.FAILURE,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash1,
            },
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID3,
              responsePath: mockResponsePath3,
              walletAddress: mockWallet3,
              reason: '2x_reward',
              userHandle: mockUserHandle3,
              userName: mockUserName3,
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
