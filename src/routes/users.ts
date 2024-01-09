import express from 'express';
import { Database } from '../db/conn';
import { authenticateApiKey } from '../utils/auth';
import { ANKR_MULTICHAIN_API_URL, USERS_COLLECTION } from '../utils/constants';
import axios from 'axios';
import { extractMvuValueFromAttributes } from '../utils/g1gx';

const router = express.Router();

/**
 * POST /attributes
 * @summary Update user attributes in the database
 * @description Accepts an array of objects containing user Telegram IDs and their corresponding attribute names, updates or creates user entries with provided attributes.
 * @security Requires API key authentication.
 * @param {object[]} req.body - Array of attribute objects containing "userTelegramID" as a string and "attributeNames" as an array for each object.
 * @return {object} 200 - Success response with a message and bulk write operation result on successful updates. Returns an error if encountered.
 */
router.post('/attributes', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();

    if (!Array.isArray(req.body)) {
      return res.status(400).send({
        msg: 'Request body should contain an array of attribute objects.',
      });
    }

    const isValid = req.body.every((update) => {
      const { userTelegramID, attributeNames } = update;
      return (
        Array.isArray(attributeNames) && typeof userTelegramID === 'string'
      );
    });

    if (!isValid) {
      return res.status(400).send({
        msg: 'Each item in the array should have "userTelegramID" as string, "attributeNames" as an array.',
      });
    }

    const bulkOperations = req.body.map((update) => ({
      updateOne: {
        filter: { userTelegramID: update.userTelegramID },
        update: { $set: { attributes: update.attributeNames } },
        upsert: true,
      },
    }));

    const result = await db
      ?.collection(USERS_COLLECTION)
      .bulkWrite(bulkOperations);

    return res.status(200).send({
      msg: 'Updates successful',
      result,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

/**
 * GET /attributes
 * @summary Retrieve user attributes from the database
 * @description Retrieves the attributes associated with a specific user identified by their Telegram ID.
 * @security Requires API key authentication.
 * @param {string} req.query.userTelegramID - Valid user Telegram ID.
 * @return {object} 200 - Returns the user Telegram ID and associated attributes if found. Otherwise, returns an error message.
 */
router.get('/attributes', authenticateApiKey, async (req, res) => {
  try {
    const { userTelegramID } = req.query;

    if (!userTelegramID) {
      return res.status(400).send({
        msg: 'User Telegram ID is required.',
      });
    }

    const db = await Database.getInstance();
    const user = await db
      ?.collection(USERS_COLLECTION)
      .findOne({ userTelegramID });

    return res.status(200).send({
      userTelegramID,
      attributes: user?.attributes,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

/**
 * GET /mvu
 * @summary Get MVU (Most Valuable User) value for a user
 * @description Retrieves the MVU value associated with a specific user identified by their Telegram ID from the database.
 * @security Requires API key authentication.
 * @param {string} req.query.userTelegramID - Valid user Telegram ID.
 * @return {object} 200 - Returns the user Telegram ID and the extracted MVU value. If not found, returns an error message.
 */
router.get('/mvu', authenticateApiKey, async (req, res) => {
  try {
    const { userTelegramID } = req.query;

    if (!userTelegramID) {
      return res.status(400).send({
        msg: 'User Telegram ID is required.',
      });
    }

    const db = await Database.getInstance();

    return res.status(200).send({
      userTelegramID,
      mvu: extractMvuValueFromAttributes(
        (await db?.collection(USERS_COLLECTION).findOne({ userTelegramID }))
          ?.attributes,
      ),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

/**
 * GET /balance
 * @summary Retrieve user wallet balance
 * @description Retrieves the wallet balance associated with a specific user's Patchwallet from the Ankr Multichain API.
 * @security Requires API key authentication.
 * @param {string} req.query.userTelegramID - Valid user Telegram ID.
 * @param {string} req.query.chain - Optional chain ID.
 * @return {object} 200 - Responds with the wallet balance details. Logs errors if encountered during the process.
 */
router.get('/balance', authenticateApiKey, async (req, res) => {
  console.log(`User [${req.query.userTelegramID}] requested balance`);
  try {
    const db = await Database.getInstance();

    const user = await db
      ?.collection(USERS_COLLECTION)
      .findOne({ userTelegramID: req.query.userTelegramID });

    if (!user) {
      return res.status(400).json({ error: 'User is not in the database' });
    }

    const balance = await axios.post(
      ANKR_MULTICHAIN_API_URL,
      {
        jsonrpc: '2.0',
        method: 'ankr_getAccountBalance',
        params: {
          blockchain: req.query.chain
            ? (req.query.chain as string).split(',')
            : 'polygon',
          walletAddress: user?.patchwallet || '',
          onlyWhitelisted: false,
        },
        id: new Date().toString(),
      },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    console.log(`User [${req.query.userTelegramID}] balance request completed`);
    return res.status(200).json(balance.data?.result || {});
  } catch (error) {
    console.error(
      `Error getting balance for user ${req.query.userTelegramID}`,
      JSON.stringify(error),
    );
    return res.status(500).send({ success: false, error: 'An error occurred' });
  }
});

export default router;
