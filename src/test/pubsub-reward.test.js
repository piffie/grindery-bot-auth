import chai from "chai";
import {
  collectionRewardsMock,
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
  mockResponsePath1,
  mockUserHandle1,
  mockUserName1,
  mockWallet1,
} from "./utils.js";
import { handleNewReward } from "../utils/webhook.js";
import Sinon from "sinon";
import axios from "axios";
import "dotenv/config";
import chaiExclude from "chai-exclude";

chai.use(chaiExclude);

describe("handleReferralReward function", function () {
  let sandbox;
  let axiosStub;

  beforeEach(function () {
    sandbox = Sinon.createSandbox();
    axiosStub = sandbox
      .stub(axios, "post")
      .callsFake(async (url, data, options) => {
        if (url === "https://paymagicapi.com/v1/auth") {
          return Promise.resolve({
            data: {
              access_token: mockAccessToken,
            },
          });
        }

        if (url === "https://paymagicapi.com/v1/kernel/tx") {
          return Promise.resolve({
            data: {
              txHash: mockTransactionHash,
            },
          });
        }

        if (url === "https://paymagicapi.com/v1/resolver") {
          return Promise.resolve({
            data: {
              users: [{ accountAddress: mockWallet }],
            },
          });
        }

        if (url === process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK) {
          return Promise.resolve({
            result: "success",
          });
        }
      });
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("Should return true with no reward if user is not new", async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
    });

    const result = await handleNewReward({
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(result).to.be.true;
    chai.expect(await collectionRewardsMock.find({}).toArray()).to.be.empty;
    chai
      .expect(await collectionUsersMock.find({}).toArray())
      .excluding(["_id"])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID,
        },
      ]);
  });

  it("Should add sign up reward to database and return true", async function () {
    const result = await handleNewReward({
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    const rewards = await collectionRewardsMock.find({}).toArray();

    chai.expect(result).to.be.true;
    chai.expect(rewards.length).to.equal(1);
    chai.expect(rewards[0]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: "user_sign_up",
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: "100",
      message: "Sign up reward",
      transactionHash: mockTransactionHash,
    });
  });

  it("Should return false and no reward if error in sign up reward transaction", async function () {
    axiosStub.withArgs("https://paymagicapi.com/v1/kernel/tx").resolves({
      data: {
        error: "service non available",
      },
    });

    const result = await handleNewReward({
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(result).to.be.false;
    chai.expect(await collectionRewardsMock.find({}).toArray()).to.be.empty;
  });

  it("Should return true and populate database properly after restart", async function () {
    axiosStub
      .withArgs("https://paymagicapi.com/v1/kernel/tx")
      .onCall(0)
      .resolves({
        data: {
          error: "service non available",
        },
      });

    let result = await handleNewReward({
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });
    let rewards = await collectionRewardsMock.find({}).toArray();

    chai.expect(result).to.be.false;
    chai.expect(rewards).to.be.empty;

    // Restart
    result = await handleNewReward({
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });
    rewards = await collectionRewardsMock.find({}).toArray();

    chai.expect(result).to.be.true;
    chai.expect(rewards.length).to.equal(1);
    chai.expect(rewards[0]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: "user_sign_up",
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: "100",
      message: "Sign up reward",
      transactionHash: mockTransactionHash,
    });
  });

  it("Should add sign up reward and referral rewards if some", async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      patchwallet: mockWallet1,
    });
    await collectionTransfersMock.insertMany([
      {
        transactionHash: mockTransactionHash,
        senderTgId: mockUserTelegramID1,
        recipientTgId: "newUserTgId",
      },
      {
        transactionHash: mockTransactionHash1,
        senderTgId: mockUserTelegramID1,
        recipientTgId: "newUserTgId",
      },
    ]);

    const result = await handleNewReward({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    const rewards = await collectionRewardsMock.find({}).toArray();

    chai.expect(result).to.be.true;
    chai.expect(rewards.length).to.equal(3);

    chai.expect(rewards[0]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: "user_sign_up",
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: "100",
      message: "Sign up reward",
      transactionHash: mockTransactionHash,
    });

    chai.expect(rewards[1]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      walletAddress: mockWallet1,
      reason: "2x_reward",
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      amount: "50",
      message: "Referral reward",
      transactionHash: mockTransactionHash,
      parentTransactionHash: mockTransactionHash,
    });

    chai.expect(rewards[2]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      walletAddress: mockWallet1,
      reason: "2x_reward",
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      amount: "50",
      message: "Referral reward",
      transactionHash: mockTransactionHash,
      parentTransactionHash: mockTransactionHash1,
    });
  });

  it("Should return false and add partial rewards if error on the second referral reward transaction", async function () {
    axiosStub
      .withArgs("https://paymagicapi.com/v1/kernel/tx")
      .onCall(2)
      .resolves({
        data: {
          error: "service non available",
        },
      });

    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      patchwallet: mockWallet1,
    });
    await collectionTransfersMock.insertMany([
      {
        transactionHash: mockTransactionHash,
        senderTgId: mockUserTelegramID1,
        recipientTgId: "newUserTgId",
      },
      {
        transactionHash: mockTransactionHash1,
        senderTgId: mockUserTelegramID1,
        recipientTgId: "newUserTgId",
      },
    ]);

    const result = await handleNewReward({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    const rewards = await collectionRewardsMock.find({}).toArray();

    chai.expect(result).to.be.false;
    chai.expect(rewards.length).to.equal(2);

    chai.expect(rewards[0]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: "user_sign_up",
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: "100",
      message: "Sign up reward",
      transactionHash: mockTransactionHash,
    });

    chai.expect(rewards[1]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      walletAddress: mockWallet1,
      reason: "2x_reward",
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      amount: "50",
      message: "Referral reward",
      transactionHash: mockTransactionHash,
      parentTransactionHash: mockTransactionHash,
    });
  });

  it("Should be able to restart, return true and populate the database properly after restart", async function () {
    axiosStub
      .withArgs("https://paymagicapi.com/v1/kernel/tx")
      .onCall(2)
      .resolves({
        data: {
          error: "service non available",
        },
      });

    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      patchwallet: mockWallet1,
    });
    await collectionTransfersMock.insertMany([
      {
        transactionHash: mockTransactionHash,
        senderTgId: mockUserTelegramID1,
        recipientTgId: "newUserTgId",
      },
      {
        transactionHash: mockTransactionHash1,
        senderTgId: mockUserTelegramID1,
        recipientTgId: "newUserTgId",
      },
    ]);

    let result = await handleNewReward({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    let rewards = await collectionRewardsMock.find({}).toArray();

    chai.expect(result).to.be.false;
    chai.expect(rewards.length).to.equal(2);

    chai.expect(rewards[0]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: "user_sign_up",
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: "100",
      message: "Sign up reward",
      transactionHash: mockTransactionHash,
    });

    chai.expect(rewards[1]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      walletAddress: mockWallet1,
      reason: "2x_reward",
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      amount: "50",
      message: "Referral reward",
      transactionHash: mockTransactionHash,
      parentTransactionHash: mockTransactionHash,
    });

    // Restart
    result = await handleNewReward({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    rewards = await collectionRewardsMock.find({}).toArray();

    chai.expect(result).to.be.true;

    chai.expect(rewards[0]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: "user_sign_up",
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: "100",
      message: "Sign up reward",
      transactionHash: mockTransactionHash,
    });

    chai.expect(rewards[1]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      walletAddress: mockWallet1,
      reason: "2x_reward",
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      amount: "50",
      message: "Referral reward",
      transactionHash: mockTransactionHash,
      parentTransactionHash: mockTransactionHash,
    });

    chai.expect(rewards[2]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      walletAddress: mockWallet1,
      reason: "2x_reward",
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      amount: "50",
      message: "Referral reward",
      transactionHash: mockTransactionHash,
      parentTransactionHash: mockTransactionHash1,
    });
  });

  it("Should return true and populate database correctly with referral link", async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      patchwallet: mockWallet1,
    });

    const result = await handleNewReward({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    const rewards = await collectionRewardsMock.find({}).toArray();

    chai.expect(result).to.be.true;
    chai.expect(rewards.length).to.equal(2);

    chai.expect(rewards[0]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: "user_sign_up",
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: "100",
      message: "Sign up reward",
      transactionHash: mockTransactionHash,
    });

    chai.expect(rewards[1]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      walletAddress: mockWallet1,
      reason: "referral_link",
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      amount: "10",
      message: "Referral link",
      transactionHash: mockTransactionHash,
      sponsoredUserTelegramID: "newUserTgId",
    });
  });

  it("Should be able to restart and return true", async function () {
    axiosStub
      .withArgs("https://paymagicapi.com/v1/kernel/tx")
      .onCall(1)
      .resolves({
        data: {
          error: "service non available",
        },
      });

    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      patchwallet: mockWallet1,
    });

    let result = await handleNewReward({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    let rewards = await collectionRewardsMock.find({}).toArray();

    chai.expect(result).to.be.false;
    chai.expect(rewards.length).to.equal(1);

    chai.expect(rewards[0]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: "user_sign_up",
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: "100",
      message: "Sign up reward",
      transactionHash: mockTransactionHash,
    });

    result = await handleNewReward({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    rewards = await collectionRewardsMock.find({}).toArray();

    chai.expect(result).to.be.true;
    chai.expect(rewards.length).to.equal(2);

    chai.expect(rewards[0]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: "user_sign_up",
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: "100",
      message: "Sign up reward",
      transactionHash: mockTransactionHash,
    });

    chai.expect(rewards[1]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      walletAddress: mockWallet1,
      reason: "referral_link",
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      amount: "10",
      message: "Referral link",
      transactionHash: mockTransactionHash,
      sponsoredUserTelegramID: "newUserTgId",
    });
  });

  it("Should populate the user database properly", async function () {
    const result = await handleNewReward({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    const users = await collectionUsersMock.find({}).toArray();

    chai.expect(users.length).to.equal(1);

    chai.expect(users[0]).excluding(["_id", "dateAdded"]).to.deep.equal({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      patchwallet: mockWallet,
    });
    chai
      .expect(users[0].dateAdded)
      .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
    chai.expect(users[0].dateAdded).to.be.lessThanOrEqual(new Date());
  });

  it("Should not populate the user database if sign up error", async function () {
    axiosStub.withArgs("https://paymagicapi.com/v1/kernel/tx").resolves({
      data: {
        error: "service non available",
      },
    });

    const result = await handleNewReward({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    chai.expect(result).to.be.false;
    chai.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
  });

  it("Should not populate the user database if referral reward error", async function () {
    axiosStub
      .withArgs("https://paymagicapi.com/v1/kernel/tx")
      .onCall(2)
      .resolves({
        data: {
          error: "service non available",
        },
      });

    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      patchwallet: mockWallet1,
    });
    await collectionTransfersMock.insertMany([
      {
        transactionHash: mockTransactionHash,
        senderTgId: mockUserTelegramID1,
        recipientTgId: "newUserTgId",
      },
      {
        transactionHash: mockTransactionHash1,
        senderTgId: mockUserTelegramID1,
        recipientTgId: "newUserTgId",
      },
    ]);

    const result = await handleNewReward({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(result).to.be.false;
    chai
      .expect(await collectionUsersMock.find({}).toArray())
      .excluding(["_id"])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
      ]);
  });

  it("Should not populate the user database if error in referral link reward", async function () {
    axiosStub
      .withArgs("https://paymagicapi.com/v1/kernel/tx")
      .onCall(1)
      .resolves({
        data: {
          error: "service non available",
        },
      });

    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath1,
      userHandle: mockUserHandle1,
      userName: mockUserName1,
      patchwallet: mockWallet1,
    });

    const result = await handleNewReward({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    chai
      .expect(await collectionUsersMock.find({}).toArray())
      .excluding(["_id"])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
      ]);
  });

  it("Should populate the segment user properly", async function () {
    const result = await handleNewReward({
      userTelegramID: "newUserTgId",
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    const segmentIdentityCall = axiosStub
      .getCalls()
      .filter((e) => e.firstArg === "https://api.segment.io/v1/identify");

    chai
      .expect(segmentIdentityCall[0].args[1])
      .excluding(["timestamp"])
      .to.deep.equal({
        userId: "newUserTgId",
        traits: {
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        },
      });
    chai
      .expect(segmentIdentityCall[0].args[1].timestamp)
      .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
    chai
      .expect(segmentIdentityCall[0].args[1].timestamp)
      .to.be.lessThanOrEqual(new Date());
  });
});
