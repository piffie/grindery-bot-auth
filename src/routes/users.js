import express from "express";
import {isRequired} from "../utils/auth.js";
import {Database} from "../db/conn.js";

const router = express.Router();

/**
 * POST /v1/users
 *
 * @summary Create a New User
 * @description Add a new user to the users collection in the database. The endpoint will check if the user with the provided TelegramUserID already exists and will prevent duplicates.
 * @tags Users
 * @param {object} request.body - The request body containing user details.
 * @return {object} 201 - Success response with user details and additional fields.
 * @return {object} 404 - Error response when user already exists.
 * @example request - 201 - Example request body
 * {
 *   "telegramUserID": "123456",
 *   "telegramName": "John Doe",
 *   "userHandle": "@john_doe",
 *   "responsePath": "/some/response/path",
 *   "patchWallet": "somePatchWalletValue"
 * }
 * @example response - 201 - Success response example
 * {
 *   "acknowledged": true,
 *   "insertedId": "64f614ad7415705c1b2e5a07"
 * }
 * @example response - 404 - Error response example
 * {
 *   "msg": "This user already exists."
 * }
 */
router.post("/", isRequired, async (req, res) => {
  // Get the database instance and select the 'users' collection
  const db = await Database.getInstance(req);
  const collection = db.collection("users");

  // Check if the user already exists based on telegramUserID
  if (
    req.body.telegramUserID &&
    (await collection.findOne({telegramUserID: req.body.telegramUserID}))
  ) {
    return res.status(404).send({
      msg: "This user already exists.",
    });
  }

  // Insert the new user into the collection
  res.status(201).send(
    await collection.insertOne({
      ...req.body,
      dateAdded: new Date(),
      isActive: true,
    })
  );
});

/**
 * POST /v1/transfers
 *
 * @summary Create a New Transfer
 * @description Add a new transfer to the transfers collection in the database. The endpoint will check if the transfer with the provided txId already exists and will prevent duplicates.
 * @tags Transfers
 * @param {object} request.body - The request body containing transfer details.
 * @return {object} 201 - Success response with transfer details and additional fields.
 * @return {object} 404 - Error response when transfer already exists.
 * @example request - 201 - Example request body
 * {
 *   "txId": "transactionID123456",
 *   "chainID": "chainIDValue",
 *   "tokenSymbol": "TOKEN",
 *   "tokenAddress": "0x1234567890abcdef1234567890abcdef12345678",
 *   "senderTelegramID": "123456",
 *   "senderWalletAddress": "0xabcdef1234567890abcdef1234567890abcdef1234",
 *   "senderName": "John Doe",
 *   "recipientTelegramID": "654321",
 *   "recipientWalletAddress": "0xfedcba0987654321fedcba0987654321fedcba09",
 *   "senderMessage": "Payment for services rendered",
 *   "tokenAmount": "100.50",
 *   "transactionHash": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
 * }
 * @example response - 201 - Success response example
 * {
 *   "acknowledged": true,
 *   "insertedId": "64f614ad7415705c1b2e5a07"
 * }
 * @example response - 404 - Error response example
 * {
 *   "msg": "This transfer already exists."
 * }
 */
router.post("/transfers", isRequired, async (req, res) => {
  // Get the database instance and select the 'transfers' collection
  const db = await Database.getInstance(req);
  const collection = db.collection("transfers");

  // Check if the transfer already exists based on txID
  if (req.body.txId && (await collection.findOne({txId: req.body.txId}))) {
    return res.status(404).send({
      msg: "This transfer already exists.",
    });
  }

  // Insert the new transfer into the collection
  res.status(201).send(
    await collection.insertOne({
      ...req.body,
      timestamp: new Date(),
      isActive: true,
    })
  );
});

/**
 * POST /v1/rewards
 *
 * @summary Create a New Reward
 * @description Add a new reward to the rewards collection in the database.
 * @tags Rewards
 * @param {object} request.body - The request body containing reward details.
 * @return {object} 201 - Success response with reward details and additional fields.
 * @example request - 201 - Example request body
 * {
 *   "userTelegramID": "123456",
 *   "responsePath": "/some/response/path",
 *   "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
 *   "reason": "Reward for participation",
 *   "userHandle": "@john_doe",
 *   "userName": "John Doe",
 *   "amount": "100",
 *   "message": "Thank you for participating!",
 *   "transactionHash": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
 * }
 * @example response - 201 - Success response example
 * {
 *    "acknowledged": true,
 *    "insertedId": "64f6109d1f75a7b636c1aa4a"
 * }
 */
router.post("/rewards", isRequired, async (req, res) => {
  // Get the database instance and select the 'rewards' collection
  const db = await Database.getInstance(req);
  const collection = db.collection("rewards");

  // Insert the new reward into the collection
  res.status(201).send(
    await collection.insertOne({
      ...req.body,
      timestamp: new Date(),
      isActive: true,
    })
  );
});

export default router;
