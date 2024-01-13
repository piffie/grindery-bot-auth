import express from 'express';
import { authenticateApiKey } from '../utils/auth';
import { computeG1ToGxConversion } from '../utils/g1gx';
import { Database } from '../db/conn';
import {
  GX_ORDER_COLLECTION,
  GX_QUOTE_COLLECTION,
  Ordertype,
} from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { getTokenPrice } from '../utils/ankr';
import { GxOrderStatus } from 'grindery-nexus-common-utils';
import { UserTelegram } from '../utils/user';

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
 *   "userTelegramID": "user-telegram-id",
 *   "tokenAmount": "10",
 *   "chainId": "1",
 *   "tokenAddress": "0x123456789ABCDEF"
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

    // Calculate token price based on chainId and token address
    const token_price = await getTokenPrice(
      req.query.chainId as string,
      req.query.tokenAddress as string,
    );

    const usdQuantity = (
      parseFloat(req.query.tokenAmount as string) *
      parseFloat(token_price.data.result.usdPrice)
    ).toFixed(2);

    const user = await UserTelegram.build(req.query.userTelegramID as string);

    const result = computeG1ToGxConversion(
      Number(usdQuantity),
      Number(req.query.g1Quantity),
      user.getMvu() || 0,
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
          tokenAmount: req.query.tokenAmount,
          chainId: req.query.chainId,
          tokenAddress: req.query.tokenAddress,
        },
      },
      { upsert: true },
    );

    return res.status(200).json({
      ...result,
      date,
      quoteId: id,
      userTelegramID: req.query.userTelegramID,
      tokenAmount: req.query.tokenAmount,
      chainId: req.query.chainId,
      tokenAddress: req.query.tokenAddress,
    });
  } catch (error) {
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
