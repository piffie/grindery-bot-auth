import { Database } from "../db/conn.js";
import { getPatchWalletAccessToken, sendTokens } from "../utils/patchwallet.js";

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

async function distributeReferralRewards() {
  try {
    // Connect to the database
    const db = await Database.getInstance();
    const usersCollection = db.collection("users");
    const rewardsCollection = db.collection("rewards");

    // Obtain the initial PatchWallet access token
    let patchWalletAccessToken = await getPatchWalletAccessToken();

    // Track the time of the last token renewal
    let lastTokenRenewalTime = Date.now();

    // Create an array to store rewarded users
    const rewardedUsers = [];

    // Iterate through transfers
    for (const transfer of await db
      .collection("transfers")
      .find({})
      .toArray()) {
      // Find the recipient user based on their Telegram ID
      const recipientUser = await usersCollection.findOne({
        userTelegramID: transfer.recipientTgId,
      });

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
        await rewardsCollection.findOne({
          parentTransactionHash: transfer.TxId,
        })
      ) {
        // A reward has already been issued for this transfer, so skip to the next one
        continue;
      }

      // Check if it's time to renew the PatchWallet access token
      if (Date.now() - lastTokenRenewalTime >= 50 * 60 * 1000) {
        patchWalletAccessToken = await getPatchWalletAccessToken();
        lastTokenRenewalTime = Date.now();
      }

      // Find information about the sender of the transaction
      const senderUser = await usersCollection.findOne({
        userTelegramID: transfer.senderTgId,
      });

      if (senderUser) {
        // Get the sender's wallet address based on their Telegram ID if not already existing
        const rewardWallet =
          senderUser.patchwallet ??
          (await getPatchWalletAddressFromTgId(transfer.senderTgId));

        // Send a reward of 50 tokens using the Patch Wallet API
        const txReward = await sendTokens(
          process.env.SOURCE_TG_ID,
          rewardWallet,
          50, // Amount of the reward
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
          amount: "50",
          message:
            "Thank you for sending tokens. Here is your 50 token reward in Grindery One Tokens.",
          transactionHash: txReward.data.txHash,
        });

        // Add the rewarded user to the array
        rewardedUsers.push(senderUser.userTelegramID);

        console.log(
          `User ${senderUser.userTelegramID} has been rewarded for sending tokens.`
        );
      }
    }

    // Log completion message
    console.log("All transfer rewards have been issued.");

    // Return the array of rewarded users for further verification
    return rewardedUsers;
  } catch (error) {
    // Handle errors and log them
    console.error("An error occurred:", error);
    return []; // Return an empty array in case of an error
  } finally {
    // Exit the script
    process.exit(0);
  }
}

// // Execute the function to distribute rewards to eligible users and get the rewarded users
// const rewardedUsers = distributeReferralRewards();
