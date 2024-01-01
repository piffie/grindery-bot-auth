import express from 'express';
import { authenticateApiKey } from '../utils/auth';
import { computeG1ToGxConversion } from '../utils/g1gx';
import { Database } from '../db/conn';
import {
  GX_ORDER_COLLECTION,
  GX_QUOTE_COLLECTION,
  GX_ORDER_STATUS,
} from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { getPatchWalletAccessToken, sendTokens } from '../utils/patchwallet';
import { SOURCE_WALLET_ADDRESS } from '../../secrets';
import { getTokenPrice } from '../utils/ankr';

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
 *   "discount_received": "15.53",
 *   "date": "2023-12-31T12:00:00Z",
 *   "quoteId": "some-unique-id",
 *   "userTelegramID": "user-telegram-id"
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
    const date = new Date();

    await db?.collection(GX_QUOTE_COLLECTION).updateOne(
      { quoteId: id },
      {
        $set: {
          ...result,
          quoteId: id,
          date: date,
          userTelegramID: req.query.userTelegramID,
        },
      },
      { upsert: true },
    );

    return res.status(200).json({
      ...result,
      date,
      quoteId: id,
      userTelegramID: req.query.userTelegramID,
    });
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
 *
 * @example request - 200 - Example request body
 * {
 *   "quoteId": "mocked-quote-id",
 *   "userTelegramID": "user-telegram-id"
 * }
 *
 * @example response - 200 - Success response example
 * {
 *   "success": true,
 *   "order": {
 *     "orderId": "mocked-quote-id",
 *     "date": "2023-12-31T12:00:00Z",
 *     "status": "PENDING",
 *     "userTelegramID": "user-telegram-id",
 *     "g1_amount": "1000.00",
 *     "transactionHash": "transaction-hash",
 *     "userOpHash": "user-operation-hash"
 *   }
 * }
 *
 * @example response - 400 - Error response example if a quote is unavailable or the order is being processed
 * {
 *   "msg": "No quote available for this ID"
 * }
 *
 * @example response - 500 - Error response example if an error occurs during the pre-order process
 * {
 *   "msg": "An error occurred",
 *   "e": "Error details here"
 * }
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
  if (order && order.status !== GX_ORDER_STATUS.FAILURE_G1)
    return res
      .status(400)
      .json({ msg: 'This order is already being processed' });

  // Create/update the pre-order with pending status and user details
  await db?.collection(GX_ORDER_COLLECTION).updateOne(
    { orderId: req.body.quoteId },
    {
      $set: {
        orderId: req.body.quoteId,
        date: new Date(),
        status: GX_ORDER_STATUS.PENDING,
        userTelegramID: req.body.userTelegramID,
        g1_amount: quote.g1_amount,
      },
    },
    { upsert: true },
  );

  try {
    // Send tokens for the pre-order and get transaction details
    const { data } = await sendTokens(
      req.body.userTelegramID,
      SOURCE_WALLET_ADDRESS,
      quote.g1_amount,
      await getPatchWalletAccessToken(),
      0,
    );

    // Determine the status of the pre-order based on additional conditions
    const status =
      Number(quote.usd_from_usd_investment) > 0
        ? GX_ORDER_STATUS.WAITING_USD
        : GX_ORDER_STATUS.COMPLETE;

    const date = new Date();

    // Update the pre-order with transaction details and updated status
    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.quoteId },
      {
        $set: {
          orderId: req.body.quoteId,
          date: date,
          status,
          userTelegramID: req.body.userTelegramID,
          g1_amount: quote.g1_amount,
          transactionHash: data.txHash,
          userOpHash: data.userOpHash,
        },
      },
      { upsert: true },
    );

    // Return success response with pre-order transaction details
    return res.status(200).json({
      success: true,
      order: {
        orderId: req.body.quoteId,
        date: date,
        status,
        userTelegramID: req.body.userTelegramID,
        g1_amount: quote.g1_amount,
        transactionHash: data.txHash,
        userOpHash: data.userOpHash,
      },
    });
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
          status: GX_ORDER_STATUS.FAILURE_G1,
          userTelegramID: req.body.userTelegramID,
          g1_amount: quote.g1_amount,
        },
      },
      { upsert: true },
    );

    // Return error response if an error occurs during the pre-order process
    return res.status(500).json({ msg: 'An error occurred', e });
  }
});

