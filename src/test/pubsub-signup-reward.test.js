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
  patchwalletAuthUrl,
  patchwalletTxUrl,
  mockUserOpHash,
  patchwalletTxStatusUrl,
  mockUserOpHash1,
} from './utils.js';
import { handleSignUpReward } from '../utils/webhook.js';
import Sinon from 'sinon';
import axios from 'axios';
import 'dotenv/config';
import chaiExclude from 'chai-exclude';
import { v4 as uuidv4 } from 'uuid';
import { TRANSACTION_STATUS } from '../utils/constants.js';

chai.use(chaiExclude);

describe('handleSignUpReward function', async function () {
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
              userOpHash: mockUserOpHash,
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

        if (url == process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK) {
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

  describe('Sign up reward already exists with same eventId and is a success', async function () {
    beforeEach(async function () {
      await collectionRewardsMock.insertOne({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        reason: 'user_sign_up',
        status: TRANSACTION_STATUS.SUCCESS,
      });
    });

    it('Should return true if Sign up reward already exists with same eventId and is a success', async function () {
      const result = await handleSignUpReward(
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

    it('Should send tokens if Sign up reward already exists with same eventId and is a success', async function () {
      const result = await handleSignUpReward(
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

    it('Should not update the dabatase if Sign up reward already exists with same eventId and is a success', async function () {
      const result = await handleSignUpReward(
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
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID,
            reason: 'user_sign_up',
            status: TRANSACTION_STATUS.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO if Sign up reward already exists with same eventId and is a success', async function () {
      const result = await handleSignUpReward(
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
            (e) => e.firstArg === process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK
          )
      ).to.be.undefined;
    });
  });

  // ############################
  // ############################
  // ############################

  describe('Sign up reward already exists with another eventId', async function () {
    beforeEach(async function () {
      await collectionRewardsMock.insertOne({
        eventId: 'anotherEventId',
        userTelegramID: mockUserTelegramID,
        reason: 'user_sign_up',
        status: TRANSACTION_STATUS.SUCCESS,
      });
    });

    it('Should return true if Sign up reward already exists with another eventId', async function () {
      const result = await handleSignUpReward(
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

    it('Should send tokens if Sign up reward already exists with another eventId', async function () {
      const result = await handleSignUpReward(
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

    it('Should not update the dabatase if Sign up reward already exists with another eventId', async function () {
      const result = await handleSignUpReward(
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
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: 'anotherEventId',
            userTelegramID: mockUserTelegramID,
            reason: 'user_sign_up',
            status: TRANSACTION_STATUS.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO if Sign up reward already exists with another eventId', async function () {
      const result = await handleSignUpReward(
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
            (e) => e.firstArg === process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK
          )
      ).to.be.undefined;
    });
  });

  // ############################
  // ############################
  // ############################

  it('Should return true and no token sending if another sign up reward exists without eventId', async function () {
    await collectionRewardsMock.insertOne({
      userTelegramID: mockUserTelegramID,
      reason: 'user_sign_up',
    });

    const result = await handleSignUpReward(
      dbMock,
      rewardId,
      mockUserTelegramID,
      mockResponsePath,
      mockUserHandle,
      mockUserName,
      mockWallet
    );

    chai.expect(result).to.be.true;
    chai.expect(
      axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
    ).to.be.undefined;
    chai
      .expect(await collectionRewardsMock.find({}).toArray())
      .excluding(['_id'])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID,
          reason: 'user_sign_up',
        },
      ]);
  });

  it('Should return true and no token sending if another sign up reward exists with another eventID', async function () {
    await collectionRewardsMock.insertOne({
      userTelegramID: mockUserTelegramID,
      reason: 'user_sign_up',
      eventId: 'another_event_id',
    });

    const result = await handleSignUpReward(
      dbMock,
      rewardId,
      mockUserTelegramID,
      mockResponsePath,
      mockUserHandle,
      mockUserName,
      mockWallet
    );

    chai.expect(result).to.be.true;
    chai.expect(
      axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
    ).to.be.undefined;
    chai
      .expect(await collectionRewardsMock.find({}).toArray())
      .excluding(['_id'])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID,
          reason: 'user_sign_up',
          eventId: 'another_event_id',
        },
      ]);
  });

  it('Should return true, call the sendTokens function properly and update reward status if status is pending', async function () {
    await collectionRewardsMock.insertOne({
      eventId: rewardId,
      userTelegramID: mockUserTelegramID,
      reason: 'user_sign_up',
      status: TRANSACTION_STATUS.PENDING,
    });

    const result = await handleSignUpReward(
      dbMock,
      rewardId,
      mockUserTelegramID,
      mockResponsePath,
      mockUserHandle,
      mockUserName,
      mockWallet
    );

    chai.expect(result).to.be.true;
    chai
      .expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
          .args[1]
      )
      .to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
        ],
        auth: '',
      });
    chai
      .expect(await collectionRewardsMock.find({}).toArray())
      .excluding(['_id', 'dateAdded'])
      .to.deep.equal([
        {
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
          transactionHash: mockTransactionHash,
          status: TRANSACTION_STATUS.SUCCESS,
        },
      ]);
  });

  it('Should return true, call the sendTokens function properly and update reward status if status is failure', async function () {
    await collectionRewardsMock.insertOne({
      eventId: rewardId,
      userTelegramID: mockUserTelegramID,
      reason: 'user_sign_up',
      status: TRANSACTION_STATUS.FAILURE,
    });

    const result = await handleSignUpReward(
      dbMock,
      rewardId,
      mockUserTelegramID,
      mockResponsePath,
      mockUserHandle,
      mockUserName,
      mockWallet
    );

    chai.expect(result).to.be.true;
    chai
      .expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
          .args[1]
      )
      .to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
        ],
        auth: '',
      });
    chai
      .expect(await collectionRewardsMock.find({}).toArray())
      .excluding(['_id', 'dateAdded'])
      .to.deep.equal([
        {
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
          transactionHash: mockTransactionHash,
          status: TRANSACTION_STATUS.SUCCESS,
        },
      ]);
  });

  it('Should call the sendTokens function properly if the user is new', async function () {
    await handleSignUpReward(
      dbMock,
      rewardId,
      mockUserTelegramID,
      mockResponsePath,
      mockUserHandle,
      mockUserName,
      mockWallet
    );

    chai
      .expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
          .args[1]
      )
      .to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: 'matic',
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
        ],
        auth: '',
      });
  });

  it('Should insert a new element in the reward collection of the database if the user is new', async function () {
    await handleSignUpReward(
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
    chai.expect(rewards[0]).excluding(['_id', 'dateAdded']).to.deep.equal({
      eventId: rewardId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: 'user_sign_up',
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: '100',
      message: 'Sign up reward',
      transactionHash: mockTransactionHash,
      status: TRANSACTION_STATUS.SUCCESS,
    });
    chai
      .expect(rewards[0].dateAdded)
      .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
    chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
  });

  it('Should call FlowXO webhook properly if the user is new', async function () {
    await handleSignUpReward(
      dbMock,
      rewardId,
      mockUserTelegramID,
      mockResponsePath,
      mockUserHandle,
      mockUserName,
      mockWallet
    );

    const FlowXOCallArgs = axiosStub
      .getCalls()
      .find((e) => e.firstArg === process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)
      .args[1];

    chai.expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: 'user_sign_up',
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: '100',
      message: 'Sign up reward',
      transactionHash: mockTransactionHash,
    });

    chai
      .expect(FlowXOCallArgs.dateAdded)
      .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
    chai.expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
  });

  it('Should return true if the user is new', async function () {
    chai.expect(
      await handleSignUpReward(
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

  it('Should not add the user in the database (in handleSignUpReward) if the user is new', async function () {
    await handleSignUpReward(
      dbMock,
      rewardId,
      mockUserTelegramID,
      mockResponsePath,
      mockUserHandle,
      mockUserName,
      mockWallet
    );
    chai.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
  });

  it('Should return true if there is an error in FlowXO', async function () {
    axiosStub
      .withArgs(process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)
      .rejects(new Error('Service not available'));

    chai.expect(
      await handleSignUpReward(
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
    it('Should return false if there is an error in the transaction', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .rejects(new Error('Service not available'));

      chai.expect(
        await handleSignUpReward(
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

    it('Should set signup reward to pending in db if there is an error in the transaction', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .rejects(new Error('Service not available'));

      await handleSignUpReward(
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
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: 'user_sign_up',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '100',
            message: 'Sign up reward',
            dateAdded: new Date(),
            status: TRANSACTION_STATUS.PENDING,
          },
        ]);
    });

    it('Should not call FlowXO if there is an error in the transaction', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .rejects(new Error('Service not available'));

      await handleSignUpReward(
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
            (e) => e.firstArg === process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK
          )
      ).to.be.undefined;
    });
  });

  describe('PatchWallet transaction without hash', function () {
    it('Should return false if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(patchwalletTxUrl).resolves({
        data: {
          error: 'service non available',
        },
      });
      chai.expect(
        await handleSignUpReward(
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

    it('Should set signup reward to pending in db if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(patchwalletTxUrl).resolves({
        data: {
          error: 'service non available',
        },
      });
      await handleSignUpReward(
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
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: 'user_sign_up',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '100',
            message: 'Sign up reward',
            status: TRANSACTION_STATUS.PENDING,
          },
        ]);
    });

    it('Should not call FlowXO if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(patchwalletTxUrl).resolves({
        data: {
          error: 'service non available',
        },
      });
      await handleSignUpReward(
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
            (e) => e.firstArg === process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK
          )
      ).to.be.undefined;
    });
  });

  describe('Get transaction hash via userOpHash if transaction hash is empty first', async function () {
    describe('Transaction hash is empty in tx PatchWallet endpoint', async function () {
      beforeEach(async function () {
        axiosStub.withArgs(patchwalletTxUrl).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return false if transaction hash is empty in tx PatchWallet endpoint', async function () {
        const result = await handleSignUpReward(
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
        const result = await handleSignUpReward(
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
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'user_sign_up',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '100',
              message: 'Sign up reward',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleSignUpReward(
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
              (e) => e.firstArg === process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK
            )
        ).to.be.undefined;
      });
    });

    describe('Transaction hash is present in PatchWallet status endpoint', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
          status: TRANSACTION_STATUS.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });
      });

      it('Should return true if transaction hash is present in PatchWallet status endpoint', async function () {
        const result = await handleSignUpReward(
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
        const result = await handleSignUpReward(
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
        const result = await handleSignUpReward(
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
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'user_sign_up',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '100',
              message: 'Sign up reward',
              status: TRANSACTION_STATUS.SUCCESS,
              transactionHash: mockTransactionHash,
              userOpHash: mockUserOpHash,
            },
          ]);
      });

      it('Should call FlowXO webhook properly if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleSignUpReward(
          dbMock,
          rewardId,
          mockUserTelegramID,
          mockResponsePath,
          mockUserHandle,
          mockUserName,
          mockWallet
        );

        const FlowXOCallArgs = axiosStub
          .getCalls()
          .find(
            (e) => e.firstArg === process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK
          ).args[1];

        chai.expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
          transactionHash: mockTransactionHash,
        });

        chai
          .expect(FlowXOCallArgs.dateAdded)
          .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
        chai.expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
      });
    });

    describe('Transaction hash is not present in PatchWallet status endpoint', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
          status: TRANSACTION_STATUS.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });

        axiosStub.withArgs(patchwalletTxStatusUrl).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return false if transaction hash is not present in PatchWallet status endpoint', async function () {
        const result = await handleSignUpReward(
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
        const result = await handleSignUpReward(
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
        const result = await handleSignUpReward(
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
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'user_sign_up',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '100',
              message: 'Sign up reward',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleSignUpReward(
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
              (e) => e.firstArg === process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK
            )
        ).to.be.undefined;
      });
    });

    describe('Error in PatchWallet get status endpoint', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
          status: TRANSACTION_STATUS.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });

        axiosStub
          .withArgs(patchwalletTxStatusUrl)
          .rejects(new Error('Service not available'));
      });

      it('Should return false if Error in PatchWallet get status endpoint', async function () {
        const result = await handleSignUpReward(
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
        const result = await handleSignUpReward(
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
        const result = await handleSignUpReward(
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
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'user_sign_up',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '100',
              message: 'Sign up reward',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
            },
          ]);
      });

      it('Should not call FlowXO webhook if Error in PatchWallet get status endpoint', async function () {
        await handleSignUpReward(
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
              (e) => e.firstArg === process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK
            )
        ).to.be.undefined;
      });
    });

    describe('Transaction is set to success without transaction hash if pending_hash without userOpHash', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
          status: TRANSACTION_STATUS.PENDING_HASH,
        });
      });

      it('Should return true if transaction hash is pending_hash without userOpHash', async function () {
        const result = await handleSignUpReward(
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
        const result = await handleSignUpReward(
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
        const result = await handleSignUpReward(
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
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'user_sign_up',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '100',
              message: 'Sign up reward',
              status: TRANSACTION_STATUS.SUCCESS,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleSignUpReward(
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
              (e) => e.firstArg === process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK
            )
        ).to.be.undefined;
      });
    });

    describe('Transaction is considered as failure after 10 min of trying to get status', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'user_sign_up',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '100',
          message: 'Sign up reward',
          status: TRANSACTION_STATUS.PENDING_HASH,
          userOpHash: mockUserOpHash,
          dateAdded: new Date(Date.now() - 12 * 60 * 1000),
        });

        axiosStub.withArgs(patchwalletTxStatusUrl).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return true after 10 min of trying to get status', async function () {
        const result = await handleSignUpReward(
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
        const result = await handleSignUpReward(
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
        const result = await handleSignUpReward(
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
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'user_sign_up',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '100',
              message: 'Sign up reward',
              userOpHash: mockUserOpHash,
              status: TRANSACTION_STATUS.FAILURE,
            },
          ]);
      });

      it('Should not call FlowXO webhook after 10 min of trying to get status', async function () {
        await handleSignUpReward(
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
              (e) => e.firstArg === process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK
            )
        ).to.be.undefined;
      });
    });
  });
});
