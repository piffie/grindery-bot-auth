import { Database } from '../db/conn.js';
import {
  REWARDS_COLLECTION,
  TRANSACTION_STATUS,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
} from './constants.js';
import {
  getPatchWalletAccessToken,
  getPatchWalletAddressFromTgId,
  sendTokens,
} from './patchwallet.js';
import { addIdentitySegment, addTrackSegment } from './segment.js';
import axios from 'axios';
import 'dotenv/config';
import { sendTelegramMessage } from './telegram.js';

/**
 * Handles the signup reward for a user.
 *
 * @param {Object} db - The database object.
 * @param {string} eventId - The event ID.
 * @param {string} userTelegramID - The user's Telegram ID.
 * @param {string} responsePath - The response path.
 * @param {string} userHandle - The user's handle.
 * @param {string} userName - The user's name.
 * @param {string} rewardWallet - The wallet for the reward.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
export async function handleSignUpReward(
  db,
  eventId,
  userTelegramID,
  responsePath,
  userHandle,
  userName,
  rewardWallet
) {
  try {
    // Check if this event already exists
    const reward = await db.collection(REWARDS_COLLECTION).findOne({
      userTelegramID: userTelegramID,
      eventId: eventId,
      reason: 'user_sign_up',
    });

    if (
      reward?.status === TRANSACTION_STATUS.SUCCESS ||
      (await db.collection(REWARDS_COLLECTION).findOne({
        userTelegramID: userTelegramID,
        eventId: { $ne: eventId },
        reason: 'user_sign_up',
      }))
    ) {
      // The user has already received a signup reward, stop processing
      console.log(
        `[${eventId}] ${userTelegramID} user already received signup reward.`
      );
      return true;
    }

    if (!reward) {
      // Create a new reward record
      await db.collection(REWARDS_COLLECTION).insertOne({
        eventId: eventId,
        userTelegramID: userTelegramID,
        responsePath: responsePath,
        walletAddress: rewardWallet,
        reason: 'user_sign_up',
        userHandle: userHandle,
        userName: userName,
        amount: '100',
        message: 'Sign up reward',
        dateAdded: new Date(),
        status: TRANSACTION_STATUS.PENDING,
      });

      console.log(`[${eventId}] pending sign up reward added to the database.`);
    }

    let txReward = undefined;

    try {
      // Send tokens to the user
      txReward = await sendTokens(
        process.env.SOURCE_TG_ID,
        rewardWallet,
        '100',
        await getPatchWalletAccessToken()
      );
    } catch (error) {
      console.error(
        `[${eventId}] Error processing PatchWallet user sign up reward for ${userTelegramID}: ${error}`
      );
      return false;
    }

    if (txReward.data.txHash) {
      const dateAdded = new Date();

      // Update the reward record to mark it as successful
      await db.collection(REWARDS_COLLECTION).updateOne(
        {
          userTelegramID: userTelegramID,
          eventId: eventId,
          reason: 'user_sign_up',
        },
        {
          $set: {
            userTelegramID: userTelegramID,
            eventId: eventId,
            reason: 'user_sign_up',
            responsePath: responsePath,
            walletAddress: rewardWallet,
            userHandle: userHandle,
            userName: userName,
            amount: '100',
            message: 'Sign up reward',
            transactionHash: txReward.data.txHash,
            dateAdded: dateAdded,
            status: TRANSACTION_STATUS.SUCCESS,
          },
        },
        { upsert: true }
      );

      // Find the reward record by transaction hash
      const reward_db = await db
        .collection(REWARDS_COLLECTION)
        .findOne({ transactionHash: txReward.data.txHash });

      console.log(
        `[${
          txReward.data.txHash
        }] signup reward added to Mongo DB with event ID ${eventId} and Object ID ${reward_db._id.toString()}.`
      );

      // Notify external system about the reward
      await axios.post(process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK, {
        userTelegramID: userTelegramID,
        responsePath: responsePath,
        walletAddress: rewardWallet,
        reason: 'user_sign_up',
        userHandle: userHandle,
        userName: userName,
        amount: '100',
        message: 'Sign up reward',
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
      });

      console.log(`[${userTelegramID}] user added to the database.`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(
      `[${eventId}] Error processing sign up reward event: ${error}`
    );
  }
  return true;
}

/**
 * Handles the referral reward for a user.
 *
 * @param {Object} db - The database object.
 * @param {string} eventId - The event ID.
 * @param {string} userTelegramID - The user's Telegram ID.
 * @param {string} responsePath - The response path.
 * @param {string} userHandle - The user's handle.
 * @param {string} userName - The user's name.
 * @param {string} patchwallet - The user's Patchwallet.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
export async function handleReferralReward(
  db,
  eventId,
  userTelegramID,
  responsePath,
  userHandle,
  userName,
  patchwallet
) {
  try {
    // Initialize a flag to track the success of all transactions
    let processed = true;

    // Retrieve all transfers where this user is the recipient
    // For each transfer, award a reward to the sender
    for await (const transfer of db
      .collection(TRANSFERS_COLLECTION)
      .find({
        senderTgId: { $ne: userTelegramID },
        recipientTgId: userTelegramID,
      })) {
      const reward = await db.collection(REWARDS_COLLECTION).findOne({
        reason: '2x_reward',
        eventId: eventId,
        parentTransactionHash: transfer.transactionHash,
      });

      if (
        reward?.status === TRANSACTION_STATUS.SUCCESS ||
        (await db.collection(REWARDS_COLLECTION).findOne({
          reason: '2x_reward',
          eventId: { $ne: eventId },
          parentTransactionHash: transfer.transactionHash,
        }))
      ) {
        continue;
      }

      // Retrieve sender information from the "users" collection
      const senderInformation = await db
        .collection(USERS_COLLECTION)
        .findOne({ userTelegramID: transfer.senderTgId });

      const senderWallet =
        senderInformation?.patchwallet ??
        (await getPatchWalletAddressFromTgId(senderInformation.userTelegramID));

      if (!reward) {
        await db.collection(REWARDS_COLLECTION).insertOne({
          eventId: eventId,
          userTelegramID: senderInformation.userTelegramID,
          responsePath: senderInformation.responsePath,
          walletAddress: senderWallet,
          reason: '2x_reward',
          userHandle: senderInformation.userHandle,
          userName: senderInformation.userName,
          amount: '50',
          message: 'Referral reward',
          dateAdded: new Date(),
          parentTransactionHash: transfer.transactionHash,
          status: TRANSACTION_STATUS.PENDING,
        });

        console.log(
          `[${eventId}] pending referral reward for ${senderWallet} about ${transfer.transactionHash} added to the database.`
        );
      }

      let txReward = undefined;

      try {
        txReward = await sendTokens(
          process.env.SOURCE_TG_ID,
          senderWallet,
          '50',
          await getPatchWalletAccessToken()
        );
      } catch (error) {
        console.error(
          `[${eventId}] Error processing PatchWallet referral reward for ${senderWallet}: ${error}`
        );
        processed = false;
        continue;
      }

      if (txReward.data.txHash) {
        const dateAdded = new Date();

        await db.collection(REWARDS_COLLECTION).updateOne(
          {
            eventId: eventId,
            reason: '2x_reward',
            parentTransactionHash: transfer.transactionHash,
          },
          {
            $set: {
              eventId: eventId,
              reason: '2x_reward',
              parentTransactionHash: transfer.transactionHash,
              userTelegramID: senderInformation.userTelegramID,
              responsePath: senderInformation.responsePath,
              walletAddress: senderWallet,
              userHandle: senderInformation.userHandle,
              userName: senderInformation.userName,
              amount: '50',
              message: 'Referral reward',
              transactionHash: txReward.data.txHash,
              dateAdded: dateAdded,
              status: TRANSACTION_STATUS.SUCCESS,
            },
          },
          { upsert: true }
        );

        console.log(
          `[${txReward.data.txHash}] referral reward added to Mongo DB with event ID ${eventId}.`
        );

        await axios.post(process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK, {
          newUserTgId: userTelegramID,
          newUserResponsePath: responsePath,
          newUserUserHandle: userHandle,
          newUserUserName: userName,
          newUserPatchwallet: patchwallet,
          userTelegramID: senderInformation.userTelegramID,
          responsePath: senderInformation.responsePath,
          walletAddress: senderWallet,
          reason: '2x_reward',
          userHandle: senderInformation.userHandle,
          userName: senderInformation.userName,
          amount: '50',
          message: 'Referral reward',
          transactionHash: txReward.data.txHash,
          dateAdded: dateAdded,
          parentTransactionHash: transfer.transactionHash,
        });

        console.log(
          `[${txReward.data.txHash}] referral reward sent to FlowXO with event ID ${eventId}.`
        );
      } else {
        // If a transaction fails, set the flag to false
        processed = false;
      }
    }

    return processed;
  } catch (error) {
    console.error(
      `[${eventId}] Error processing referral reward event: ${error}`
    );
  }

  return true;
}

/**
 * Handles the referral link reward for a user.
 *
 * @param {Object} db - The database object.
 * @param {string} eventId - The event ID.
 * @param {string} userTelegramID - The user's Telegram ID.
 * @param {string} referentUserTelegramID - The Telegram ID of the referent user.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
export async function handleLinkReward(
  db,
  eventId,
  userTelegramID,
  referentUserTelegramID
) {
  try {
    const referent = await db
      .collection(USERS_COLLECTION)
      .findOne({ userTelegramID: referentUserTelegramID });

    if (!referent) {
      // The referent user is not in the database
      console.log(
        `[${eventId}] ${referentUserTelegramID} referent user is not a user to process the link reward.`
      );
      return true;
    }

    const rewardWallet =
      referent?.patchwallet ??
      (await getPatchWalletAddressFromTgId(referentUserTelegramID));

    const reward = await db.collection(REWARDS_COLLECTION).findOne({
      eventId: eventId,
      userTelegramID: referentUserTelegramID,
      sponsoredUserTelegramID: userTelegramID,
      reason: 'referral_link',
    });

    // Check if the user has already received a signup reward
    if (
      reward?.status === TRANSACTION_STATUS.SUCCESS ||
      (await db.collection(REWARDS_COLLECTION).findOne({
        sponsoredUserTelegramID: userTelegramID,
        reason: 'referral_link',
        eventId: { $ne: eventId },
      }))
    ) {
      // The user has already received a referral link reward, stop processing
      console.log(
        `[${eventId}] ${userTelegramID} already sponsored another user for a referral link reward.`
      );
      return true;
    }

    if (!reward) {
      await db.collection(REWARDS_COLLECTION).insertOne({
        eventId: eventId,
        userTelegramID: referentUserTelegramID,
        responsePath: referent.responsePath,
        walletAddress: rewardWallet,
        reason: 'referral_link',
        userHandle: referent.userHandle,
        userName: referent.userName,
        amount: '10',
        message: 'Referral link',
        dateAdded: new Date(),
        sponsoredUserTelegramID: userTelegramID,
        status: TRANSACTION_STATUS.PENDING,
      });

      console.log(
        `[${eventId}] pending link reward for ${rewardWallet} about sponsoring ${userTelegramID} added to the database.`
      );
    }

    let txReward = undefined;

    try {
      txReward = await sendTokens(
        process.env.SOURCE_TG_ID,
        rewardWallet,
        '10',
        await getPatchWalletAccessToken()
      );
    } catch (error) {
      console.error(
        `[${eventId}] Error processing PatchWallet link reward for ${rewardWallet}: ${error}`
      );
      return false;
    }

    if (txReward.data.txHash) {
      const dateAdded = new Date();

      // Add the reward to the "rewards" collection
      await db.collection(REWARDS_COLLECTION).updateOne(
        {
          userTelegramID: referentUserTelegramID,
          sponsoredUserTelegramID: userTelegramID,
          reason: 'referral_link',
        },
        {
          $set: {
            userTelegramID: referentUserTelegramID,
            sponsoredUserTelegramID: userTelegramID,
            reason: 'referral_link',
            eventId: eventId,
            responsePath: referent.responsePath,
            walletAddress: rewardWallet,
            userHandle: referent.userHandle,
            userName: referent.userName,
            amount: '10',
            message: 'Referral link',
            transactionHash: txReward.data.txHash,
            dateAdded: dateAdded,
            status: TRANSACTION_STATUS.SUCCESS,
          },
        },
        { upsert: true }
      );

      console.log(
        `[${txReward.data.txHash}] link reward added to Mongo DB with event ID ${eventId}.`
      );

      await axios.post(process.env.FLOWXO_NEW_LINK_REWARD_WEBHOOK, {
        userTelegramID: referentUserTelegramID,
        responsePath: referent.responsePath,
        walletAddress: rewardWallet,
        reason: 'referral_link',
        userHandle: referent.userHandle,
        userName: referent.userName,
        amount: '10',
        message: 'Referral link',
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
        sponsoredUserTelegramID: userTelegramID,
      });

      console.log(
        `[${txReward.data.txHash}] link reward sent to FlowXO with event ID ${eventId}.`
      );

      return true;
    }

    return false;
  } catch (error) {
    console.error(`[${eventId}] Error processing link reward event: ${error}`);
  }
  return true;
}

/**
 * Handles the processing of a new reward for a user.
 *
 * @param {Object} params - The parameters containing user and event details.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
export async function handleNewReward(params) {
  const db = await Database.getInstance();

  // Check if the user already exists in the "users" collection
  const user = await db
    .collection(USERS_COLLECTION)
    .findOne({ userTelegramID: params.userTelegramID });

  if (user) {
    // The user already exists, stop processing
    console.log(
      `[${params.eventId}] ${user.userTelegramID} user already exists.`
    );
    return true;
  }

  let patchwallet = undefined;

  try {
    patchwallet = await getPatchWalletAddressFromTgId(params.userTelegramID);
  } catch (error) {
    return false;
  }

  const signupReward = await webhook_utils.handleSignUpReward(
    db,
    params.eventId,
    params.userTelegramID,
    params.responsePath,
    params.userHandle,
    params.userName,
    patchwallet
  );

  if (!signupReward) {
    return false;
  }

  const referralReward = await webhook_utils.handleReferralReward(
    db,
    params.eventId,
    params.userTelegramID,
    params.responsePath,
    params.userHandle,
    params.userName,
    patchwallet
  );

  if (!referralReward) {
    return false;
  }

  if (params.referentUserTelegramID) {
    const referralLinkReward = await webhook_utils.handleLinkReward(
      db,
      params.eventId,
      params.userTelegramID,
      params.referentUserTelegramID
    );

    if (!referralLinkReward) {
      return false;
    }
  }

  const dateAdded = new Date();
  // The user doesn't exist, add him to the "users" collection
  await db.collection(USERS_COLLECTION).insertOne({
    userTelegramID: params.userTelegramID,
    userHandle: params.userHandle,
    userName: params.userName,
    responsePath: params.responsePath,
    patchwallet: patchwallet,
    dateAdded: dateAdded,
  });

  console.log(
    `[${params.eventId}] ${params.userTelegramID} added to the user database.`
  );

  try {
    await addIdentitySegment({
      ...params,
      patchwallet: patchwallet,
      dateAdded: dateAdded,
    });

    console.log(
      `[${params.eventId}] ${params.userTelegramID} added to Segment.`
    );
  } catch (error) {
    console.error(
      `[${params.eventId}] Error processing new user in Segment: ${error}`
    );
  }

  return true;
}

/**
 * Handles a new transaction event.
 * @param {object} params - Transaction parameters.
 * @returns {Promise<boolean>} Returns a Promise that resolves to true if the transaction is successfully processed, false otherwise.
 */
