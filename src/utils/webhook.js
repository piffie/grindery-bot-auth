import { Database } from "../db/conn.js";
import {
  REWARDS_TEST_COLLECTION,
  TRANSFERS_TEST_COLLECTION,
  USERS_TEST_COLLECTION,
} from "./constants.js";
import {
  getPatchWalletAccessToken,
  getPatchWalletAddressFromTgId,
  sendTokens,
} from "./patchwallet.js";
import { addIdentitySegment, addTrackSegment } from "./segment.js";
import axios from "axios";
import "dotenv/config";

/**
 * Handles a new user registration event.
 * @param {object} params - User registration parameters.
 * @returns {Promise<boolean>} Returns a Promise that resolves to true if the user is successfully registered, false otherwise.
 */
export const handleNewUser = async (params) => {
  try {
    const db = await Database.getInstance();

    // Check if the user already exists in the "users" collection
    const user = await db
      .collection(USERS_TEST_COLLECTION)
      .findOne({ userTelegramID: params.userTelegramID });
    if (user) {
      // The user already exists, stop processing
      console.log(`[${user.userTelegramID}] user already exist.`);
      return true;
    }

    const dateAdded = new Date();
    const patchwallet = await getPatchWalletAddressFromTgId(
      params.userTelegramID
    );

    // The user doesn't exist, add him to the "users" collection
    await db.collection(USERS_TEST_COLLECTION).insertOne({
      userTelegramID: params.userTelegramID,
      responsePath: params.responsePath,
      userHandle: params.userHandle,
      userName: params.userName,
      patchwallet: patchwallet,
      dateAdded: dateAdded,
    });

    await addIdentitySegment({
      ...params,
      patchwallet: patchwallet,
      dateAdded: dateAdded,
    });

    await axios.post(process.env.FLOWXO_NEW_USER_WEBHOOK, {
      userTelegramID: params.userTelegramID,
      responsePath: params.responsePath,
      userHandle: params.userHandle,
      userName: params.userName,
      patchwallet: patchwallet,
      dateAdded: dateAdded,
    });

    console.log(`[${params.userTelegramID}] user added to the database.`);
    return true;
  } catch (error) {
    console.error("Error processing new user event:", error);
  }
  return false;
};

export const handleSignUpReward = async (
  db,
  userTelegramID,
  responsePath,
  userHandle,
  userName,
  rewardWallet
) => {
  try {
    // Check if the user has already received a signup reward
    if (
      await db.collection(REWARDS_TEST_COLLECTION).findOne({
        userTelegramID: userTelegramID,
        reason: "user_sign_up",
      })
    ) {
      // The user has already received a signup reward, stop processing
      console.log(`[${userTelegramID}] user already received signup reward.`);
      return true;
    }

    const txReward = await sendTokens(
      process.env.SOURCE_TG_ID,
      rewardWallet,
      "100",
      await getPatchWalletAccessToken()
    );

    if (txReward.data.txHash) {
      const dateAdded = new Date();

      // Add the reward to the "rewards" collection
      await db.collection(REWARDS_TEST_COLLECTION).insertOne({
        userTelegramID: userTelegramID,
        responsePath: responsePath,
        walletAddress: rewardWallet,
        reason: "user_sign_up",
        userHandle: userHandle,
        userName: userName,
        amount: "100",
        message: "Sign up reward",
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
      });

      console.log(`[${userTelegramID}] signup reward added.`);

      await addIdentitySegment({
        responsePath: responsePath,
        userTelegramID: userTelegramID,
        userHandle: userHandle,
        userName: userName,
        patchwallet: rewardWallet,
        dateAdded: dateAdded,
      });

      await axios.post(process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK, {
        userTelegramID: userTelegramID,
        responsePath: responsePath,
        walletAddress: rewardWallet,
        reason: "user_sign_up",
        userHandle: userHandle,
        userName: userName,
        amount: "100",
        message: "Sign up reward",
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
      });

      console.log(`[${userTelegramID}] user added to the database.`);
      return true;
    }
  } catch (error) {
    console.error("Error processing signup reward event:", error);
  }
  return false;
};