router.post('/usd-order', authenticateApiKey, async (req, res) => {
  const db = await Database.getInstance();

  const quote = await db
    ?.collection(GX_QUOTE_COLLECTION)
    .findOne({ quoteId: req.body.quoteId });

  if (!quote)
    return res.status(400).json({ msg: 'No quote available for this ID' });

  if (quote.userTelegramID !== req.body.userTelegramID)
    return res
      .status(400)
      .json({ msg: 'Quote ID is not linked to the provided user Telegram ID' });

  const order = await db
    ?.collection(GX_ORDER_COLLECTION)
    .findOne({ orderId: req.body.quoteId });

  if (order && order.status !== GX_ORDER_STATUS.WAITING_USD)
    return res
      .status(400)
      .json({ msg: 'Status of the order is not ready to process USD payment' });

  try {
    const token_price = await getTokenPrice(
      req.body.chainId,
      req.body.token_address,
    );

    const token_amount = (
      parseFloat(quote.usd_from_usd_investment) /
      parseFloat(token_price.data.result.usdPrice)
    ).toFixed(2);

    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.quoteId },
      {
        $set: {
          dateUSD: new Date(),
          status: GX_ORDER_STATUS.PENDING_USD,
          USDAmount: quote.usd_from_usd_investment,
          tokenAmount_USD: token_amount,
          tokenAddress_USD: req.body.token_address,
          chainId_USD: req.body.chainId,
        },
      },
      { upsert: false },
    );

    const { data } = await sendTokens(
      req.body.userTelegramID,
      SOURCE_WALLET_ADDRESS,
      token_amount,
      await getPatchWalletAccessToken(),
      0,
      req.body.token_address,
      req.body.chainId,
    );

    const date = new Date();

    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.quoteId },
      {
        $set: {
          dateUSD: date,
          status: GX_ORDER_STATUS.COMPLETE,
          transactionHash_USD: data.txHash,
          userOpHash_USD: data.userOpHash,
        },
      },
      { upsert: false },
    );

    return res.status(200).json({
      success: true,
      order: {
        orderId: req.body.quoteId,
        dateUSD: date,
        status: GX_ORDER_STATUS.COMPLETE,
        userTelegramID: req.body.userTelegramID,
        transactionHash_USD: data.txHash,
        userOpHash_USD: data.userOpHash,
        USDAmount: quote.usd_from_usd_investment,
        tokenAmount_USD: token_amount,
        tokenAddress_USD: req.body.token_address,
        chainId_USD: req.body.chainId,
      },
    });
  } catch (e) {
    console.error(
      `[${req.body.quoteId}] Error processing PatchWallet pre-order G1 transaction: ${e}`,
    );

    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.quoteId },
      {
        $set: {
          orderId: req.body.quoteId,
          dateUSD: new Date(),
          status: GX_ORDER_STATUS.FAILURE_USD,
          userTelegramID: req.body.userTelegramID,
        },
      },
      { upsert: false },
    );

    return res.status(500).json({ msg: 'An error occurred', e });
  }
});

