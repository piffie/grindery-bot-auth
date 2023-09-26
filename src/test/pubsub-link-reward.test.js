import chai from "chai";
import chaiHttp from "chai-http";
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
} from "./utils.js";
import { handleLinkReward, handleSignUpReward } from "../utils/webhook.js";
import Sinon from "sinon";
import axios from "axios";
import "dotenv/config";
import chaiExclude from "chai-exclude";

chai.use(chaiHttp);
chai.use(chaiExclude);

describe("handleLinkReward function", async function () {
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

        if (url == "https://api.segment.io/v1/identify") {
          return Promise.resolve({
            result: "success",
          });
        }

        if (url == process.env.FLOWXO_NEW_LINK_REWARD_WEBHOOK) {
          return Promise.resolve({
            result: "success",
          });
        }
      });
  });

  afterEach(function () {
    sandbox.restore();
  });

  it("Should return true if referent is not a user", async function () {
    chai.expect(
      await handleLinkReward(dbMock, mockUserTelegramID, mockUserTelegramID1)
    ).to.be.true;
  });

  it("Should not send tokens if referent is not a user", async function () {
    await handleLinkReward(dbMock, mockUserTelegramID, mockUserTelegramID1);

    chai.expect(
      axiosStub
        .getCalls()
        .find((e) => e.firstArg === "https://paymagicapi.com/v1/kernel/tx")
    ).to.be.undefined;
  });

  it("Should return true if user is already a user", async function () {
    await collectionUsersMock.insertMany([
      {
        userTelegramID: mockUserTelegramID,
      },
      {
        userTelegramID: mockUserTelegramID1,
      },
    ]);

    chai.expect(
      await handleLinkReward(dbMock, mockUserTelegramID, mockUserTelegramID1)
    ).to.be.true;
  });

  it("Should not send tokens if user is already a user", async function () {
    await collectionUsersMock.insertMany([
      {
        userTelegramID: mockUserTelegramID,
      },
      {
        userTelegramID: mockUserTelegramID1,
      },
    ]);

    await handleLinkReward(dbMock, mockUserTelegramID, mockUserTelegramID1);

    chai.expect(
      axiosStub
        .getCalls()
        .find((e) => e.firstArg === "https://paymagicapi.com/v1/kernel/tx")
    ).to.be.undefined;
  });

  it("Should return true if user already sponsored someone else", async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
    });

    await collectionRewardsMock.insertOne({
      sponsoredUserTelegramID: mockUserTelegramID,
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: "referral_link",
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: "10",
      message: "Referral link",
      transactionHash: mockTransactionHash,
    });
    chai.expect(
      await handleLinkReward(dbMock, mockUserTelegramID, mockUserTelegramID1)
    ).to.be.true;
  });

  it("Should not send tokens if user already sponsored someone else", async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
    });

    await collectionRewardsMock.insertOne({
      sponsoredUserTelegramID: mockUserTelegramID,
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: "referral_link",
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: "10",
      message: "Referral link",
      transactionHash: mockTransactionHash,
    });
    await handleLinkReward(dbMock, mockUserTelegramID, mockUserTelegramID1);

    chai.expect(
      axiosStub
        .getCalls()
        .find((e) => e.firstArg === "https://paymagicapi.com/v1/kernel/tx")
    ).to.be.undefined;
  });

  it("Should call the sendTokens function properly if the user is new", async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
    });

    await handleLinkReward(dbMock, mockUserTelegramID, mockUserTelegramID1);

    chai
      .expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === "https://paymagicapi.com/v1/kernel/tx")
          .args[1]
      )
      .to.deep.equal({
        userId: `grindery:${process.env.SOURCE_TG_ID}`,
        chain: "matic",
        to: [process.env.G1_POLYGON_ADDRESS],
        value: ["0x00"],
        data: [
          "0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000008ac7230489e80000",
        ],
        auth: "",
      });
  });

  it("Should insert a new element in the reward collection of the database if the user is new", async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      patchwallet: mockWallet,
    });

    await handleLinkReward(dbMock, mockUserTelegramID, mockUserTelegramID1);

    const rewards = await collectionRewardsMock.find({}).toArray();

    chai.expect(rewards.length).to.equal(1);
    chai.expect(rewards[0]).excluding(["_id", "dateAdded"]).to.deep.equal({
      sponsoredUserTelegramID: mockUserTelegramID,
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: "referral_link",
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: "10",
      message: "Referral link",
      transactionHash: mockTransactionHash,
    });
    chai
      .expect(rewards[0].dateAdded)
      .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
    chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
  });

  it("Should return true if the user is new", async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
    });
    chai.expect(
      await handleLinkReward(dbMock, mockUserTelegramID, mockUserTelegramID1)
    ).to.be.true;
  });

  it("Should call FlowXO webhook properly if the user is new", async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      patchwallet: mockWallet,
    });
    await handleLinkReward(dbMock, mockUserTelegramID, mockUserTelegramID1);

    const FlowXOCallArgs = axiosStub
      .getCalls()
      .find((e) => e.firstArg === process.env.FLOWXO_NEW_LINK_REWARD_WEBHOOK)
      .args[1];

    chai.expect(FlowXOCallArgs).excluding(["dateAdded"]).to.deep.equal({
      sponsoredUserTelegramID: mockUserTelegramID,
      userTelegramID: mockUserTelegramID1,
      responsePath: mockResponsePath,
      walletAddress: mockWallet,
      reason: "referral_link",
      userHandle: mockUserHandle,
      userName: mockUserName,
      amount: "10",
      message: "Referral link",
      transactionHash: mockTransactionHash,
    });

    chai
      .expect(FlowXOCallArgs.dateAdded)
      .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
    chai.expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
  });

  it("Should return false if there is an error in the transaction", async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
    });

    axiosStub.withArgs("https://paymagicapi.com/v1/kernel/tx").resolves({
      data: {
        error: "service non available",
      },
    });

    chai.expect(
      await handleLinkReward(dbMock, mockUserTelegramID, mockUserTelegramID1)
    ).to.be.false;
  });

  it("Should not add reward in the database if there is an error in the transaction", async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
    });

    axiosStub.withArgs("https://paymagicapi.com/v1/kernel/tx").resolves({
      data: {
        error: "service non available",
      },
    });
    await handleLinkReward(dbMock, mockUserTelegramID, mockUserTelegramID1);
    chai.expect(await collectionRewardsMock.find({}).toArray()).to.be.empty;
  });

  it("Should not call FlowXO if there is an error in the transaction", async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID1,
    });

    axiosStub.withArgs("https://paymagicapi.com/v1/kernel/tx").resolves({
      data: {
        error: "service non available",
      },
    });
    await handleLinkReward(dbMock, mockUserTelegramID, mockUserTelegramID1);

    chai.expect(
      axiosStub
        .getCalls()
        .find((e) => e.firstArg === process.env.FLOWXO_NEW_LINK_REWARD_WEBHOOK)
    ).to.be.undefined;
  });
});