export const handleReferralReward = async (
  db,
  userTelegramID,
  responsePath,
  userHandle,
  userName,
  patchwallet
) => {
  try {
    // Initialize a flag to track the success of all transactions
    let processed = true;

    // Retrieve all transfers where this user is the recipient
    // For each transfer, award a reward to the sender
    for (const transfer of await db
      .collection(TRANSFERS_TEST_COLLECTION)
      .find({
        senderTgId: { $ne: userTelegramID },
        recipientTgId: userTelegramID,
      })
      .toArray()) {
      try {
        if (
          await db.collection(REWARDS_TEST_COLLECTION).findOne({
            reason: "2x_reward",
            parentTransactionHash: transfer.transactionHash,
          })
        ) {
          continue;
        }

        // Retrieve sender information from the "users" collection
        const senderInformation = await db
          .collection(USERS_TEST_COLLECTION)
          .findOne({ userTelegramID: transfer.senderTgId });

        const senderWallet =
          senderInformation.patchwallet ??
          (await getPatchWalletAddressFromTgId(
            senderInformation.userTelegramID
          ));

        const txReward = await sendTokens(
          process.env.SOURCE_TG_ID,
          senderWallet,
          "50",
          await getPatchWalletAccessToken()
        );

        if (txReward.data.txHash) {
          const dateAdded = new Date();

          // Add the reward to the "rewards" collection
          await db.collection(REWARDS_TEST_COLLECTION).insertOne({
            userTelegramID: senderInformation.userTelegramID,
            responsePath: senderInformation.responsePath,
            walletAddress: senderWallet,
            reason: "2x_reward",
            userHandle: senderInformation.userHandle,
            userName: senderInformation.userName,
            amount: "50",
            message: "Referral reward",
            transactionHash: txReward.data.txHash,
            dateAdded: dateAdded,
            parentTransactionHash: transfer.transactionHash,
          });

          await axios.post(process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK, {
            newUserTgId: userTelegramID,
            newUserResponsePath: responsePath,
            newUserUserHandle: userHandle,
            newUserUserName: userName,
            newUserPatchwallet: patchwallet,
            userTelegramID: senderInformation.userTelegramID,
            responsePath: senderInformation.responsePath,
            walletAddress: senderWallet,
            reason: "2x_reward",
            userHandle: senderInformation.userHandle,
            userName: senderInformation.userName,
            amount: "50",
            message: "Referral reward",
            transactionHash: txReward.data.txHash,
            dateAdded: dateAdded,
          });

          console.log(
            `[${senderInformation.userTelegramID}] referral reward added.`
          );
        } else {
          // If a transaction fails, set the flag to false
          processed = false;
        }
      } catch (error) {
        console.error("Error during referral reward transaction:", error);
        // If a transaction fails, set the flag to false
        processed = false;
      }
    }
    return processed;
  } catch (error) {
    console.error("Error processing referral reward event:", error);
  }
  return false;
};

export const handleLinkReward = async (
  db,
  userTelegramID,
  referentUserTelegramID
) => {
  try {
    const referent = await db
      .collection(USERS_TEST_COLLECTION)
      .findOne({ userTelegramID: referentUserTelegramID });

    if (!referent) {
      // The referent user is not in the database
      console.log(`[${referentUserTelegramID}] referent user is not a user.`);
      return true;
    }

    const rewardWallet =
      referent.patchwallet ??
      (await getPatchWalletAddressFromTgId(referentUserTelegramID));

    const txReward = await sendTokens(
      process.env.SOURCE_TG_ID,
      rewardWallet,
      "10",
      await getPatchWalletAccessToken()
    );

    if (txReward.data.txHash) {
      const dateAdded = new Date();

      // Add the reward to the "rewards" collection
      await db.collection(REWARDS_TEST_COLLECTION).insertOne({
        userTelegramID: referentUserTelegramID,
        responsePath: referent.responsePath,
        walletAddress: rewardWallet,
        reason: "referral_link",
        userHandle: referent.userHandle,
        userName: referent.userName,
        amount: "10",
        message: "Referral link",
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
      });

      console.log(`[${referentUserTelegramID}] referral link reward added.`);

      await axios.post(process.env.FLOWXO_NEW_LINK_REWARD_WEBHOOK, {
        userTelegramID: userTelegramID,
        referentUserTelegramID: referentUserTelegramID,
        referentResponsePath: referent.responsePath,
        referentWalletAddress: rewardWallet,
        reason: "referral_link",
        referentUserHandle: referent.userHandle,
        referentUserName: referent.userName,
        amount: "10",
        message: "Referral link",
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
      });

      return true;
    }
  } catch (error) {
    console.error("Error processing referral link reward event:", error);
  }
  return false;
};

/**
 * Handles a new sign-up reward event.
 * @param {object} params - Sign-up reward parameters.
 * @returns {Promise<boolean>} Returns a Promise that resolves to true if the reward is successfully processed, false otherwise.
 */
