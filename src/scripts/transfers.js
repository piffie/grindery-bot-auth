import { Database } from '../db/conn.js';
import fs from 'fs';
import csv from 'csv-parser';
import web3 from 'web3';
import {
  REWARDS_COLLECTION,
  TRANSFERS_COLLECTION,
} from '../utils/constants.js';

// Example usage of the functions:
// removeDuplicateTransfers();
async function removeDuplicateTransfers() {
  try {
    const db = await Database.getInstance();
    const collectionTransfers = db.collection('transfers');

    // Aggregation pipeline to identify duplicates and keep the first instance
    const aggregationPipeline = [
      {
        $group: {
          _id: '$transactionHash',
          firstInstance: { $first: '$_id' },
        },
      },
    ];

    // Find the first instance of each duplicate transactionHash
    const firstInstances = await collectionTransfers
      .aggregate(aggregationPipeline)
      .toArray();

    // Create an array of _id values to keep (first instances)
    const idsToKeep = firstInstances.map((instance) => instance.firstInstance);

    // Delete all documents that are not in the idsToKeep array
    const deleteResult = await collectionTransfers.deleteMany({
      _id: { $nin: idsToKeep },
    });

    console.log(`Deleted ${deleteResult.deletedCount} duplicate transfers.`);
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  } finally {
    process.exit(0);
  }
}

// Usage: transfersCleanup(filePath)
// Description: This function processes transfers data from a CSV file and deletes incomplete transfers from the database.
// - filePath: The path to the CSV file containing transfers data.
// Example: transfersCleanup("dune.csv");
async function transfersCleanup(fileName) {
  const db = await Database.getInstance();
  const collection = db.collection('transfers');
  const hashesInCsv = [];
  let latestTimestamp = null;

  fs.createReadStream(fileName)
    .pipe(csv())
    .on('data', (row) => {
      hashesInCsv.push(row.hash);
      const rowTimestamp = new Date(row.block_time);
      if (latestTimestamp === null || rowTimestamp > latestTimestamp) {
        latestTimestamp = rowTimestamp;
      }
    })
    .on('end', async () => {
      if (latestTimestamp === null) {
        console.log('No timestamp found in CSV.');
        process.exit(1);
      }

      const transfersInDb = await collection
        .find({
          dateAdded: { $lte: latestTimestamp },
        })
        .toArray();

      const hashesToDelete = transfersInDb
        .filter((transfer) => !hashesInCsv.includes(transfer.transactionHash))
        .map((transfer) => transfer.transactionHash);

      if (hashesToDelete.length === 0) {
        console.log('All transfers in database match the transfers in CSV.');
      } else {
        const deleteResult = await collection.deleteMany({
          transactionHash: { $in: hashesToDelete },
        });
        console.log(
          `${deleteResult.deletedCount} incomplete transfers deleted.`
        );
      }

      console.log('\n All tasks completed \n');
      process.exit(0);
    })
    .on('error', (error) => {
      console.log('\n Errors during CSV parsing \n');
      process.exit(1);
    });
}

async function updateTransfersInformations() {
  try {
    // Connect to the database
    const db = await Database.getInstance();

    // Get the transfers collection
    const transfersCollection = db.collection('transfers');

    // Get the users collection
    const usersCollection = db.collection('users');

    // Find all transfers in the collection
    const allTransfers = await transfersCollection.find({}).toArray();
    const totalTransfers = allTransfers.length;

    const allUsers = await usersCollection.find({}).toArray();

    // Create an array to store bulk write operations
    const bulkWriteOperations = [];

    let index = 0;

    for (const transfer of allTransfers) {
      index++;

      // Update senderWallet and recipientWallet to checksum addresses
      transfer.senderWallet = web3.utils.toChecksumAddress(
        transfer.senderWallet
      );
      transfer.recipientWallet = web3.utils.toChecksumAddress(
        transfer.recipientWallet
      );

      // Find sender user based on senderWallet
      const senderUser = allUsers.find(
        (user) => user.patchwallet === transfer.senderWallet
      );

      // Find recipient user based on recipientWallet
      const recipientUser = allUsers.find(
        (user) => user.patchwallet === transfer.recipientWallet
      );

      if (senderUser) {
        // Fill senderTgId and senderName
        transfer.senderTgId = senderUser.userTelegramID;
        transfer.senderName = senderUser.userName;
      }

      if (recipientUser) {
        // Fill recipientTgId
        transfer.recipientTgId = recipientUser.userTelegramID;
      }

      // Create an update operation and add it to the bulk write array
      const updateOperation = {
        updateOne: {
          filter: { _id: transfer._id },
          update: { $set: transfer },
        },
      };

      bulkWriteOperations.push(updateOperation);

      console.log(
        `Updated transfer ${index}/${totalTransfers}: ${transfer._id}`
      );
    }

    // Perform bulk write operations
    await transfersCollection.bulkWrite(bulkWriteOperations);

    console.log('All transfers have been updated.');
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    process.exit(0);
  }
}