/**
 * GET /v1/tge/orders
 *
 * @summary Get all orders for a specific user
 * @description Retrieves all orders associated with a specific user identified by userTelegramID.
 * @tags Orders
 * @security BearerAuth
 * @param {string} req.query.userTelegramID - The Telegram ID of the user to fetch orders.
 * @return {object[]} 200 - Success response with an array of orders for the specified user
 * @return {object} 404 - Error response if no orders are found for the given user
 * @return {object} 500 - Error response if an error occurs during order retrieval
 *
 * @example request - 200 - Example request query parameter
 * /v1/tge/orders?userTelegramID=user-telegram-id
 *
 * @example response - 200 - Success response example
 * [
 *   {
 *     "orderId": "order-id-1",
 *     "date": "2023-12-31T12:00:00Z",
 *     "status": "PENDING",
 *     "userTelegramID": "user-telegram-id",
 *     "g1_amount": "1000.00",
 *     "transactionHash": "transaction-hash",
 *     "userOpHash": "user-operation-hash"
 *   },
 *   {
 *     "orderId": "order-id-2",
 *     "date": "2023-12-30T12:00:00Z",
 *     "status": "COMPLETE",
 *     "userTelegramID": "user-telegram-id",
 *     "g1_amount": "500.00",
 *     "transactionHash": "transaction-hash",
 *     "userOpHash": "user-operation-hash"
 *   },
 *   // ...other orders
 * ]
 *
 * @example response - 404 - Error response example
 * {
 *   "msg": "No orders found for this user"
 * }
 *
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.get('/orders', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();

    return res
      .status(200)
      .json(
        await db
          ?.collection(GX_ORDER_COLLECTION)
          .find({ userTelegramID: req.query.userTelegramID })
          .toArray(),
      );
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

/**
 * GET /v1/tge/quotes
 *
 * @summary Get all quotes for a specific user
 * @description Retrieves all quotes associated with a specific user identified by userTelegramID.
 * @tags Quotes
 * @security BearerAuth
 * @param {string} req.query.userTelegramID - The Telegram ID of the user to fetch quotes.
 * @return {object[]} 200 - Success response with an array of quotes for the specified user
 * @return {object} 404 - Error response if no quotes are found for the given user
 * @return {object} 500 - Error response if an error occurs during quote retrieval
 *
 * @example request - 200 - Example request query parameter
 * /v1/tge/quotes?userTelegramID=user-telegram-id
 *
 * @example response - 200 - Success response example
 * [
 *   {
 *     "quoteId": "quote-id-1",
 *     "date": "2023-12-31T12:00:00Z",
 *     "usd_from_usd_investment": "10",
 *     // ...other fields
 *   },
 *   {
 *     "quoteId": "quote-id-2",
 *     "date": "2023-12-30T12:00:00Z",
 *     "usd_from_usd_investment": "20",
 *     // ...other fields
 *   },
 *   // ...other quotes
 * ]
 *
 * @example response - 404 - Error response example
 * {
 *   "msg": "No quotes found for this user"
 * }
 *
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.get('/quotes', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();

    return res
      .status(200)
      .json(
        await db
          ?.collection(GX_QUOTE_COLLECTION)
          .find({ userTelegramID: req.query.userTelegramID })
          .toArray(),
      );
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

/**
 * GET /v1/tge/order-status
 *
 * @summary Get the status of a Gx token order
 * @description Retrieves the status of a Gx token order based on the order ID and associated quote.
 * @tags Order Status
 * @security BearerAuth
 * @param {string} req.query.orderId - The order ID to fetch the status.
 * @return {object} 200 - Success response with the merged order and quote details
 * @return {object} 404 - Error response if either order or quote not found
 * @return {object} 500 - Error response if an error occurs during status retrieval
 *
 * @example request - 200 - Example request query parameter
 * /v1/tge/order-status?orderId=mocked-order-id
 *
 * @example response - 200 - Success response example
 * {
 *   "orderId": "mocked-order-id",
 *   "status": "COMPLETE",
 *   "quoteId": "mocked-quote-id",
 *   "g1_amount": "1000.00",
 *   "usd_from_usd_investment": "1",
 *   "usd_from_g1_holding": "1",
 *   "usd_from_mvu": "1",
 *   "usd_from_time": "1",
 *   "equivalent_usd_invested": "1",
 *   "gx_before_mvu": "1",
 *   "gx_mvu_effect": "1",
 *   "gx_time_effect": "1",
 *   "equivalent_gx_usd_exchange_rate": "1",
 *   "standard_gx_usd_exchange_rate": "1",
 *   "discount_received": "1",
 *   "gx_received": "1",
 *   "userTelegramID": "user-telegram-id"
 * }
 *
 * @example response - 404 - Error response example
 * {
 *   "msg": "Order or quote not found"
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

    const [order, quote] = await Promise.all([
      db
        ?.collection(GX_ORDER_COLLECTION)
        .findOne({ orderId: req.query.orderId }),
      db
        ?.collection(GX_QUOTE_COLLECTION)
        .findOne({ quoteId: req.query.orderId }),
    ]);

    if (!order || !quote) {
      return res.status(404).json({ msg: 'Order or quote not found' });
    }

    return res.status(200).json({ ...order, ...quote });
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

export default router;