export const handleNewReward = async (params) => {
  try {
    const db = await Database.getInstance();

    // Check if the user already exists in the "users" collection
    const user = await db
      .collection(USERS_TEST_COLLECTION)
      .findOne({ userTelegramID: params.userTelegramID });

    if (user) {
      // The user already exists, stop processing
      console.log(`[${user.userTelegramID}] user already exist.`);
      return true;
    }

    const patchwallet = await getPatchWalletAddressFromTgId(
      params.userTelegramID
    );

    const signupReward = await handleSignUpReward(
      db,
      params.userTelegramID,
      params.responsePath,
      params.userHandle,
      params.userName,
      patchwallet
    );

    if (!signupReward) {
      return false;
    }

    const referralReward = await handleReferralReward(
      db,
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
      const referralLinkReward = await handleLinkReward(
        db,
        params.userTelegramID,
        params.referentUserTelegramID
      );

      if (!referralLinkReward) {
        return false;
      }
    }

    const dateAdded = new Date();
    // The user doesn't exist, add him to the "users" collection
    await db.collection(USERS_TEST_COLLECTION).insertOne({
      userTelegramID: params.userTelegramID,
      userHandle: params.userHandle,
      userName: params.userName,
      patchwallet: patchwallet,
      dateAdded: dateAdded,
    });

    await addIdentitySegment({
      ...params,
      patchwallet: patchwallet,
      dateAdded: dateAdded,
    });
  } catch (error) {
    console.error("Error processing reward event:", error);
  }
  return false;
};

/**
 * Handles a new transaction event.
 * @param {object} params - Transaction parameters.
 * @returns {Promise<boolean>} Returns a Promise that resolves to true if the transaction is successfully processed, false otherwise.
 */
export const handleNewTransaction = async (params) => {
  try {
    const db = await Database.getInstance();

    // Retrieve sender information from the "users" collection
    const senderInformation = await db
      .collection(USERS_TEST_COLLECTION)
      .findOne({ userTelegramID: params.senderTgId });

    const recipientWallet = await getPatchWalletAddressFromTgId(
      params.recipientTgId
    );

    const tx = await sendTokens(
      params.senderTgId,
      recipientWallet,
      params.amount.toString(),
      await getPatchWalletAccessToken()
    );

    if (tx.data.txHash) {
      const dateAdded = new Date();

      // Add the reward to the "rewards" collection
      await db.collection(TRANSFERS_TEST_COLLECTION).insertOne({
        TxId: tx.data.txHash.substring(1, 8),
        chainId: "eip155:137",
        tokenSymbol: "g1",
        tokenAddress: process.env.G1_POLYGON_ADDRESS,
        senderTgId: params.senderTgId,
        senderWallet: senderInformation.patchwallet,
        senderName: senderInformation.userName,
        recipientTgId: params.recipientTgId,
        recipientWallet: recipientWallet,
        tokenAmount: params.amount.toString(),
        transactionHash: tx.data.txHash,
        dateAdded: dateAdded,
      });

      await addTrackSegment({
        userTelegramID: params.senderTgId,
        TxId: tx.data.txHash.substring(1, 8),
        senderTgId: params.senderTgId,
        senderWallet: senderInformation.patchwallet,
        senderName: senderInformation.userName,
        recipientTgId: params.recipientTgId,
        recipientWallet: recipientWallet,
        tokenAmount: params.amount.toString(),
        transactionHash: tx.data.txHash,
        dateAdded: dateAdded,
      });

      await axios.post(process.env.FLOWXO_NEW_TRANSACTION_WEBHOOK, {
        senderResponsePath: senderInformation.responsePath,
        TxId: tx.data.txHash.substring(1, 8),
        chainId: "eip155:137",
        tokenSymbol: "g1",
        tokenAddress: process.env.G1_POLYGON_ADDRESS,
        senderTgId: params.senderTgId,
        senderWallet: senderInformation.patchwallet,
        senderName: senderInformation.userName,
        recipientTgId: params.recipientTgId,
        recipientWallet: recipientWallet,
        tokenAmount: params.amount.toString(),
        transactionHash: tx.data.txHash,
        dateAdded: dateAdded,
      });

      console.log(
        `[${tx.data.txHash}] transaction from ${params.senderTgId} to ${
          params.recipientTgId
        } for ${params.amount.toString()} added.`
      );
      return true;
    }
  } catch (error) {
    console.error("Error processing transaction event:", error);
  }
  return false;
};
