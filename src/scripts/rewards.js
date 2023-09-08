import {Database} from "../db/conn.js";
import fs from "fs";
import csv from "csv-parser";

// Usage: startImport(filePath)
// Description: This function imports rewards data from a CSV file into the database.
// - filePath: The path to the CSV file containing rewards data.
// Example: startImport("/path/to/your/file.csv");
const startImport = (fileName) => {
  const rewards = [];
  fs.createReadStream(fileName)
    .pipe(csv())
    .on("data", (row) => {
      rewards.push(row);
    })
    .on("end", async () => {
      await saveRewards(rewards);
      console.log("\n All data has been read \n");
      process.exit(0);
    })
    .on("error", (error) => {
      console.log("\n Errors during CSV parsing \n");
      process.exit(1);
    });
};

async function saveRewards(rewards) {
  const db = await Database.getInstance();
  const collection = db.collection("rewards");

  // Step 1: Create a set of existing rewards hashes
  const existingHashes = await collection.distinct("transactionHash");

  // Step 2: Filter the rewards to find the missing ones
  const missingRewards = rewards.filter(
    (reward) => !existingHashes.includes(reward.evt_tx_hash)
  );

  console.log("Number of rewards in csv file: ", rewards.length);
  console.log(
    "Number of rewards in `rewards` collection: ",
    existingHashes.length
  );
  console.log(
    "Number of missing rewards in `rewards` collection: ",
    missingRewards.length
  );

  // Step 3: Format missing rewards
  const formattedMissingRewards = missingRewards.map((rewards) => {
    const amount = String(Number(rewards.value) / 1e18);
    return {
      userTelegramID: "",
      responsePath: "",
      walletAddress: rewards.to,
      reason: "hunt",
      userHandle: "",
      userName: "",
      amount: amount,
      message: `Here are your ${amount} Grindery One Token for supporting us on Product Hunt!`,
      transactionHash: rewards.evt_tx_hash,
      dateAdded: new Date(rewards.evt_block_time),
    };
  });

  // Step 4: Batch insert the missing rewards into the collection
  if (formattedMissingRewards.length > 0) {
    const collectionTest = db.collection("rewards-test");
    const batchSize = 10000;
    for (let i = 0; i < formattedMissingRewards.length; i += batchSize) {
      console.log("loop number: ", i);
      const batch = formattedMissingRewards.slice(i, i + batchSize);
      await collectionTest.insertMany(batch);
    }
  }
}

startImport("dune.csv");
