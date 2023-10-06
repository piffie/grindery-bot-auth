import chai from 'chai';
import {
  mockResponsePath,
  mockUserName,
  mockUserTelegramID,
  mockUserTelegramID1,
  mockWallet,
  mockAccessToken,
  mockTransactionHash,
  collectionUsersMock,
  collectionTransfersMock,
  patchwalletResolverUrl,
  patchwalletTxUrl,
  patchwalletAuthUrl,
  segmentTrackUrl,
  mockUserHandle,
} from './utils.js';
import { handleNewTransaction } from '../utils/webhook.js';
import Sinon from 'sinon';
import axios from 'axios';
import 'dotenv/config';
import chaiExclude from 'chai-exclude';
import { TRANSACTION_STATUS } from '../utils/constants.js';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

chai.use(chaiExclude);

describe('handleNewTransaction function', async function () {
  let sandbox;
  let axiosStub;
  let txId;

  beforeEach(async function () {
    sandbox = Sinon.createSandbox();
    axiosStub = sandbox
      .stub(axios, 'post')
      .callsFake(async (url, data, options) => {
        if (url === patchwalletResolverUrl) {
          return Promise.resolve({
            data: {
              users: [{ accountAddress: mockWallet }],
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

        if (url === patchwalletAuthUrl) {
          return Promise.resolve({
            data: {
              access_token: mockAccessToken,
            },
          });
        }

        if (url == process.env.FLOWXO_NEW_TRANSACTION_WEBHOOK) {
          return Promise.resolve({
            result: 'success',
          });
        }

        if (url == segmentTrackUrl) {
          return Promise.resolve({
            result: 'success',
          });
        }
      });

    txId = uuidv4();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('Should add a new transaction record if everything goes well', async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
      userName: mockUserName,
      userHandle: mockUserHandle,
      patchwallet: mockWallet,
    });

    chai.expect(
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      })
    ).to.be.true;

    const transfers = await collectionTransfersMock.find({}).toArray();

    chai
      .expect(transfers)
      .excluding(['dateAdded', '_id'])
      .to.deep.equal([
        {
          eventId: txId,
          TxId: mockTransactionHash.substring(1, 8),
          chainId: 'eip155:137',
          tokenSymbol: 'g1',
          tokenAddress: process.env.G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipientTgId: mockUserTelegramID1,
          recipientWallet: mockWallet,
          tokenAmount: '100',
          transactionHash: mockTransactionHash,
          status: TRANSACTION_STATUS.SUCCESS,
        },
      ]);
    chai.expect(transfers[0].dateAdded).to.be.a('date');
  });

  it('Should not modify transaction status in the database if there is an error in the send tokens request', async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
      userName: mockUserName,
      userHandle: mockUserHandle,
      patchwallet: mockWallet,
    });

    axiosStub.withArgs(patchwalletTxUrl).resolves({
      data: {
        error: 'service non available',
      },
    });

    await handleNewTransaction({
      senderTgId: mockUserTelegramID,
      amount: '100',
      recipientTgId: mockUserTelegramID1,
      eventId: txId,
    });

    chai
      .expect(await collectionTransfersMock.find({}).toArray())
      .excluding(['_id'])
      .to.deep.equal([
        {
          eventId: txId,
          senderTgId: mockUserTelegramID,
          recipientTgId: mockUserTelegramID1,
          tokenAmount: '100',
          status: TRANSACTION_STATUS.PENDING,
        },
      ]);
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

    chai
      .expect(
        (await collectionTransfersMock.find({}).toArray())[0]._id.toString()
      )
      .to.equal(objectId);
  });

  it('Should return false if there is an error in the send tokens request', async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
      userName: mockUserName,
      userHandle: mockUserHandle,
      patchwallet: mockWallet,
    });

    axiosStub.withArgs(patchwalletTxUrl).resolves({
      data: {
        error: 'service non available',
      },
    });

    chai.expect(
      await handleNewTransaction({
        senderTgId: mockUserTelegramID,
        amount: '100',
        recipientTgId: mockUserTelegramID1,
        eventId: txId,
      })
    ).to.be.false;
  });

  it('Should populate the segment transfer properly', async function () {
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

    const segmentIdentityCall = axiosStub
      .getCalls()
      .filter((e) => e.firstArg === 'https://api.segment.io/v1/track');

    chai
      .expect(segmentIdentityCall[0].args[1])
      .excluding(['timestamp'])
      .to.deep.equal({
        userId: mockUserTelegramID,
        event: 'Transfer',
        properties: {
          TxId: mockTransactionHash.substring(1, 8),
          chainId: 'eip155:137',
          tokenSymbol: 'g1',
          tokenAddress: process.env.G1_POLYGON_ADDRESS,
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

  it('Should not call segment if there is an error in the send tokens request', async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
      userName: mockUserName,
      userHandle: mockUserHandle,
      patchwallet: mockWallet,
      responsePath: mockResponsePath,
    });

    axiosStub.withArgs(patchwalletTxUrl).resolves({
      data: {
        error: 'service non available',
      },
    });

    await handleNewTransaction({
      senderTgId: mockUserTelegramID,
      amount: '100',
      recipientTgId: mockUserTelegramID1,
      eventId: txId,
    });

    chai.expect(
      axiosStub
        .getCalls()
        .find((e) => e.firstArg === 'https://api.segment.io/v1/track')
    ).to.be.undefined;
  });

  it('Should call FlowXO webhook properly for new transactions', async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
      userName: mockUserName,
      userHandle: mockUserHandle,
      patchwallet: mockWallet,
      responsePath: mockResponsePath,
    });

    await handleNewTransaction({
      senderTgId: mockUserTelegramID,
      amount: '100',
      recipientTgId: mockUserTelegramID1,
      eventId: txId,
    });

    const FlowXOCallArgs = axiosStub
      .getCalls()
      .find((e) => e.firstArg === process.env.FLOWXO_NEW_TRANSACTION_WEBHOOK)
      .args[1];

    chai
      .expect(FlowXOCallArgs)
      .excluding(['dateAdded'])
      .to.deep.equal({
        senderResponsePath: mockResponsePath,
        TxId: mockTransactionHash.substring(1, 8),
        chainId: 'eip155:137',
        tokenSymbol: 'g1',
        tokenAddress: process.env.G1_POLYGON_ADDRESS,
        senderTgId: mockUserTelegramID,
        senderWallet: mockWallet,
        senderName: mockUserName,
        senderHandle: mockUserHandle,
        recipientTgId: mockUserTelegramID1,
        recipientWallet: mockWallet,
        tokenAmount: '100',
        transactionHash: mockTransactionHash,
      });
  });

  it('Should not call FlowXO if there is an error in the send tokens request', async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
      userName: mockUserName,
      userHandle: mockUserHandle,
      patchwallet: mockWallet,
      responsePath: mockResponsePath,
    });

    axiosStub.withArgs(patchwalletTxUrl).resolves({
      data: {
        error: 'service non available',
      },
    });

    await handleNewTransaction({
      senderTgId: mockUserTelegramID,
      amount: '100',
      recipientTgId: mockUserTelegramID1,
      eventId: txId,
    });

    chai.expect(
      axiosStub
        .getCalls()
        .find((e) => e.firstArg === process.env.FLOWXO_NEW_TRANSACTION_WEBHOOK)
    ).to.be.undefined;
  });

  it('Should return true and no modification of status in database if sender is not a user', async function () {
    const result = await handleNewTransaction({
      senderTgId: mockUserTelegramID,
      amount: '100',
      recipientTgId: mockUserTelegramID1,
      eventId: txId,
    });

    chai.expect(result).to.be.true;
    chai
      .expect(await collectionTransfersMock.find({}).toArray())
      .excluding(['_id'])
      .to.deep.equal([
        {
          eventId: txId,
          senderTgId: mockUserTelegramID,
          recipientTgId: mockUserTelegramID1,
          tokenAmount: '100',
          status: TRANSACTION_STATUS.PENDING,
        },
      ]);
  });

  it('Should return false and no transaction status modification in database if error in PatchWallet get address', async function () {
    axiosStub
      .withArgs(patchwalletResolverUrl)
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

    chai.expect(result).to.be.false;
    chai
      .expect(await collectionTransfersMock.find({}).toArray())
      .excluding(['_id'])
      .to.deep.equal([
        {
          eventId: txId,
          senderTgId: mockUserTelegramID,
          recipientTgId: mockUserTelegramID1,
          tokenAmount: '100',
          status: TRANSACTION_STATUS.PENDING,
        },
      ]);
  });

  it('Should return true if error in Segment Webhook', async function () {
    axiosStub
      .withArgs(segmentTrackUrl)
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

    chai.expect(result).to.be.true;
  });

  it('Should return true if error in FlowXO Webhook', async function () {
    axiosStub
      .withArgs(process.env.FLOWXO_NEW_TRANSACTION_WEBHOOK)
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

    chai.expect(result).to.be.true;
  });

  it('Should return false and no transaction status modification in database if error in PatchWallet transaction', async function () {
    axiosStub
      .withArgs(patchwalletTxUrl)
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

    chai.expect(result).to.be.false;
    chai
      .expect(await collectionTransfersMock.find({}).toArray())
      .excluding(['_id'])
      .to.deep.equal([
        {
          eventId: txId,
          senderTgId: mockUserTelegramID,
          recipientTgId: mockUserTelegramID1,
          tokenAmount: '100',
          status: TRANSACTION_STATUS.PENDING,
        },
      ]);
  });

  it('Should return true and transaction status to failure in database if error 470 in PatchWallet transaction', async function () {
    axiosStub.withArgs(patchwalletTxUrl).rejects({
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

    const result = await handleNewTransaction({
      senderTgId: mockUserTelegramID,
      amount: '100',
      recipientTgId: mockUserTelegramID1,
      eventId: txId,
    });

    chai.expect(result).to.be.true;
    chai
      .expect(await collectionTransfersMock.find({}).toArray())
      .excluding(['dateAdded', '_id'])
      .to.deep.equal([
        {
          eventId: txId,
          chainId: 'eip155:137',
          tokenSymbol: 'g1',
          tokenAddress: process.env.G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipientTgId: mockUserTelegramID1,
          recipientWallet: mockWallet,
          tokenAmount: '100',
          status: TRANSACTION_STATUS.FAILURE,
        },
      ]);
  });

  it('Should return false and no transaction status modification in database if no hash in PatchWallet transaction', async function () {
    axiosStub.withArgs(patchwalletTxUrl).resolves({
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

    const result = await handleNewTransaction({
      senderTgId: mockUserTelegramID,
      amount: '100',
      recipientTgId: mockUserTelegramID1,
      eventId: txId,
    });

    chai.expect(result).to.be.false;
    chai
      .expect(await collectionTransfersMock.find({}).toArray())
      .excluding('_id')
      .to.deep.equal([
        {
          eventId: txId,
          senderTgId: mockUserTelegramID,
          recipientTgId: mockUserTelegramID1,
          tokenAmount: '100',
          status: TRANSACTION_STATUS.PENDING,
        },
      ]);
  });
});
