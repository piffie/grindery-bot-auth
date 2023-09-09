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

    // Aggregate users and rewards to find users without previous rewards
    const usersWithoutRewards = await db
      .collection("users")
      .aggregate([
        {
          $lookup: {
            from: "rewards",
            localField: "userTelegramID",
            foreignField: "userTelegramID",
            as: "rewards",
          },
        },
        {
          $match: {
            "rewards.amount": { $ne: "100" },
          },
        },
      ])
      .toArray();

    // Log users without rewards for reference
    console.log("Users without rewards:", usersWithoutRewards);

    // Obtain the initial PatchWallet access token
    let patchWalletAccessToken = await getPatchWalletAccessToken();

    // Track the time of the last token renewal
    let lastTokenRenewalTime = Date.now();

    // Iterate through users without rewards and distribute sign-up rewards
    for (const user of usersWithoutRewards) {
      // Check if it's time to renew the PatchWallet access token
      if (Date.now() - lastTokenRenewalTime >= 50 * 60 * 1000) {
        patchWalletAccessToken = await getPatchWalletAccessToken();
        lastTokenRenewalTime = Date.now();
      }

      // Send the sign-up reward to the user's wallet
      const txReward = await sendTokens(
        process.env.SOURCE_TG_ID, // Sender's Telegram ID
        user.patchwallet, // User's wallet address
        100, // Amount of the reward
        patchWalletAccessToken // Access token for PatchWallet API
      );

      // Log the issuance of the reward and insert the record into the rewards collection
      await rewardsCollection.insertOne({
        userTelegramID: user.userTelegramID,
        responsePath: user.responsePath,
        walletAddress: user.patchwallet,
        reason: "user_sign_up",
        userHandle: sender.userHandle,
        userName: sender.userName,
        amount: "100",
        message:
          "Thank you for signing up. Here are your first 100 Grindery One Tokens.",
        transactionHash: txReward.data.txHash,
      });

      console.log(
        `User ${user.userTelegramID} has been rewarded for signing up.`
      );
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

// // Execute the function to distribute sign-up rewards to eligible users
// distributeSignupRewards();
