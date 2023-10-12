import express from 'express';
import { BigQuery } from '@google-cloud/bigquery';
import axios from 'axios';

const router = express.Router();
const bigqueryClient = new BigQuery();
const apiUrl = 'https://flowxo.com/api/conversations';
const datasetId = 'flowxo';
const tableId = 'conversations';

router.get('/', async (req, res) => {
  const allConversations = [];

  let skip = 0;
  const limit = 100;

  while (true) {
    try {
      // Make a GET request to the API with query parameters
      const response = await axios.get(apiUrl, {
        params: {
          skip,
          limit,
          start: req.query.start,
          end: req.query.end,
        },
        headers: {
          Authorization: `Bearer ${process.env.FLOWXO_TOKEN}`,
        },
      });

      // Check if the request was successful
      if (response.status === 200) {
        const data = response.data;
        const conversations = data.conversations;

        console.log(
          `total: ${data.total} - skip: ${data.skip} - limit ${data.limit}`
        );

        // Add the conversations to the array
        allConversations.push(...conversations);

        // Update the skip value for the next page
        skip += limit;

        // Check if there are more conversations to fetch
        if (skip >= data.total) {
          break;
        }
      } else {
        console.error(
          `Failed to fetch conversations. Status code: ${response.status}`
        );
        return res
          .status(400)
          .send({ message: 'Failed to fetch conversations' });
      }
    } catch (error) {
      console.error('An error occurred:', error.message);
      return res
        .status(400)
        .send({ message: `An error occurred: ${error.message}` });
      break;
    }
  }

  importToBigQuery(allConversations);
  const count = await insertDataToBigQuery(allConversations);

  res.status(200).send({ count });
});

async function importToBigQuery(allConversations) {
  let dataset;

  try {
    const [exists] = await bigqueryClient.dataset(datasetId).exists();

    if (exists) {
      [dataset] = await bigqueryClient.dataset(datasetId).get();
      console.log(`Dataset ${datasetId} exists.`);
    } else {
      console.log(`Dataset ${datasetId} does not exist.`);
      [dataset] = await bigqueryClient.createDataset(datasetId, {});
      console.log(`Dataset ${dataset.id} created.`);
    }

    const table = dataset.table(tableId);
    const [existsTable] = await table.exists();

    if (!existsTable) {
      console.log(`Table ${tableId} does not exist.`);
      const schema = [
        { name: 'id', type: 'STRING' },
        { name: 'id_url_encoded', type: 'STRING' },
        { name: 'created_at', type: 'STRING' },
        { name: 'bot_id', type: 'STRING' },
        { name: 'bot_name', type: 'STRING' },
        { name: 'platform', type: 'STRING' },
        { name: 'user_id', type: 'STRING' },
        { name: 'user_name', type: 'STRING' },
        { name: 'last_message_id', type: 'STRING' },
        { name: 'last_message_role', type: 'STRING' },
        { name: 'last_message_conversation', type: 'STRING' },
        { name: 'last_message_from', type: 'STRING' },
        { name: 'last_message_agent_mode', type: 'STRING' },
        { name: 'last_message_type', type: 'STRING' },
        { name: 'last_message_message', type: 'STRING' },
        { name: 'last_message_custom', type: 'STRING' },
        { name: 'last_message_timestamp', type: 'STRING' },
      ];
      const options = {
        schema: schema,
        location: 'US',
      };

      // Create a new table in the dataset
      const [table] = await bigqueryClient
        .dataset(datasetId)
        .createTable(tableId, options);

      console.log(`Table ${table.id}  created.`);
    }
  } catch (error) {
    console.error('Error checking dataset existence:', error);
  }
}

async function insertDataToBigQuery(allConversations) {
  let toSave = [];
  for (const conversation of allConversations) {
    console.log(conversation);
    toSave.push({
      id: conversation.id,
      id_url_encoded: conversation.id_url_encoded,
      created_at: conversation.created_at,
      bot_id: conversation.bot_id,
      bot_name: conversation.bot_name,
      platform: conversation.platform,
      user_id: conversation.user_id,
      user_name: conversation.user_name,
      last_message_id:
        conversation.last_message && conversation.last_message.id
          ? conversation.last_message.id
          : '',
      last_message_role:
        conversation.last_message && conversation.last_message.role
          ? conversation.last_message.role
          : '',
      last_message_conversation:
        conversation.last_message && conversation.last_message.conversation
          ? conversation.last_message.conversation
          : '',
      last_message_from:
        conversation.last_message && conversation.last_message.from
          ? conversation.last_message.from
          : '',
      last_message_agent_mode:
        conversation.last_message && conversation.last_message.agent_mode
          ? conversation.last_message.agent_mode
          : '',
      last_message_type:
        conversation.last_message && conversation.last_message.type
          ? conversation.last_message.type
          : '',
      last_message_message:
        conversation.last_message && conversation.last_message.message
          ? conversation.last_message.message
          : '',
      // last_message_options:
      //   conversation.last_message && conversation.last_message.options
      //     ? conversation.last_message.options
      //     : '',
      last_message_custom:
        conversation.last_message && conversation.last_message.custom
          ? conversation.last_message.custom
          : '',
      last_message_timestamp:
        conversation.last_message && conversation.last_message.timestamp
          ? conversation.last_message.timestamp
          : '',
    });
  }

  bigqueryClient
    .dataset(datasetId)
    .table(tableId)
    .insert(toSave, function (err, response) {
      console.log('\nerror:' + JSON.stringify(err));
      console.log('\nresponse:' + JSON.stringify(response));
    });

  console.log(`Inserted ${toSave.length} rows`);

  return toSave.length;
}

export default router;
