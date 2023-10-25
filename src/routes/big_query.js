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

async function getExistingTransactionHashes() {
  const query = `SELECT transaction_hash FROM ${datasetId}.${tableId}`;
  const [rows] = await bigqueryClient.query(query);

  return rows.map((row) => row.transaction_hash);
}

export default router;
