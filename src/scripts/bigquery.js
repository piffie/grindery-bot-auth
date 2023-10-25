import { Database } from '../db/conn.js';
import { BigQuery } from '@google-cloud/bigquery';

const bigqueryClient = new BigQuery();
const datasetId = 'telegram';

const importUsers = async () => {
    const tableId = 'users_copy';
    const db = await Database.getInstance();
    const collection = db.collection('users');
  
    // Get all users from the database
    const allUsers = await collection.find({}).toArray();
  
    if (allUsers.length === 0) {
      console.log('No users found in MongoDB.');
      return;
    }
  
    const batchSize = 3000;
    let importedCount = 0
  
    const existingPatchwallets = await getExistingPatchwallets(tableId);
    console.log('BIGQUERY - existingPatchwallets');
    console.log(existingPatchwallets)
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
}
  

async function getExistingPatchwallets(tableId) {
  const query = `SELECT patchwallet FROM ${datasetId}.${tableId}`;
  const [rows] = await bigqueryClient.query(query);

  return rows.map((row) => row.patchwallet);
}

importUsers();