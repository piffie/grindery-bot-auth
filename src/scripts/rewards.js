import { Database } from "../db/conn.js";
import { getPatchWalletAccessToken, sendTokens } from "../utils/patchwallet.js";
import { createObjectCsvWriter as createCsvWriter } from "csv-writer";

/**
 * Distributes a sign-up reward of 100 Grindery One Tokens to users without previous rewards.
 * Renewal of Patch Wallet access token is handled.
 */
async function distributeSignupRewards() {
  try {
    // Connect to the database
    const db = await Database.getInstance();
    const rewardsCollection = db.collection("rewards");

    // Obtain the initial PatchWallet access token
    let patchWalletAccessToken = await getPatchWalletAccessToken();

    // Track the time of the last token renewal
    let lastTokenRenewalTime = Date.now();

    const allUsers = await db.collection("users").find({}).toArray();
    let userCount = 0;

    // Load all rewards into memory for filtering
    const allRewards = await rewardsCollection
      .find({ amount: "100" })
      .toArray();

    for (const user of allUsers) {
      userCount++;

      // Check if there are no rewards for the current user
      if (
        !allRewards.some(
          (reward) => reward.userTelegramID === user.userTelegramID
        )
      ) {
        console.log(
          `[${userCount}/${allUsers.length}] User ${user.userTelegramID} has no reward with amount "100"`
        );

        // Check if it's time to renew the PatchWallet access token
        if (Date.now() - lastTokenRenewalTime >= 50 * 60 * 1000) {
          patchWalletAccessToken = await getPatchWalletAccessToken();
          lastTokenRenewalTime = Date.now();

          console.log("PatchWallet access token has been updated.");
        }

        try {
          // Send the sign-up reward to the user's wallet
          const txReward = await sendTokens(
            process.env.SOURCE_TG_ID, // Sender's Telegram ID
            user.patchwallet, // User's wallet address
            "100", // Amount of the reward
            patchWalletAccessToken // Access token for PatchWallet API
          );

          if (txReward.data.txHash) {
            // Log the issuance of the reward and insert the record into the rewards collection
            await rewardsCollection.insertOne({
              userTelegramID: user.userTelegramID,
              responsePath: user.responsePath,
              walletAddress: user.patchwallet,
              reason: "user_sign_up",
              userHandle: user.userHandle,
              userName: user.userName,
              amount: "100",
              message:
                "Thank you for signing up. Here are your first 100 Grindery One Tokens.",
              transactionHash: txReward.data.txHash,
              dateAdded: new Date(Date.now()),
            });

            console.log(
              `[${userCount}/${allUsers.length}] User ${user.userTelegramID} has been rewarded for signing up.`
            );
          }
        } catch (error) {
          // Handle errors and log them
          console.error("An error occurred during reward distribution:", error);
        }
      }
    }

    // Log completion message
    console.log("All sign-up rewards have been distributed.");
  } catch (error) {
    // Handle errors and log them
    console.error("An error occurred:", error);
  } finally {
    // Exit the script
    process.exit(0);
  }
}

