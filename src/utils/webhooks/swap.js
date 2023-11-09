import { TRANSACTION_STATUS, USERS_COLLECTION } from '../constants.js';
import { getPatchWalletAccessToken, swapTokens } from '../patchwallet.js';
import { swap_helpers } from '../swapHelpers.js';
import { Database } from '../../db/conn.js';
import axios from 'axios';

export async function handleSwap(params) {
  const db = await Database.getInstance();
  let txSwap = undefined;

  const userInformation = await db
    .collection(USERS_COLLECTION)
    .findOne({ userTelegramID: params.userTelegramID });

  if (!userInformation) {
    console.error(
      `[${params.eventId}] User Telegram Id ${params.userTelegramID} is not a user`
    );
    return false;
  }

  const swap = await swap_helpers.findSwapDB({
    userTelegramID: params.userTelegramID,
    eventId: params.eventId,
  });

  if (swap?.status === TRANSACTION_STATUS.SUCCESS) {
    console.log(
      `[${params.eventId}] ${params.userTelegramID} user already swap tokens.`
    );
    return true;
  }

  if (!swap) {
    try {
      txSwap = await swapTokens(
        params.userTelegramID,
        params.to,
        params.data,
        await getPatchWalletAccessToken()
      );

      if (txSwap.data.txHash) {
        const toSave = {
          txId: txSwap.data.txHash.substring(1, 8),
          chainId: 'eip155:137',
          userTgId: userInformation.userTelegramID,
          userWallet: userInformation.patchwallet,
          userName: userInformation.userName,
          userHandle: userInformation.userHandle,
          tokenIn: params.tokenIn,
          amountIn: params.amountIn,
          tokenOut: params.tokenOut,
          amountOut: params.amountOut,
          priceImpact: params.priceImpact,
          gas: params.gas,
          status: TRANSACTION_STATUS.SUCCESS,
          transactionHash: txSwap.data.txHash,
          userOpHash: txSwap.data.userOpHash,
          dateAdded: new Date(),
        };

        await swap_helpers.insertSwapDB(db, toSave);

        // Notify external system about the swap
        await axios.post(process.env.FLOWXO_NEW_SWAP_WEBHOOK, toSave);

        return true;
      }

      return false;
    } catch (error) {
      console.error(
        `[${params.eventId}] Error processing PatchWallet swap for ${params.userTelegramID}: ${error.message}`
      );
      return false;
    }
  }
}
