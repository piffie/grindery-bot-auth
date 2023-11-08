import { Database } from '../db/conn.js';
import fs from 'fs';
import csv from 'csv-parser';
import web3 from 'web3';
import {
  REWARDS_COLLECTION,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
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

async function updateTransfersStatus() {
  try {
    const db = await Database.getInstance();
    const transfersCollection = db.collection(TRANSFERS_COLLECTION);
    const transfersToUpdate = await transfersCollection
      .find({ status: { $exists: false } })
      .toArray();
    const bulkWriteOperations = [];

    for (const transfer of transfersToUpdate) {
      console.log('processing...');
      const updateOperation = {
        updateOne: {
          filter: { _id: transfer._id },
          update: { $set: { status: 'success' } },
        },
      };

      bulkWriteOperations.push(updateOperation);
    }

    console.log('finish processing');

    if (bulkWriteOperations.length > 0) {
      const result = await transfersCollection.bulkWrite(bulkWriteOperations);

      console.log(
        `Updated ${result.modifiedCount} transfers with status: success`
      );
    } else {
      console.log('No transfers to update.');
    }
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    process.exit(0);
  }
}

async function importMissingTransferFromCSV(fileName) {
  const collectionName = '';
  const db = await Database.getInstance(collectionName);
  const collection = db.collection();
  const usersCollection = db.collection(USERS_COLLECTION);
  const groups = new Map();

  const startDate = new Date('2023-11-07T00:00:00Z');
  const endDate = new Date('2023-11-07T23:59:59Z');

  if (!fs.existsSync(fileName)) {
    console.log(`File ${fileName} does not exist.`);
    process.exit(1);
  }

  const csvStream = fs.createReadStream(fileName).pipe(csv());

  csvStream.on('data', async (row) => {
    const blockTimestamp = new Date(row.block_timestamp);

    if (
      blockTimestamp >= startDate &&
      blockTimestamp <= endDate &&
      web3.utils.toChecksumAddress(row.from_address) !==
        process.env.SOURCE_WALLET_ADDRESS
    ) {
      const key = `${row.from_address}-${row.to_address}-${row.value}-${row.transaction_hash}-${row.block_timestamp}`;
      if (groups.has(key)) {
        groups.set(key, groups.get(key) + 1);
      } else {
        groups.set(key, 1);
      }
    }
  });

  csvStream.on('end', async () => {
    const bulkOps = [];
    const batchSize = 20;
    let i = 1;
    const insertedDocs = [];

    console.log('\nGroups quantity ', groups.size);

    for (const [key, count] of groups) {
      const [
        senderWallet,
        recipientWallet,
        tokenAmount,
        transactionHash,
        blockTimestamp,
      ] = key.split('-');
      console.log(
        '\nQuantity of groups in csv: ',
        groups.size,
        ' Group: ',
        i,
        ' Key: ',
        {
          senderWallet: web3.utils.toChecksumAddress(senderWallet),
          recipientWallet: web3.utils.toChecksumAddress(recipientWallet),
          tokenAmount: Number(tokenAmount) / 1e18,
          transactionHash,
        }
      );
      const countInDB = await collection.countDocuments({
        senderWallet: web3.utils.toChecksumAddress(senderWallet),
        recipientWallet: web3.utils.toChecksumAddress(recipientWallet),
        tokenAmount: Number(tokenAmount) / 1e18,
        transactionHash,
      });
      console.log('countInDB ', countInDB);

      const missingCount = count - countInDB;

      if (missingCount > 0) {
        console.log('Insert key: ', key);
        for (let i = 0; i < missingCount; i++) {
          insertedDocs.push(key);

          const senderUser = await usersCollection.findOne({
            patchwallet: web3.utils.toChecksumAddress(senderWallet),
          });
          const senderTgId = senderUser ? senderUser.userTelegramID : undefined;
          const senderName = senderUser ? senderUser.userName : undefined;
          const senderHandle = senderUser ? senderUser.userHandle : undefined;
          const recipientUser = await usersCollection.findOne({
            patchwallet: web3.utils.toChecksumAddress(senderWallet),
          });
          const recipientTgId = recipientUser
            ? recipientUser.userTelegramID
            : undefined;

          bulkOps.push({
            insertOne: {
              document: {
                TxId: transactionHash.substring(1, 8),
                chainId: 'eip155:137',
                tokenSymbol: 'g1',
                tokenAddress: '0xe36BD65609c08Cd17b53520293523CF4560533d0',
                senderTgId: senderTgId,
                senderWallet: web3.utils.toChecksumAddress(senderWallet),
                senderName: senderName,
                recipientTgId: recipientTgId,
                recipientWallet: web3.utils.toChecksumAddress(recipientWallet),
                tokenAmount: Number(tokenAmount) / 1e18,
                transactionHash: transactionHash,
                dateAdded: new Date(blockTimestamp),
                status: 'success',
                senderHandle: senderHandle,
              },
            },
          });

          if (bulkOps.length >= batchSize) {
            const collectionMissingTransfer = db.collection(collectionName);
            await collectionMissingTransfer.bulkWrite(bulkOps, {
              ordered: true,
            });
            bulkOps.length = 0;
          }
        }
      }
      i++;
    }

    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps, { ordered: true });
    }

    console.log('\nDocs inserted: ', insertedDocs);
    console.log('\nQuantity of docs inserted: ', insertedDocs.length);
    process.exit(0);
  });

  csvStream.on('error', (error) => {
    console.log('\nErrors during CSV parsing\n', error);
    process.exit(1);
  });
}
