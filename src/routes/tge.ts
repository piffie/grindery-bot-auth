import express from 'express';
import { authenticateApiKey } from '../utils/auth';
import { computeG1ToGxConversion, getUserTgeBalance } from '../utils/g1gx';
import { Database } from '../db/conn';
import {
  DEFAULT_CHAIN_ID,
  GX_ORDER_COLLECTION,
  GX_QUOTE_COLLECTION,
  Ordertype,
} from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { getTokenPrice } from '../utils/ankr';
import { GxOrderStatus } from 'grindery-nexus-common-utils';
import { UserTelegram } from '../utils/user';
import { G1_POLYGON_ADDRESS } from '../../secrets';
import { getUserBalance } from '../utils/web3';

const router = express.Router();

/**
 * GET /v1/tge/quote
 *
 * @summary Calculate G1 to Gx conversion
 * @description Calculates the conversion from G1 to Gx based on provided quantities of USD and G1.
 * @tags Conversion
 * @security BearerAuth
 * @param {number} g1Quantity.query - The quantity of G1.
 * @param {string} userTelegramID.query - The Telegram user ID.
 * @param {string} tokenAmount.query - The amount of tokens.
 * @param {string} chainId.query - The chain ID.
 * @param {string} tokenAddress.query - The token address.
 * @return {object} 200 - Success response with the calculated conversion value
 * @return {object} 500 - Error response if an error occurs during the conversion
 *
 * @example request - 200 - Example request query parameters
 * /v1/tge/quote?g1Quantity=50&userTelegramID=user-telegram-id&tokenAmount=10&chainId=1&tokenAddress=0x123456789ABCDEF
 *
 * @example response - 200 - Success response example
 * {
 *   "m1": "0.2000",
 *   "m2": "0.4000",
 *   "m3": "0.3000",
 *   "m4": "0.0000",
 *   "m5": "0.2500",
 *   "m6": "1.0000",
 *   "finalG1Usd": "0.005000",
 *   "gxFromUsd": "5000.00",
 *   "usdFromG1": "600000.00",
 *   "gxFromG1": "16666666.67",
 *   "gxReceived": "16671666.67",
 *   "userTelegramID": "user-telegram-id",
 *   "tokenAmountG1": "4",
 *   "usdFromUsdInvestment": "100.00",
 *   "tokenAmount": "10",
 *   "chainId": "1",
 *   "tokenAddress": "0x123456789ABCDEF",
 *   "quoteId": "some-unique-id",
 *   "date": "2023-12-31T12:00:00Z",
 *   "tokenAmountG1ForCalculations": "555.00"
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
    // Check if the G1 quantity is a positive number
    if (!(parseFloat(req.query.g1Quantity as string) > 0)) {
      return res.status(404).json({
        msg: 'The amount of G1 must be a positive number.',
      });
    }

    // Initialize USD quantity to '0'
    let usdQuantity = '0';

    // Get user details
    const user = await UserTelegram.build(req.query.userTelegramID as string);

    // Get the user's G1 balance
    const userG1Balance = await getUserBalance(
      user.patchwalletAddress() || '',
      G1_POLYGON_ADDRESS,
      DEFAULT_CHAIN_ID,
    );

    // Check if the requested G1 quantity exceeds the user's G1 balance
    if (
      parseFloat(req.query.g1Quantity as string) > parseFloat(userG1Balance)
    ) {
      return res.status(404).json({
        msg: 'Insufficient G1 balance. The G1 balance must be greater than or equal to the requested token amount for the exchange.',
      });
    }

    // Check if chainId and tokenAmount are provided
    if (
      req.query.chainId &&
      req.query.tokenAmount &&
      parseFloat(req.query.tokenAmount as string) > 0
    ) {
      // Get the user's balance for the specified token and chain
      const userOtherTokenBalance = await getUserBalance(
        user.patchwalletAddress() || '',
        req.query.tokenAddress as string,
        req.query.chainId as string,
      );

      // Check if the requested token amount exceeds the user's token balance
      if (
        parseFloat(req.query.tokenAmount as string) >
        parseFloat(userOtherTokenBalance)
      ) {
        return res.status(404).json({
          msg: `Insufficient ${req.query.tokenAddress} balance. The ${req.query.tokenAddress} balance must be greater than or equal to the requested token amount for the exchange.`,
        });
      }

      // Calculate token price based on chainId and token address
      const token_price = await getTokenPrice(
        req.query.chainId as string,
        req.query.tokenAddress as string,
      );

      // Calculate USD quantity
      usdQuantity = (
        parseFloat(req.query.tokenAmount as string) *
        parseFloat(token_price.data.result.usdPrice)
      ).toFixed(2);
    }

    // Get G1 balance for calculations
    const tokenAmountG1ForCalculations = await getUserTgeBalance(
      user.userTelegramID,
      parseFloat(req.query.g1Quantity as string),
    );

    // Generate a unique quoteId
    const quoteId = uuidv4();

    // Conversion details between G1/USD and GX
    const conversionDetails = computeG1ToGxConversion(
      Math.max(user.getBalanceSnapshot() || 0, parseFloat(userG1Balance)),
      tokenAmountG1ForCalculations,
      Number(usdQuantity),
      user.getMvu() || 0,
    );

    // Check if USD invested is > $10,000 USD
    if (parseFloat(conversionDetails.equivalentUsdInvested) > 10000) {
      return res.status(404).json({
        msg: 'The investment amount must not exceed $10,000 USD to proceed.',
      });
    }

    // Calculate G1 to Gx conversion and create a quote object
    const quote = {
      ...conversionDetails,
      quoteId,
      date: new Date(),
      userTelegramID: req.query.userTelegramID,
      tokenAmount: req.query.tokenAmount ?? '0',
      chainId: req.query.chainId ?? null,
      tokenAddress: req.query.tokenAddress ?? null,
      tokenAmountG1: req.query.g1Quantity,
      usdFromUsdInvestment: usdQuantity,
      tokenAmountG1ForCalculations: tokenAmountG1ForCalculations.toFixed(2),
    };

    // Update or insert the quote in the database
    await (await Database.getInstance())
      ?.collection(GX_QUOTE_COLLECTION)
      .updateOne({ quoteId: quoteId }, { $set: quote }, { upsert: true });

    // Return the calculated values in the response
    return res.status(200).json(quote);
  } catch (error) {
    // Handle errors and return a 500 response
    return res.status(500).json({ msg: 'An error occurred', error });
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
 * GET /status
 *
 * @summary Get the status of orders and the associated quote
 * @description Retrieves the status of all orders associated with a given quote ID, along with the quote details.
 *              This endpoint is designed to fetch both G1 and USD order types and compile their information along with the quote data.
 * @tags Order Status, Quote Status
 * @security BearerAuth
 * @param {string} req.query.quoteId - The quote ID to fetch associated orders and quote details.
 * @return {object} 200 - Success response with the details of orders and the associated quote
 * @return {object} 404 - Error response if either orders or quote not found for the given quote ID
 * @return {object} 500 - Error response if an error occurs during data retrieval
 *
 * @example request - 200 - Example request query parameter
 * /status?quoteId=mocked-quote-id
 *
 * @example response - 200 - Success response example with orders and quote details
 * {
 *   "quote": {
 *     "quoteId": "mocked-quote-id",
 *     "tokenAmountG1": "500.00",
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
 *   },
 *   "orders": [
 *     {
 *       "orderId": "mocked-order-id",
 *       "status": "COMPLETE",
 *       "orderType": "G1",
 *       "quoteId": "mocked-quote-id",
 *       "userTelegramID": "user-telegram-id"
 *     },
 *     {
 *       "orderId": "mocked-order-id-2",
 *       "status": "COMPLETE",
 *       "orderType": "USD",
 *       "quoteId": "mocked-quote-id",
 *       "userTelegramID": "user-telegram-id"
 *     }
 *   ]
 * }
 *
 * @example response - 404 - Error response example if no orders or quote found for the quote ID
 * {
 *   "msg": "Order or quote not found"
 * }
 *
 * @example response - 500 - Error response example if an error occurs during data retrieval
 * {
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.get('/status', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();
    const quoteId = req.query.quoteId;

    const orders = await db
      ?.collection(GX_ORDER_COLLECTION)
      .find({ quoteId }, { projection: { _id: 0 } })
      .toArray();

    if (!orders || orders.length === 0) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    const quote = await db
      ?.collection(GX_QUOTE_COLLECTION)
      .findOne({ quoteId }, { projection: { _id: 0 } });

    const consolidatedOrder = {
      quoteId: quoteId,
      status: GxOrderStatus.PENDING, // Default status
      ...quote,
      orderIdG1: null,
      dateG1: null,
      transactionHashG1: null,
      userOpHashG1: null,
      orderIdUSD: null,
      dateUSD: null,
      chainIdUSD: null,
      tokenAddressUSD: null,
      tokenAmountUSD: null,
      transactionHashUSD: null,
      userOpHashUSD: null,
    };

    const orderG1 = orders.find((order) => order.orderType === Ordertype.G1);
    if (orderG1) {
      consolidatedOrder.orderIdG1 = orderG1.orderId;
      consolidatedOrder.dateG1 = orderG1.dateG1;
      consolidatedOrder.transactionHashG1 = orderG1.transactionHashG1;
      consolidatedOrder.userOpHashG1 = orderG1.userOpHashG1;
    }

    const orderUSD = orders.find((order) => order.orderType === Ordertype.USD);
    if (orderUSD) {
      consolidatedOrder.orderIdUSD = orderUSD.orderId;
      consolidatedOrder.dateUSD = orderUSD.dateUSD;
      consolidatedOrder.chainIdUSD = orderUSD.chainIdUSD;
      consolidatedOrder.tokenAddressUSD = orderUSD.tokenAddressUSD;
      consolidatedOrder.tokenAmountUSD = orderUSD.tokenAmountUSD;
      consolidatedOrder.transactionHashUSD = orderUSD.transactionHashUSD;
      consolidatedOrder.userOpHashUSD = orderUSD.userOpHashUSD;
    }

    // Calculate the final status based on the statuses of G1 and USD orders
    const isG1Successful = orders.some(
      (order) =>
        order.orderType === Ordertype.G1 &&
        order.status === GxOrderStatus.COMPLETE,
    );
    const isUSDSuccessful = orders.some(
      (order) =>
        order.orderType === Ordertype.USD &&
        order.status === GxOrderStatus.COMPLETE,
    );
    const isAnyOrderPending = orders.some(
      (order) =>
        order.status === GxOrderStatus.PENDING ||
        order.status === GxOrderStatus.WAITING_USD,
    );

    if (isAnyOrderPending) {
      consolidatedOrder.status = GxOrderStatus.PENDING;
    } else if (
      isG1Successful &&
      (isUSDSuccessful ||
        !orders.some((order) => order.orderType === Ordertype.USD))
    ) {
      consolidatedOrder.status = GxOrderStatus.COMPLETE;
    } else if (!isUSDSuccessful) {
      consolidatedOrder.status = GxOrderStatus.FAILURE_USD;
    } else if (!isG1Successful) {
      consolidatedOrder.status = GxOrderStatus.FAILURE_G1;
    }

    return res.status(200).json(consolidatedOrder);
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

export default router;
