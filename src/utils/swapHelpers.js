import { Database } from '../db/conn.js';
import { SWAPS_COLLECTION } from './constants.js';

async function findSwapDB(query) {
  const db = await Database.getInstance();
  try {
    return await db.collection(SWAPS_COLLECTION).findOne(query);
  } catch (error) {
    throw error;
  }
}

async function insertSwapDB(db, params) {
  try {
    const set = {};

    if (params.txId) set.txId = params.txId;
    if (params.chainId) set.chainId = params.chainId;
    if (params.userTgId) set.userTgId = params.userTgId;
    if (params.userWallet) set.userWallet = params.userWallet;
    if (params.userName) set.userName = params.userName;
    if (params.userHandle) set.userHandle = params.userHandle;
    if (params.tokenIn) set.tokenIn = params.tokenIn;
    if (params.amountIn) set.amountIn = params.amountIn;
    if (params.tokenOut) set.tokenOut = params.tokenOut;
    if (params.amountOut) set.amountOut = params.amountOut;
    if (params.priceImpact) set.priceImpact = params.priceImpact;
    if (params.gas) set.gas = params.gas;
    if (params.status) set.status = params.status;
    if (params.transactionHash) set.transactionHash = params.transactionHash;
    if (params.userOpHash) set.userOpHash = params.userOpHash;
    if (params.dateAdded) set.dateAdded = params.dateAdded;

    const result = await db.collection(SWAPS_COLLECTION).insertOne(set);

    return result;
  } catch (error) {
    throw error;
  }
}

export const swap_helpers = {
  findSwapDB,
  insertSwapDB,
};