export async function distributeReferralRewards() {
  try {
    // Connect to the database
    const db = await Database.getInstance();
    const rewardsCollection = db.collection("rewards");

    // Obtain the initial PatchWallet access token
    let patchWalletAccessToken = await getPatchWalletAccessToken();

    // Track the time of the last token renewal
    let lastTokenRenewalTime = Date.now();

    // Create an array to store rewarded users
    const rewardedUsers = [];

    // Export the users and rewards collections as arrays
    const allUsers = await db.collection("users").find({}).toArray();
    const allRewardsReferral = await rewardsCollection
      .find({ reason: "2x_reward" })
      .toArray();
    const allTransfers = await db.collection("transfers").find({}).toArray();

    let transferCount = 0;

    for (const transfer of allTransfers) {
      transferCount++;

      // Find the recipient user based on their Telegram ID
      const recipientUser = allUsers.find(
        (user) => user.userTelegramID === transfer.recipientTgId
      );

      // Check if the recipient user became a user before or after the transfer
      if (
        !recipientUser ||
        (recipientUser &&
          new Date(recipientUser.dateAdded) < new Date(transfer.dateAdded))
      ) {
        // The user was already a user before the transfer, so no action needed
        continue;
      }

      // Check if a reward for this transfer has already been issued
      if (
        allRewardsReferral.some(
          (reward) => reward.parentTransactionHash === transfer.TxId
        )
      ) {
        // A reward has already been issued for this transfer, so skip to the next one
        continue;
      }

      // Check if it's time to renew the PatchWallet access token
      if (Date.now() - lastTokenRenewalTime >= 50 * 60 * 1000) {
        patchWalletAccessToken = await getPatchWalletAccessToken();
        lastTokenRenewalTime = Date.now();
        console.log("PatchWallet access token has been updated.");
      }

      // Find information about the sender of the transaction
      const senderUser = allUsers.find(
        (user) => user.userTelegramID === transfer.senderTgId
      );

      if (senderUser) {
        try {
          console.log(
            `[${transferCount}/${allTransfers.length}] User ${senderUser.userTelegramID} has no referral reward for sending ${transfer.tokenAmount} tokens to ${transfer.recipientTgId}`
          );
          // Get the sender's wallet address based on their Telegram ID if not already existing
          const rewardWallet =
            senderUser.patchwallet ??
            (await getPatchWalletAddressFromTgId(transfer.senderTgId));

          // Determine the reward amount based on the date and transfer amount
          let rewardAmount =
            new Date(transfer.dateAdded) < new Date("2023-09-07T12:00:00Z") &&
            Number(transfer.tokenAmount) < 1000
              ? (Number(transfer.tokenAmount) * 2).toString()
              : "50";

          let rewardMessage =
            new Date(transfer.dateAdded) < new Date("2023-09-07T12:00:00Z") &&
            Number(transfer.tokenAmount) < 1000
              ? "2x Referral reward"
              : "Referral reward";

          // Send a reward of 50 tokens using the Patch Wallet API
          const txReward = await sendTokens(
            process.env.SOURCE_TG_ID,
            rewardWallet,
            rewardAmount,
            patchWalletAccessToken
          );

          // Log the issuance of the reward and insert the record into the rewards collection
          await rewardsCollection.insertOne({
            userTelegramID: senderUser.userTelegramID,
            responsePath: senderUser.responsePath,
            walletAddress: rewardWallet,
            reason: "2x_reward",
            userHandle: senderUser.userHandle,
            userName: senderUser.userName,
            amount: rewardAmount,
            message: rewardMessage,
            transactionHash: txReward.data.txHash,
            parentTransactionHash: transfer.transactionHash.substring(1, 8),
            dateAdded: new Date(Date.now()),
          });

          // Add the rewarded user to the array with reward amount
          rewardedUsers.push({
            userTelegramIDToReward: senderUser.userTelegramID,
            TxId: transfer.TxId,
            chainId: transfer.chainId,
            tokenSymbol: transfer.tokenSymbol,
            tokenAddress: transfer.tokenAddress,
            senderTgId: transfer.senderTgId,
            senderWallet: transfer.senderWallet,
            senderName: transfer.senderName,
            recipientTgId: transfer.recipientTgId,
            recipientWallet: transfer.recipientWallet,
            tokenAmount: transfer.tokenAmount,
            transactionHash: transfer.transactionHash,
            dateAdded: transfer.dateAdded,
            rewardAmount,
          });

          console.log(
            `[${transferCount}/${allTransfers.length}] User ${senderUser.userTelegramID} has been rewarded for sending tokens.`
          );
        } catch (error) {
          // Handle errors and log them
          console.error("An error occurred during reward distribution:", error);
        }
      }
    }

    // // Log completion message and separate rewarded users based on reward amount
    // const rewardedAt50 = rewardedUsers.filter(
    //   (user) => user.rewardAmount === "50"
    // );
    // const rewardedAtDouble = rewardedUsers.filter(
    //   (user) => Number(user.rewardAmount) !== 50
    // );

    // console.log(
    //   "All transfer rewards have been issued.",
    //   "Rewarded at 50 tokens:",
    //   rewardedAt50,
    //   "Rewarded at double tokens:",
    //   rewardedAtDouble.length
    // );

    console.log(`${rewardedUsers.length} users have been rewarded.`);
  } catch (error) {
    // Handle errors and log them
    console.error("An error occurred:", error);
  } finally {
    // Exit the script
    process.exit(0);
  }
}
