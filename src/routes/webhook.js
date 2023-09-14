import express from "express";
import { PubSub } from "@google-cloud/pubsub";
import { authenticateApiKey } from "../utils/auth.js";
import { Database } from "../db/conn.js";
import {
  getPatchWalletAccessToken,
  getPatchWalletAddressFromTgId,
  sendTokens,
} from "../utils/patchwallet.js";

/**
 * This is a generic and extendable implementation of a webhook endpoint and pub/sub messages queue.
 * It can be used to catch any webhook event and push it to the queue for processing.
 *
 * Add new events to the switch statement in the messageHandler function.
 * Events that are not defined in switch statement will be acknowledged and removed from the queue by default.
 */

// Init pub/sub client
const pubSubClient = new PubSub();

// Get topic and subscription names from env
const topicName = process.env.PUBSUB_TOPIC_NAME;
const subscriptionName = process.env.PUBSUB_SUBSCRIPTION_NAME;

const router = express.Router();

/**
 * POST /v1/webhook
 *
 * @summary Catch a webhook
 * @description Catches a webhook event and pushes it to the queue for processing.
 * @tags Webhook
 * @security BearerAuth
 * @param {object} request.body - The request body containing the event name and params
 * @return {object} 200 - Success response with message ID
 * @example request - 200 - Example request body
 * {
 *   "event": "event_name",
 *   "params": { "param1": "value1" }
 * }
 * @example response - 200 - Success response example
 * {
 *   "success": true,
 *   "messageId": "some-uuid"
 * }
 *
 * @example response - 500 - Error response example
 * {
 *   "success": false,
 *   "error": "error message"
 * }
 */
