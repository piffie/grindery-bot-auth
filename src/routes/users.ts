import express from 'express';
import { Database } from '../db/conn';
import { authenticateApiKey } from '../utils/auth';
import { ANKR_MULTICHAIN_API_URL, USERS_COLLECTION } from '../utils/constants';
import axios from 'axios';
import { UserTelegram } from '../utils/user';

const router = express.Router();

/**
 * POST /attributes
 *
 * @summary Update user attributes in the database
 * @description Accepts an array of objects containing user Telegram IDs and their corresponding attribute names, updates or creates user entries with provided attributes.
 * @security Requires API key authentication.
 * @param {object[]} req.body - Array of attribute objects containing "userTelegramID" as a string and "attributes" as an array for each object.
 * @return {object} 200 - Success response with a message and bulk write operation result on successful updates. Returns an error if encountered.
 * @example request - 200 - Example request body
 * [
 *   {
 *     "userTelegramID": "123456789",
 *     "attributes": ["attribute1", "attribute2"]
 *   },
 *   {
 *     "userTelegramID": "987654321",
 *     "attributes": ["attribute3", { mvu_score: '44' }]
 *   }
 * ]
 * @example response - 200 - Success response example
 * {
 *   "msg": "Updates successful",
 *   "result": {
 *      "insertedCount": 0,
 *      "matchedCount": 2,
 *      "modifiedCount": 2,
 *      "deletedCount": 0,
 *      "upsertedCount": 0,
 *      "upsertedIds": {},
 *      "insertedIds": {}
 *   }
 * }
 * @example response - 400 - Error response example when request body is not an array
 * {
 *   "msg": "Request body should contain an array of attribute objects."
 * }
 * @example response - 400 - Error response example when each array element is not correct
 * {
 *   "msg": "Each item in the array should have 'userTelegramID' as string, 'attributes' as an array."
 * }
 * @example response - 500 - Error response example when an error occurs during the update process
 * {
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.post('/attributes', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();

    // Check if the request body is an array
    if (!Array.isArray(req.body)) {
      return res.status(400).send({
        msg: 'Request body should contain an array of attribute objects.',
      });
    }

    // Validate each item in the request body
    const isValid = req.body.every((update) => {
      const { userTelegramID, attributes } = update;
      // Check if attributes is an object (not an array) and userTelegramID is a string
      return (
        typeof userTelegramID === 'string' &&
        typeof attributes === 'object' &&
        !Array.isArray(attributes) // Ensure attributes is an object
      );
    });

    // If validation fails, return an error response
    if (!isValid) {
      return res.status(400).send({
        msg: 'Each item in the array should have "userTelegramID" as a string and "attributes" as an object.',
      });
    }

    // Map the request body to bulk operations
    const bulkOperations = req.body.map((update) => ({
      updateOne: {
        filter: { userTelegramID: update.userTelegramID },
        update: { $set: { attributes: update.attributes } },
        upsert: true,
      },
    }));

    // Perform the bulk write operation
    const result = await db
      ?.collection(USERS_COLLECTION)
      .bulkWrite(bulkOperations);

    // Send a success response
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

    const user = await UserTelegram.build(userTelegramID as string);

    return res.status(200).send({
      userTelegramID,
      attributes: user.attributes(),
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
