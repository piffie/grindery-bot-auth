import express from 'express';
import { authenticateApiKey } from '../utils/auth';
import {
  computeG1ToGxConversion,
  extractMvuValueFromAttributes,
} from '../utils/g1gx';
import { Database } from '../db/conn';
import {
  GX_ORDER_COLLECTION,
  GX_QUOTE_COLLECTION,
  USERS_COLLECTION,
} from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { getPatchWalletAccessToken, sendTokens } from '../utils/patchwallet';
import { SOURCE_WALLET_ADDRESS } from '../../secrets';
import { getTokenPrice } from '../utils/ankr';
import { GxOrderStatus } from 'grindery-nexus-common-utils';

const router = express.Router();

/**
 * GET /v1/tge/quote
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
 * /v1/tge/quote?usdQuantity=100&g1Quantity=50
 *
 * @example response - 200 - Success response example
 * {
 *   "usdFromUsdInvestment": "10",
 *   "usdFromG1Investment": "0.049",
 *   "usdFromMvu": "0.80",
 *   "usdFromTime": "1.04",
 *   "equivalentUsdInvested": "11.89",
 *   "gxBeforeMvu": "279.16",
 *   "gxMvuEffect": "22.33",
 *   "gxTimeEffect": "29.00",
 *   "gxReceived": "1200",
 *   "GxUsdExchangeRate": "32.88",
 *   "standardGxUsdExchangeRate": "27.77",
 *   "discountReceived": "15.53",
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
router.get('/quote', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();

    const result = computeG1ToGxConversion(
      Number(req.query.usdQuantity),
      Number(req.query.g1Quantity),
      extractMvuValueFromAttributes(
        (
          await db
            ?.collection(USERS_COLLECTION)
            .findOne({ userTelegramID: req.query.userTelegramID })
        )?.attributes,
      ) || 0,
    );

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
 * POST /v1/tge/order
 *
 * @summary Create a Gx token order
 * @description Initiates an order for Gx tokens based on the provided quote ID and user details.
 * @tags Pre-Order
 * @security BearerAuth
 * @param {string} req.body.quoteId - The quote ID to create an order.
 * @param {string} req.body.userTelegramID - The user's Telegram ID for identification.
 * @return {object} 200 - Success response with the order transaction details
 * @return {object} 400 - Error response if a quote is unavailable or the order is being processed
 * @return {object} 500 - Error response if an error occurs during the order process
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
 *     "status": "WAITING_USD",
 *     "transactionHashG1": "mock-transaction-hash",
 *     "userOpHashG1": "mock-user-op-hash",
 *     "quote": {
 *       "quoteId": "mocked-quote-id",
 *       "tokenAmountG1": "1000.00",
 *       "usdFromUsdInvestment": "1",
 *       "usdFromG1Investment": "1",
 *       "usdFromMvu": "1",
 *       "usdFromTime": "1",
 *       "equivalentUsdInvested": "1",
 *       "gxBeforeMvu": "1",
 *       "gxMvuEffect": "1",
 *       "gxTimeEffect": "1",
 *       "GxUsdExchangeRate": "1",
 *       "standardGxUsdExchangeRate": "1",
 *       "discountReceived": "1",
 *       "gxReceived": "1",
 *       "userTelegramID": "user-telegram-id"
 *     }
 *   }
 * }
 *
 * @example response - 400 - Error response example if a quote is unavailable or the order is being processed
 * {
 *   "success": false,
 *   "msg": "No quote available for this ID"
 * }
 *
 * @example response - 500 - Error response example if an error occurs during the order process
 * {
 *   "success": false,
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.post('/order', authenticateApiKey, async (req, res) => {
  const db = await Database.getInstance();

  // Retrieve quote details based on the provided quoteId
  const quote = await db
    ?.collection(GX_QUOTE_COLLECTION)
    .findOne({ quoteId: req.body.quoteId });

  // If quote is not found, return an error response
  if (!quote)
    return res
      .status(400)
      .json({ success: false, msg: 'No quote available for this ID' });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...quoteWithoutId } = quote;

  if (quote.userTelegramID !== req.body.userTelegramID)
    return res.status(400).json({
      success: false,
      msg: 'Quote ID is not linked to the provided user Telegram ID',
    });

  // Check if an order with the same quoteId is already being processed
  const order = await db
    ?.collection(GX_ORDER_COLLECTION)
    .findOne({ orderId: req.body.quoteId });

  // If an order is already being processed, return an error response
  if (order && order.status !== GxOrderStatus.FAILURE_G1)
    return res
      .status(400)
      .json({ success: false, msg: 'This order is already being processed' });

  // Create/update the order with pending status and user details
  await db?.collection(GX_ORDER_COLLECTION).updateOne(
    { orderId: req.body.quoteId },
    {
      $set: {
        orderId: req.body.quoteId,
        dateG1: new Date(),
        status: GxOrderStatus.PENDING,
        ...quoteWithoutId,
      },
    },
    { upsert: true },
  );

  try {
    // Send tokens for the order and get transaction details
    const { data } = await sendTokens(
      req.body.userTelegramID,
      SOURCE_WALLET_ADDRESS,
      quote.tokenAmountG1,
      await getPatchWalletAccessToken(),
      0,
    );

    // Determine the status of the order based on additional conditions
    const status =
      Number(quote.usdFromUsdInvestment) > 0
        ? GxOrderStatus.WAITING_USD
        : GxOrderStatus.COMPLETE;

    const date = new Date();

    // Update the order with transaction details and updated status
    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.quoteId },
      {
        $set: {
          orderId: req.body.quoteId,
          dateG1: date,
          status,
          transactionHashG1: data.txHash,
          userOpHashG1: data.userOpHash,
        },
      },
      { upsert: false },
    );

    // Delete quote from the database
    await db
      ?.collection(GX_QUOTE_COLLECTION)
      .deleteOne({ quoteId: req.body.quoteId });

    // Return success response with order transaction details
    return res.status(200).json({
      success: true,
      order: {
        orderId: req.body.quoteId,
        dateG1: date,
        status,
        transactionHashG1: data.txHash,
        userOpHashG1: data.userOpHash,
        quote: quoteWithoutId,
      },
    });
  } catch (e) {
    // Log error if transaction fails and update order status to failure
    console.error(
      `[${req.body.quoteId}] Error processing PatchWallet order G1 transaction: ${e}`,
    );

    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.quoteId },
      {
        $set: {
          orderId: req.body.quoteId,
          dateG1: new Date(),
          status: GxOrderStatus.FAILURE_G1,
          ...quoteWithoutId,
        },
      },
      { upsert: false },
    );

    // Return error response if an error occurs during the order process
    return res
      .status(500)
      .json({ success: false, msg: 'An error occurred', error: e });
  }
});

/**
 * PATCH /v1/tge/order
 *
 * @summary Process USD-based Gx token order
 * @description Processes an order for Gx tokens using USD, linking it to the provided quote ID and user details.
 * @tags USD Order
 * @security BearerAuth
 * @param {string} req.body.quoteId - The quote ID to process the order.
 * @param {string} req.body.userTelegramID - The user's Telegram ID for identification.
 * @param {string} req.body.tokenAddress - The token address for USD-based order.
 * @param {string} req.body.chainId - The chain ID for USD-based order.
 * @return {object} 200 - Success response with processed order details
 * @return {object} 400 - Error response if the quote is unavailable or order status is not ready for USD payment
 * @return {object} 500 - Error response if an error occurs during the order processing
 *
 * @example request - 200 - Example request body
 * {
 *   "quoteId": "mocked-quote-id",
 *   "userTelegramID": "user-telegram-id",
 *   "tokenAddress": "token-address",
 *   "chainId": "chain-id"
 * }
 *
 * @example response - 200 - Success response example
 * {
 *   "success": true,
 *   "order": {
 *     "orderId": "mocked-quote-id",
 *     "status": "COMPLETE",
 *     "transactionHashUSD": "transaction-hash",
 *     "userOpHashUSD": "user-operation-hash",
 *     "tokenAmountUSD": "25.00",
 *     "tokenAddressUSD": "token-address",
 *     "chainIdUSD": "chain-id"
 *     // Other properties omitted for brevity
 *   }
 * }
 *
 * @example response - 400 - Error response example if the quote is unavailable or order status is not ready for USD payment
 * {
 *   "success": false,
 *   "msg": "No quote available for this ID"
 * }
 *
 * @example response - 500 - Error response example if an error occurs during the order processing
 * {
 *   "success": false,
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.patch('/order', authenticateApiKey, async (req, res) => {
  const db = await Database.getInstance();

  // Fetch order details based on the quoteId
  const order = await db
    ?.collection(GX_ORDER_COLLECTION)
    .findOne({ orderId: req.body.orderId });

  // If order is not found, return an error response
  if (!order)
    return res
      .status(400)
      .json({ success: false, msg: 'No order available for this ID' });

  // Check if the order's userTelegramID matches the provided userTelegramID
  if (order.userTelegramID !== req.body.userTelegramID)
    return res.status(400).json({
      success: false,
      msg: 'Order ID is not linked to the provided user Telegram ID',
    });

  // If an order exists and status is not ready for USD payment, return an error response
  if (
    order &&
    order.status !== GxOrderStatus.WAITING_USD &&
    order.status !== GxOrderStatus.FAILURE_USD
  )
    return res
      .status(400)
      .json({ msg: 'Status of the order is not ready to process USD payment' });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...orderWithoutId } = order;

  try {
    // Calculate token price based on chainId and token address
    const token_price = await getTokenPrice(
      req.body.chainId,
      req.body.tokenAddress,
    );

    // Calculate token amount for the USD investment
    const token_amount = (
      parseFloat(order.usdFromUsdInvestment) /
      parseFloat(token_price.data.result.usdPrice)
    ).toFixed(2);

    // Update order details with USD-based information
    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.orderId },
      {
        $set: {
          dateUSD: new Date(),
          status: GxOrderStatus.PENDING_USD,
          tokenAmountUSD: token_amount,
          tokenAddressUSD: req.body.tokenAddress,
          chainIdUSD: req.body.chainId,
        },
      },
      { upsert: false },
    );

    // Send tokens for the USD-based order and retrieve transaction details
    const { data } = await sendTokens(
      req.body.userTelegramID,
      SOURCE_WALLET_ADDRESS,
      token_amount,
      await getPatchWalletAccessToken(),
      0,
      req.body.tokenAddress,
      req.body.chainId,
    );

    // Record the date for the transaction
    const date = new Date();

    // Update order status and transaction details upon successful transaction
    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.orderId },
      {
        $set: {
          dateUSD: date,
          status: GxOrderStatus.COMPLETE,
          transactionHashUSD: data.txHash,
          userOpHashUSD: data.userOpHash,
        },
      },
      { upsert: false },
    );

    // Return success response with processed order details
    return res.status(200).json({
      success: true,
      order: {
        ...orderWithoutId,
        orderId: req.body.orderId,
        dateUSD: date,
        status: GxOrderStatus.COMPLETE,
        transactionHashUSD: data.txHash,
        userOpHashUSD: data.userOpHash,
        tokenAddressUSD: req.body.tokenAddress,
        chainIdUSD: req.body.chainId,
        tokenAmountUSD: token_amount,
      },
    });
  } catch (e) {
    // Log error if transaction fails and update order status to failure
    console.error(
      `[${req.body.orderId}] Error processing PatchWallet order G1 transaction: ${e}`,
    );

    // Update order status to failure in case of transaction error
    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.orderId },
      {
        $set: {
          orderId: req.body.orderId,
          dateUSD: new Date(),
          status: GxOrderStatus.FAILURE_USD,
          userTelegramID: req.body.userTelegramID,
        },
      },
      { upsert: false },
    );

    // Return error response if an error occurs during the order processing
    return res
      .status(500)
      .json({ success: false, msg: 'An error occurred', error: e });
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
 *     "tokenAmountG1": "1000.00",
 *     "transactionHashG1": "transaction-hash",
 *     "userOpHashG1": "user-operation-hash"
 *   },
 *   {
 *     "orderId": "order-id-2",
 *     "date": "2023-12-30T12:00:00Z",
 *     "status": "COMPLETE",
 *     "userTelegramID": "user-telegram-id",
 *     "tokenAmountG1": "500.00",
 *     "transactionHashG1": "transaction-hash",
 *     "userOpHashG1": "user-operation-hash"
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
 *     "usdFromUsdInvestment": "10",
 *     // ...other fields
 *   },
 *   {
 *     "quoteId": "quote-id-2",
 *     "date": "2023-12-30T12:00:00Z",
 *     "usdFromUsdInvestment": "20",
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
 * GET /v1/tge/order
 *
 * @summary Get the status of a Gx token order
 * @description Retrieves the status of a Gx token order based on the order ID and associated quote.
 * @tags Order Status
 * @security BearerAuth
 * @param {string} req.query.orderId - The order ID to fetch the status.
 * @return {object} 200 - Success response with the merged order and quote details or individual order/quote
 * @return {object} 404 - Error response if either order or quote not found
 * @return {object} 500 - Error response if an error occurs during status retrieval
 *
 * @example request - 200 - Example request query parameter
 * /v1/tge/order?orderId=mocked-order-id
 *
 * @example response - 200 - Success response example if order ID is present in the database
 * {
 *   "order": {
 *     "orderId": "mocked-order-id",
 *     "status": "COMPLETE",
 *     "quoteId": "mocked-quote-id",
 *     "tokenAmountG1": "1000.00",
 *     "usdFromUsdInvestment": "1",
 *     "usdFromG1Investment": "1",
 *     "usdFromMvu": "1",
 *     "usdFromTime": "1",
 *     "equivalentUsdInvested": "1",
 *     "gxBeforeMvu": "1",
 *     "gxMvuEffect": "1",
 *     "gxTimeEffect": "1",
 *     "GxUsdExchangeRate": "1",
 *     "standardGxUsdExchangeRate": "1",
 *     "discountReceived": "1",
 *     "gxReceived": "1",
 *     "userTelegramID": "user-telegram-id"
 *   }
 * }
 *
 * @example response - 200 - Success response example if quote ID is present in the database
 * {
 *   "quote": {
 *     "quoteId": "mocked-quote-id",
 *     "tokenAmountG1": "1000.00",
 *     "usdFromUsdInvestment": "1",
 *     "usdFromG1Investment": "1",
 *     "usdFromMvu": "1",
 *     "usdFromTime": "1",
 *     "equivalentUsdInvested": "1",
 *     "gxBeforeMvu": "1",
 *     "gxMvuEffect": "1",
 *     "gxTimeEffect": "1",
 *     "GxUsdExchangeRate": "1",
 *     "standardGxUsdExchangeRate": "1",
 *     "discountReceived": "1",
 *     "gxReceived": "1",
 *     "userTelegramID": "user-telegram-id"
 *   }
 * }
 *
 * @example response - 404 - Error response example if order and quote IDs are not present in the database
 * {
 *   "msg": "Order and quote not found"
 * }
 *
 * @example response - 500 - Error response example if an error occurs during status retrieval
 * {
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.get('/order', authenticateApiKey, async (req, res) => {
  try {
    // Retrieves the instance of the database
    const db = await Database.getInstance();

    // Retrieves an order based on the orderId from the GX_ORDER_COLLECTION
    const order = await db
      ?.collection(GX_ORDER_COLLECTION)
      .findOne({ orderId: req.query.orderId });

    // If no order is found
    if (!order) {
      // Retrieves a quote based on the orderId from the GX_QUOTE_COLLECTION
      const quote = await db
        ?.collection(GX_QUOTE_COLLECTION)
        .findOne({ quoteId: req.query.orderId });

      // If no quote is found for the provided orderId
      if (!quote)
        // Returns a 404 status with a JSON response indicating 'Order and quote not found'
        return res.status(404).json({ msg: 'Order and quote not found' });

      // Returns a 200 status with a JSON response containing the found quote
      return res.status(200).json({ quote });
    }

    // Returns a 200 status with a JSON response containing the found order
    return res.status(200).json({ order });
  } catch (error) {
    // Returns a 500 status with a JSON response indicating an error occurred
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

export default router;