router.post("/", authenticateApiKey, async (req, res) => {
  try {
    const data = JSON.stringify(req.body);
    console.log(`Publishing message: ${data}`);
    const dataBuffer = Buffer.from(data);
    const messageId = await pubSubClient
      .topic(topicName)
      .publishMessage({ data: dataBuffer });
    if (messageId) {
      res.json({ success: true, messageId });
    } else {
      res.status(500).json({ success: false, error: "Event wasn't saved" });
    }
  } catch (error) {
    console.error(`Received error while publishing: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Definition of the event processing function
const processEvent = async (messageData) => {
  let processed = false;
  try {
    const db = await Database.getInstance();
    switch (messageData.event) {
      case "new_user": {
        // Check if the user already exists in the "users" collection
        const user = await db
          .collection("users-test")
          .findOne({ userTelegramID: messageData.params.userTelegramID });
        if (user) {
          // The user already exists, stop processing
          console.log(`[${user.userTelegramID}] user already exist.`);
          processed = true;
          break;
        }

        // The user doesn't exist, add him to the "users" collection
        await db.collection("users-test").insertOne({
          userTelegramID: messageData.params.userTelegramID,
          userHandle: messageData.params.userHandle,
          userName: messageData.params.userName,
          patchwallet: await getPatchWalletAddressFromTgId(
            messageData.params.userTelegramID
          ),
          dateAdded: new Date(Date.now()),
        });
        console.log(
          `[${messageData.params.userTelegramID}] user added to the database.`
        );
        processed = true;
        break;
      }

      case "new_signup_reward": {
        // Check if the user already exists in the "users" collection
        const user = await db
          .collection("users-test")
          .findOne({ userTelegramID: messageData.params.userTelegramID });

        if (user) {
          // The user already exists, stop processing
          console.log(`[${userExists.userTelegramID}] user already exist.`);
          processed = true;
          break;
        }

        // Check if the user has already received a signup reward
        const userSignupReward = await db.collection("rewards-test").findOne({
          userTelegramID: messageData.params.userTelegramID,
          reason: "user_sign_up",
        });

        if (userSignupReward) {
          // The user has already received a signup reward, stop processing
          console.log(
            `[${userSignupReward.userTelegramID}] user already received signup reward.`
          );
          processed = true;
          break;
        }

        try {
          const rewardWallet = await getPatchWalletAddressFromTgId(
            messageData.params.userTelegramID
          );

          const txReward = await sendTokens(
            process.env.SOURCE_TG_ID,
            rewardWallet,
            "100",
            await getPatchWalletAccessToken()
          );

          if (txReward.data.txHash) {
            // Add the reward to the "rewards" collection
            await db.collection("rewards-test").insertOne({
              userTelegramID: messageData.params.userTelegramID,
              responsePath: messageData.params.responsePath,
              walletAddress: rewardWallet,
              reason: "user_sign_up",
              userHandle: messageData.params.userHandle,
              userName: messageData.params.userName,
              amount: "100",
              message: "Sign up reward",
              transactionHash: txReward.data.txHash,
              dateAdded: new Date(Date.now()),
            });

            console.log(
              `[${messageData.params.userTelegramID}] signup reward added.`
            );

            // The user doesn't exist, add him to the "users" collection
            await db.collection("users-test").insertOne({
              userTelegramID: messageData.params.userTelegramID,
              userHandle: messageData.params.userHandle,
              userName: messageData.params.userName,
              patchwallet: rewardWallet,
              dateAdded: new Date(Date.now()),
            });

            console.log(
              `[${messageData.params.userTelegramID}] user added to the database.`
            );

            processed = true;
          }
        } catch (error) {
          console.error("Error during sign up reward transaction:", error);
        }
        break;
      }

      case "new_referral_reward": {
        // Check if the user already exists in the "users" collection
        const user = await db
          .collection("users-test")
          .findOne({ userTelegramID: messageData.params.userTelegramID });

        if (user) {
          // The user already exists, stop processing
          console.log(`[${user.userTelegramID}] user already exist.`);
          processed = true;
          break;
        }

        // Retrieve all transfers where this user is the recipient
        const referralTransfers = await db
          .collection("transfers-test")
          .find({ recipientTgId: messageData.params.userTelegramID })
          .toArray();

        // Initialize a flag to track the success of all transactions
        processed = true;

        // For each transfer, award a reward to the sender
        for (const transfer of referralTransfers) {
          try {
            // Retrieve sender information from the "users" collection
            const senderInformation = await db
              .collection("users-test")
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
              // Add the reward to the "rewards" collection
              await db.collection("rewards-test").insertOne({
                userTelegramID: senderInformation.userTelegramID,
                responsePath: senderInformation.responsePath,
                walletAddress: senderWallet,
                reason: "2x_reward",
                userHandle: senderInformation.userHandle,
                userName: senderInformation.userName,
                amount: "50",
                message: "Referral reward",
                transactionHash: txReward.data.txHash,
                dateAdded: new Date(Date.now()),
              });

              console.log(
                `[${senderInformation.userTelegramID}] referral reward added.`
              );
            } else {
              // If a transaction fails, set the flag to false
              processed = false;
            }
          } catch (error) {
            console.error("Error during sign up reward transaction:", error);
            // If a transaction fails, set the flag to false
            processed = false;
          }
        }

        if (processed) {
          // The user doesn't exist, add him to the "users" collection
          await db.collection("users-test").insertOne({
            userTelegramID: messageData.params.userTelegramID,
            userHandle: messageData.params.userHandle,
            userName: messageData.params.userName,
            patchwallet: await getPatchWalletAddressFromTgId(
              messageData.params.userTelegramID
            ),
            dateAdded: new Date(Date.now()),
          });

          console.log(
            `[${messageData.params.userTelegramID}] user added to the database.`
          );
        }
        break;
      }

      case "new_transaction": {
        try {
          // Retrieve sender information from the "users" collection
          const senderInformation = await db
            .collection("users-test")
            .findOne({ userTelegramID: messageData.params.senderTgId });

          const recipientWallet = await getPatchWalletAddressFromTgId(
            messageData.params.recipientTgId
          );

          const tx = await sendTokens(
            messageData.params.senderTgId,
            recipientWallet,
            messageData.params.amount.toString(),
            await getPatchWalletAccessToken()
          );

          if (tx.data.txHash) {
            // Add the reward to the "rewards" collection
            await db.collection("transfers-test").insertOne({
              TxId: tx.data.txHash.substring(1, 8),
              chainId: "eip155:137",
              tokenSymbol: "g1",
              tokenAddress: process.env.G1_POLYGON_ADDRESS,
              senderTgId: messageData.params.senderTgId,
              senderWallet: senderInformation.patchwallet,
              senderName: senderInformation.userName,
              recipientTgId: messageData.params.recipientTgId,
              recipientWallet: recipientWallet,
              tokenAmount: messageData.params.amount.toString(),
              transactionHash: tx.data.txHash,
              dateAdded: new Date(Date.now()),
            });

            console.log(
              `[${tx.data.txHash}] transaction from ${
                messageData.params.senderTgId
              } to ${
                messageData.params.recipientTgId
              } for ${messageData.params.amount.toString()} added.`
            );
            processed = true;
          }
        } catch (error) {
          console.error("Error during sign up reward transaction:", error);
        }
        break;
      }

      default: {
        processed = true;
        break;
      }
    }
  } catch (error) {
    console.error("Error processing event:", error);
  }
  return processed;
};

// Subscribe to messages from Pub/Sub
const listenForMessages = () => {
  // get subscription
  const subscription = pubSubClient.subscription(subscriptionName);

  // Process and acknowledge pub/sub message
  const messageHandler = async (message) => {
    const messageDataString = message.data.toString();
    const messageData = JSON.parse(messageDataString);
    console.log("Received message:", JSON.stringify(messageData, null, 2));

    try {
      // let processed = false; // Has event been processed. If not, message will be requeued.

      // // Handle events below. If event is not specified, message will be acknowledged and removed from the queue.

      // // Example events:
      // switch (messageData.event) {
      //   // User initiated new transaction
      //   case "new_transaction":
      //     //processed = await handleNewTransaction(messageData.params);
      //     break;
      //   // New user started the bot
      //   case "new_user":
      //     //processed = await handleNewUser(messageData.params);
      //     break;
      //   // New reward has been issued to user
      //   case "new_reward":
      //     //processed = await handleNewReward(messageData.params);
      //     break;
      //   default:
      //     processed = true;
      //     break;
      // }

      // if (!processed) {
      //   throw new Error("Error processing event");
      // }

      if (!(await processEvent(messageData))) {
        throw new Error("Error processing event");
      }

      console.log(
        "Acknowledged message:",
        JSON.stringify(messageData, null, 2)
      );
      message.ack(); // "Ack" (acknowledge receipt of) the message
    } catch (error) {
      console.error("messageHandler error:", error);
      message.nack(); // "Nack" (don't acknowledge receipt of) the message
    }
  };

  subscription.on("message", messageHandler);
};

// Start listening for pub/sub messages
listenForMessages();

export default router;
