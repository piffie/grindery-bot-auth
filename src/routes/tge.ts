import express from 'express';
import { authenticateApiKey } from '../utils/auth';
import { EXCHANGE_RATE_G1_USD, computeG1ToGxConversion } from '../utils/g1gx';
import { Database } from '../db/conn';
import {
  GX_ORDER_COLLECTION,
  GX_QUOTE_COLLECTION,
  GX_ORDER_STATUS,
} from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { getPatchWalletAccessToken, sendTokens } from '../utils/patchwallet';
import { SOURCE_WALLET_ADDRESS } from '../../secrets';

const router = express.Router();

/**
 * GET /v1/tge/conversion-information
 *
 * @summary Calculate G1 to Gx conversion
 * @description Calculates the conversion from G1 to Gx based on provided quantities of USD and G1.
 * @tags Conversion
 * @security BearerAuth
 * @param {number} usdQuantity.query - The quantity of USD.
 * @param {number} g1Quantity.query - The quantity of G1.
 * @return {object} 200 - Success response with the calculated conversion value
 * @return {object} 500 - Error response if an error occurs during the conversion
 *
 * @example request - 200 - Example request query parameters
 * /v1/tge/conversion-information?usdQuantity=100&g1Quantity=50
 *
 * @example response - 200 - Success response example
 * {
 *   "usd_from_usd_investment": "10",
 *   "usd_from_g1_holding": "0.049",
 *   "usd_from_mvu": "0.80",
 *   "usd_from_time": "1.04",
 *   "equivalent_usd_invested": "11.89",
 *   "gx_before_mvu": "279.16",
 *   "gx_mvu_effect": "22.33",
 *   "gx_time_effect": "29.00",
 *   "gx_received": "1200",
 *   "equivalent_gx_usd_exchange_rate": "32.88",
 *   "standard_gx_usd_exchange_rate": "27.77",
 *   "discount_received": "15.53"
 * }
 *
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.get('/conversion-information', authenticateApiKey, async (req, res) => {
  try {
    const result = computeG1ToGxConversion(
      Number(req.query.usdQuantity),
      Number(req.query.g1Quantity),
      4,
    );

    const db = await Database.getInstance();

    const id = uuidv4();

    await db?.collection(GX_QUOTE_COLLECTION).updateOne(
      { quoteId: id },
      {
        $set: {
          ...result,
          quoteId: id,
          date: new Date(),
          userTelegramID: req.query.userTelegramID,
        },
      },
      { upsert: true },
    );

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

/**
 * POST /v1/tge/pre-order
 *
 * @summary Create a Gx token pre-order
 * @description Initiates a pre-order for Gx tokens based on the provided quote ID and user details.
 * @tags Pre-Order
 * @security BearerAuth
 * @param {string} req.body.quoteId - The quote ID to create a pre-order.
 * @param {string} req.body.userTelegramID - The user's Telegram ID for identification.
 * @return {object} 200 - Success response with the pre-order transaction details
 * @return {object} 400 - Error response if a quote is unavailable or the order is being processed
 * @return {object} 500 - Error response if an error occurs during the pre-order process
 */
router.post('/pre-order', authenticateApiKey, async (req, res) => {
  const db = await Database.getInstance();

  // Retrieve quote details based on the provided quoteId
  const quote = await db
    ?.collection(GX_QUOTE_COLLECTION)
    .findOne({ quoteId: req.body.quoteId });

  // If quote is not found, return an error response
  if (!quote)
    return res.status(400).json({ msg: 'No quote available for this ID' });

  // Check if an order with the same quoteId is already being processed
  const order = await db
    ?.collection(GX_ORDER_COLLECTION)
    .findOne({ orderId: req.body.quoteId });

  // If an order is already being processed, return an error response
  if (order && order.status !== GX_ORDER_STATUS.FAILURE)
    return res
      .status(400)
      .json({ msg: 'This order is already being processed' });

  // Calculate the G1 amount for the pre-order
  const g1_amount = (
    Number(quote.usd_from_g1_holding) * EXCHANGE_RATE_G1_USD
  ).toFixed(2);

  // Create/update the pre-order with pending status and user details
  await db?.collection(GX_ORDER_COLLECTION).updateOne(
    { orderId: req.body.quoteId },
    {
      $set: {
        orderId: req.body.quoteId,
        date: new Date(),
        status: GX_ORDER_STATUS.PENDING,
        userTelegramID: req.body.userTelegramID,
        g1_amount,
      },
    },
    { upsert: true },
  );

  try {
    // Send tokens for the pre-order and get transaction details
    const { data } = await sendTokens(
      req.body.userTelegramID,
      SOURCE_WALLET_ADDRESS,
      g1_amount,
      await getPatchWalletAccessToken(),
      0,
    );

    // Determine the status of the pre-order based on additional conditions
    const status =
      Number(quote.usd_from_usd_investment) > 0
        ? GX_ORDER_STATUS.PENDING_USD
        : GX_ORDER_STATUS.COMPLETE;

    // Update the pre-order with transaction details and updated status
    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.quoteId },
      {
        $set: {
          orderId: req.body.quoteId,
          date: new Date(),
          status,
          userTelegramID: req.body.userTelegramID,
          g1_amount,
          transactionHash: data.txHash,
          userOpHash: data.userOpHash,
        },
      },
      { upsert: true },
    );

    // Return success response with pre-order transaction details
    return res
      .status(200)
      .json({ success: true, transactionHash: data.txHash });
  } catch (e) {
    // Log error if transaction fails and update pre-order status to failure
    console.error(
      `[${req.body.quoteId}] Error processing PatchWallet pre-order G1 transaction: ${e}`,
    );

    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.quoteId },
      {
        $set: {
          orderId: req.body.quoteId,
          date: new Date(),
          status: GX_ORDER_STATUS.FAILURE,
          userTelegramID: req.body.userTelegramID,
          g1_amount,
        },
      },
      { upsert: true },
    );

    // Return error response if an error occurs during the pre-order process
    return res.status(500).json({ msg: 'An error occurred', e });
  }
});

/**
 * GET /v1/tge/order-status
 *
 * @summary Get the status of a Gx token order
 * @description Retrieves the status of a Gx token order based on the order ID.
 * @tags Order Status
 * @security BearerAuth
 * @param {string} req.query.orderId - The order ID to fetch the status.
 * @return {object} 200 - Success response with the order status details
 * @return {object} 500 - Error response if an error occurs during status retrieval
 *
 * @example request - 200 - Example request query parameter
 * /v1/tge/order-status?orderId=mocked-order-id
 *
 * @example response - 200 - Success response example
 * {
 *   "orderId": "mocked-order-id",
 *   "date": "2023-12-31T12:00:00Z",
 *   "status": "PENDING",
 *   "userTelegramID": "user-telegram-id",
 *   "g1_amount": "50.00",
 *   "transactionHash": "transaction-hash",
 *   "userOpHash": "user-operation-hash"
 * }
 *
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.get('/order-status', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();

    return res
      .status(200)
      .json(
        await db
          ?.collection(GX_ORDER_COLLECTION)
          .findOne({ orderId: req.query.orderId }),
      );
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

export default router;