async function removeRewardFromTransfers() {
  try {
    const db = await Database.getInstance();
    const collectionTransfers = db.collection(TRANSFERS_COLLECTION);
    const collectionRewards = db.collection(REWARDS_COLLECTION);

    // Get all transaction hashes from the rewards collection
    const rewardHashes = await collectionRewards.distinct('transactionHash');

    const allTransfers = await collectionTransfers.find({}).toArray();
    const totalTransfers = allTransfers.length;
    let deletedTransfers = [];

    let index = 0;

    for (const transfer of allTransfers) {
      index++;

      // Check if the transactionHash exists in the rewardHashes array
      // and sender is SOURCE_TG_ID
      if (
        rewardHashes.includes(transfer.transactionHash) &&
        transfer.senderTgId == process.env.SOURCE_TG_ID
      ) {
        // Delete the transfer
        await collectionTransfers.deleteOne({
          _id: transfer._id,
        });
        deletedTransfers.push(transfer);

        console.log(
          `Deleted transfer ${index}/${totalTransfers}: ${transfer._id}`
        );
      }
    }

    console.log(`Total deleted transfers: ${deletedTransfers.length}`);
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  } finally {
    process.exit(0);
  }
}

/**
 * Usage: checkMissingTransfers(filePath)
 * Description: This function processes transfer data from a CSV file and identifies the transfers in the database that aren't present in the CSV, excluding a specified address.
 * - filePath: The path to the CSV file containing transfer data.
 * Example: checkMissingTransfers("transfersData.csv");
 */
async function checkMissingTransfers(fileName) {
  const db = await Database.getInstance();
  const collection = db.collection('transfers');
  const hashesInCsv = new Set();
  const excludeAddress = process.env.SOURCE_WALLET_ADDRESS;

  fs.createReadStream(fileName)
    .pipe(csv())
    .on('data', (row) => {
      if (web3.utils.toChecksumAddress(row.from) !== excludeAddress) {
        hashesInCsv.add(row.hash);
      }
    })
    .on('end', async () => {
      const transfersHashesInDb = await collection.distinct('transactionHash');

      const hashesNotInDb = [...hashesInCsv].filter(
        (hash) => !transfersHashesInDb.includes(hash)
      );

      if (hashesNotInDb.length === 0) {
        console.log(
          'All transfers in CSV are present in the MongoDB collection.'
        );
      } else {
        console.log(
          "The following transaction hashes from the CSV aren't present in MongoDB transfers collection:"
        );
        console.log(hashesNotInDb.join('\n'));
        console.log(`Total Missing: ${hashesNotInDb.length}`);
      }
      process.exit(0);
    })
    .on('error', (error) => {
      console.error('Error during CSV parsing:', error);
      process.exit(1);
    });
}

async function getUsersFollowUps() {
  try {
    const db = await Database.getInstance();
    const transfersCollection = db.collection('transfers');
    const usersCollection = db.collection('users');

    const allTransfers = await transfersCollection.find({}).toArray();
    const allUsers = await usersCollection.find({}).toArray();

    const senderTgIdToFollowup = {};

    const recipientTgIds = new Set(allUsers.map((user) => user.userTelegramID));

    for (const transfer of allTransfers) {
      const senderTgId = transfer.senderTgId;

      if (!senderTgId) {
        // Skip transfers without senderTgId
        continue;
      }

      // Check if the recipientTgId is not in the set of recipientTgIds
      if (!recipientTgIds.has(transfer.recipientTgId)) {
        // If the recipientTgId is not found in the users collection, increment the followup count for the senderTgId
        if (!senderTgIdToFollowup[senderTgId]) {
          senderTgIdToFollowup[senderTgId] = {
            count: 1,
            userInfo: allUsers.find(
              (user) => user.userTelegramID === senderTgId
            ),
          };
        } else {
          senderTgIdToFollowup[senderTgId].count++;
        }
      }
    }

    // Create an array with senderTgId, followup count, and user info
    const senderTgIdInfoArray = [];
    for (const senderTgId in senderTgIdToFollowup) {
      senderTgIdInfoArray.push({
        userTelegramID: senderTgId,
        followupCount: senderTgIdToFollowup[senderTgId].count,
        userHandle: senderTgIdToFollowup[senderTgId].userInfo?.userHandle,
        userName: senderTgIdToFollowup[senderTgId].userInfo?.userName,
        responsePath: senderTgIdToFollowup[senderTgId].userInfo?.responsePath,
        patchwallet: senderTgIdToFollowup[senderTgId].userInfo?.patchwallet,
      });
    }

    // Create a CSV writer
    const csvWriter = createObjectCsvWriter({
      path: 'sender_followup.csv',
      header: [
        { id: 'userTelegramID', title: 'User Telegram ID' },
        { id: 'followupCount', title: 'Followup Count' },
        { id: 'userHandle', title: 'User Handle' },
        { id: 'userName', title: 'User Name' },
        { id: 'responsePath', title: 'Response Path' },
        { id: 'patchwallet', title: 'Patchwallet' },
      ],
    });
    // Write the senderTgId information to a CSV file
    await csvWriter.writeRecords(senderTgIdInfoArray);

    console.log('CSV file created: sender_followup.csv');
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    process.exit(0);
  }
}
