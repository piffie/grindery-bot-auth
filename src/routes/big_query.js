import express from 'express';
import { BigQuery } from '@google-cloud/bigquery';
import axios from 'axios';
import { Database } from '../db/conn.js';

const router = express.Router();
const bigqueryClient = new BigQuery();
const datasetId = 'telegram';

router.get('/transfer', async (req, res) => {
  const tableId = 'transfer';
  const db = await Database.getInstance();
  const collection = db.collection('transfers');

  const startDate = new Date(req.query.startDate);
  const endDate = new Date(req.query.endDate);

  const query = {
    dateAdded: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  const allTransfers = await collection.find(query).toArray();

  if (allTransfers.length === 0) {
    console.log('No transfers found in MongoDB.');
    return;
  }

  const batchSize = 3000;
  let insertedCount = 0;

  const existingTransactionHashes = await getExistingTransactionHashes();
  console.log('BIGQUERY - existingTransactionHashes');

  for (let i = 0; i < allTransfers.length; i += batchSize) {
    console.log(
      `BIGQUERY - insertedCount ${insertedCount} allTransfers ${allTransfers.length} i ${i}`
    );
    const batch = allTransfers.slice(i, i + batchSize);

    const filteredBatch = batch.filter((transfer) => {
      return !existingTransactionHashes.includes(transfer.transactionHash);
    });

    if (filteredBatch.length === 0) {
      console.log(
        'BIGQUERY All transfers in the batch already exist in BigQuery.'
      );
      continue;
    }

    if (filteredBatch.length != 0) {
      const bigQueryData = filteredBatch.map((transfer) => {
        return {
          amount: transfer.tokenAmount,
          context_library_name: null,
          context_library_version: null,
          event: null,
          event_text: null,
          id: transfer._id.toString(),
          loaded_at: null,
          original_timestamp: null,
          received_at: new Date(),
          sent_at: null,
          timestamp: new Date(transfer.dateAdded),
          user_id: null,
          uuid_ts: null,
          chain_id: transfer.chainId,
          recipient_tg_id: transfer.recipientTgId,
          recipient_wallet: transfer.recipientWallet,
          sender_name: transfer.senderName,
          sender_tg_id: transfer.senderTgId,
          sender_wallet: transfer.senderWallet,
          token_address: transfer.tokenAddress,
          token_amount: transfer.tokenAmount,
          token_symbol: transfer.tokenSymbol,
          transaction_hash: transfer.transactionHash,
          tx_id: transfer.TxId,
          sender_handle: transfer.senderHandle,
          event_id: null,
        };
      });

      await bigqueryClient
        .dataset(datasetId)
        .table(tableId)
        .insert(bigQueryData);
    }

    insertedCount += filteredBatch.length;
  }

  res.status(201).send({
    count: insertedCount,
  });
});

router.get('/users', async (req, res) => {
  const tableId = 'users';
  const db = await Database.getInstance();
  const collection = db.collection('users');

  // Get all users from the database
  const allUsers = await collection.find({}).toArray();

  if (allUsers.length === 0) {
    console.log('No users found in MongoDB.');
    return;
  }

  const batchSize = 3000;
  let importedCount = 0;

  const existingPatchwallets = await getExistingPatchwallets(tableId);
  console.log('BIGQUERY - existingPatchwallets');

  for (let i = 0; i < allUsers.length; i += batchSize) {
    console.log(`BIGQUERY - importedCount ${importedCount} allUsers ${allUsers.length} i ${i}`);
    const batch = allUsers.slice(i, i + batchSize);

    const filteredBatch = batch.filter((user) => {
      return !existingPatchwallets.includes(user.patchwallet);
    });

    if (filteredBatch.length === 0) {
      console.log('BIGQUERY All users in the batch already exist in BigQuery.');
      continue;
    }

    if (filteredBatch.length !== 0) {
      const bigQueryData = filteredBatch.map((user) => {
        return {
          context_ip: null,
          context_library_name: null,
          context_library_version: null,
          email: null,
          id: user._id.toString(),
          industry: null,
          loaded_at: null,
          name: user.userName,
          received_at: new Date(),
          uuid_ts: new Date(user.dateAdded),
          user_name: user.userName,
          patchwallet: user.patchwallet,
          response_path: user.responsePath,
          user_handle: user.userHandle
        };
      });

      await bigqueryClient
        .dataset(datasetId)
        .table(tableId)
        .insert(bigQueryData);
    }

    importedCount += filteredBatch.length;
  }

  res.status(201).send({
    count: importedCount,
  });
});

async function getExistingPatchwallets(tableId) {
  const query = `SELECT patchwallet FROM ${datasetId}.${tableId}`;
  const [rows] = await bigqueryClient.query(query);

  return rows.map((row) => row.id);
}

async function getExistingTransactionHashes() {
  const query = `SELECT transaction_hash FROM ${datasetId}.${tableId}`;
  const [rows] = await bigqueryClient.query(query);

  return rows.map((row) => row.transaction_hash);
}

export default router;