export async function handleNewTransaction(params) {
  const db = await Database.getInstance();

  const tx_db = await db
    .collection(TRANSFERS_COLLECTION)
    .findOne({ eventId: params.eventId });

  if (!tx_db) {
    await db.collection(TRANSFERS_COLLECTION).insertOne({
      eventId: params.eventId,
      chainId: 'eip155:137',
      tokenSymbol: 'g1',
      tokenAddress: process.env.G1_POLYGON_ADDRESS,
      senderTgId: params.senderTgId,
      recipientTgId: params.recipientTgId,
      tokenAmount: params.amount.toString(),
      status: TRANSACTION_STATUS.PENDING,
      dateAdded: new Date(),
    });
    console.log(
      `[${params.eventId}] transaction from ${params.senderTgId} to ${
        params.recipientTgId
      } for ${params.amount.toString()} added to MongoDB as pending.`
    );
  }

  if (tx_db?.status === TRANSACTION_STATUS.SUCCESS) {
    console.log(
      `[${tx_db?.transactionHash}] with event ID ${tx_db?.eventId} is already a success.`
    );
    return true;
  }

  if (tx_db?.status === TRANSACTION_STATUS.FAILURE) {
    console.log(
      `[${tx_db?.transactionHash}] with event ID ${tx_db?.eventId} is already a failure.`
    );
    return true;
  }

  // Retrieve sender information from the "users" collection
  const senderInformation = await db
    .collection(USERS_COLLECTION)
    .findOne({ userTelegramID: params.senderTgId });

  if (!senderInformation) {
    console.error(
      `[${params.eventId}] Sender ${params.senderTgId} is not a user`
    );
    return true;
  }

  let recipientWallet = undefined;

  try {
    recipientWallet = await getPatchWalletAddressFromTgId(params.recipientTgId);
  } catch (error) {
    return false;
  }

  let tx = undefined;

  try {
    tx = await sendTokens(
      params.senderTgId,
      recipientWallet,
      params.amount.toString(),
      await getPatchWalletAccessToken()
    );
  } catch (error) {
    console.error(
      `[${params.eventId}] transaction from ${params.senderTgId} to ${
        params.recipientTgId
      } for ${params.amount.toString()} - Error processing PatchWallet token sending: ${error}`
    );
    let drop = false;
    if (!/^\d+$/.test(params.amount.toString())) {
      console.warn(`Potentially invalid amount: ${params.amount}, dropping`);
      drop = true;
    }
    if (error?.response?.status === 470) {
      drop = true;
    }
    if (drop) {
      await db.collection(TRANSFERS_COLLECTION).updateOne(
        { eventId: params.eventId },
        {
          $set: {
            chainId: 'eip155:137',
            tokenSymbol: 'g1',
            tokenAddress: process.env.G1_POLYGON_ADDRESS,
            senderTgId: params.senderTgId,
            senderWallet: senderInformation.patchwallet,
            senderName: senderInformation.userName,
            senderHandle: senderInformation.userHandle,
            recipientTgId: params.recipientTgId,
            recipientWallet: recipientWallet,
            tokenAmount: params.amount.toString(),
            dateAdded: new Date(),
            status: TRANSACTION_STATUS.FAILURE,
          },
        }
      );
      return true;
    }
    return false;
  }

  if (tx.data.txHash) {
    const dateAdded = new Date();

    // Add the transfer to the "transfers" collection
    await db.collection(TRANSFERS_COLLECTION).updateOne(
      { eventId: params.eventId },
      {
        $set: {
          eventId: params.eventId,
          TxId: tx.data.txHash.substring(1, 8),
          chainId: 'eip155:137',
          tokenSymbol: 'g1',
          tokenAddress: process.env.G1_POLYGON_ADDRESS,
          senderTgId: params.senderTgId,
          senderWallet: senderInformation.patchwallet,
          senderName: senderInformation.userName,
          senderHandle: senderInformation.userHandle,
          recipientTgId: params.recipientTgId,
          recipientWallet: recipientWallet,
          tokenAmount: params.amount.toString(),
          transactionHash: tx.data.txHash,
          dateAdded: dateAdded,
          status: TRANSACTION_STATUS.SUCCESS,
        },
      },
      { upsert: true }
    );

    const tx_db = await db
      .collection(TRANSFERS_COLLECTION)
      .findOne({ transactionHash: tx.data.txHash });

    console.log(
      `[${tx.data.txHash}] transaction with event ID ${params.eventId} from ${
        params.senderTgId
      } to ${
        params.recipientTgId
      } for ${params.amount.toString()} added to MongoDB with Object ID ${tx_db._id.toString()}.`
    );

    try {
      await addTrackSegment({
        userTelegramID: params.senderTgId,
        TxId: tx.data.txHash.substring(1, 8),
        senderTgId: params.senderTgId,
        senderWallet: senderInformation.patchwallet,
        senderName: senderInformation.userName,
        senderHandle: senderInformation.userHandle,
        recipientTgId: params.recipientTgId,
        recipientWallet: recipientWallet,
        tokenAmount: params.amount.toString(),
        transactionHash: tx.data.txHash,
        dateAdded: dateAdded,
        eventId: params.eventId,
      });

      console.log(
        `[${tx.data.txHash}] transaction with event ID ${params.eventId} from ${
          params.senderTgId
        } to ${
          params.recipientTgId
        } for ${params.amount.toString()} added to Segment.`
      );

      await axios.post(process.env.FLOWXO_NEW_TRANSACTION_WEBHOOK, {
        senderResponsePath: senderInformation.responsePath,
        TxId: tx.data.txHash.substring(1, 8),
        chainId: 'eip155:137',
        tokenSymbol: 'g1',
        tokenAddress: process.env.G1_POLYGON_ADDRESS,
        senderTgId: params.senderTgId,
        senderWallet: senderInformation.patchwallet,
        senderName: senderInformation.userName,
        senderHandle: senderInformation.userHandle,
        recipientTgId: params.recipientTgId,
        recipientWallet: recipientWallet,
        tokenAmount: params.amount.toString(),
        transactionHash: tx.data.txHash,
        dateAdded: dateAdded,
      });

      console.log(
        `[${tx.data.txHash}] transaction with event ID ${params.eventId} from ${
          params.senderTgId
        } to ${
          params.recipientTgId
        } for ${params.amount.toString()} sent to FlowXO.`
      );

      // send telegram message if params.message exists and sender has a telegram session
      if (params.message && senderInformation.telegramSession) {
        const messageSendingResult = await sendTelegramMessage(
          params.message,
          params.recipientTgId,
          senderInformation
        );
        // log error if message sending failed
        if (!messageSendingResult.success) {
          console.error(
            'Error sending telegram message:',
            messageSendingResult.message
          );
        }
      }
    } catch (error) {
      console.error(
        `[${params.eventId}] Error processing Segment or FlowXO webhook, or sending telegram message: ${error}`
      );
    }

    console.log(
      `[${tx.data.txHash}] transaction from ${params.senderTgId} to ${
        params.recipientTgId
      } for ${params.amount.toString()} with event ID ${
        params.eventId
      } finished.`
    );
    return true;
  }

  return false;
}

export const webhook_utils = {
  handleSignUpReward,
  handleLinkReward,
  handleReferralReward,
};
