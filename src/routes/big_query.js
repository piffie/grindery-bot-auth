import express from 'express';
import { BigQuery } from '@google-cloud/bigquery';
import axios from 'axios';

const router = express.Router();
const bigqueryClient = new BigQuery();
const baseUrl = 'https://flowxo.com/api/interactions/';
const headers = {
  Authorization: `Bearer ${process.env.FLOWXO_TOKEN}`,
};
const datasetId = 'flowxo';
const tableId = 'interactions';

router.get('/', async (req, res) => {
  const interactions = await getInteractionsData(
    req.query.start_date,
    req.query.end_date,
    req.query.workflow_id
  );
  // await importToBigQuery(interactions);
  res.status(201).send();
});

async function getInteractionsData(start_date, end_date, workflow_id) {
  const interactions = await getAllInteractionsFromFlowXO(
    start_date,
    end_date,
    workflow_id
  );

  for (const interaction of interactions) {
    let toSave = {
      interaction: { ...interaction },
      tasks: [],
    };

    const iteractionData = await fetchInteractionDataFromFlowXO(
      interaction.request
    );

    if (iteractionData.tasks) {
      for (const task of iteractionData.tasks) {
        toSave.tasks.push(task);
      }
    }

    return toSave;
  }

  console.log(`All interactions retrieved fromw Workflow ${workflow_id}`);
}

async function getAllInteractionsFromFlowXO(start_date, end_date, workflow_id) {
  const queryParams = {
    status: 'completed',
    workflow: workflow_id,
    page: 1,
    start: start_date,
    end: end_date,
    limit: 100,
  };

  const allInteractions = [];

  while (true) {
    try {
      const response = await axios.get(baseUrl, {
        params: queryParams,
        headers: {
          Authorization: `Bearer ${process.env.FLOWXO_TOKEN}`,
        },
      });
      console.log(response);
      if (response.status !== 200) {
        throw new Error(`Request failed with status: ${response.status}`);
      }

      const { interactions, hasMore } = response.data;
      allInteractions.push(...interactions);

      if (!hasMore) {
        break;
      }

      console.log(
        `Getting all workflow (${workflow_id}) interactions from FlowXo - page ${queryParams.page} - total number of interactions ${response.data.total} - interactions retrieved ${response.data.skip}`
      );
      queryParams.page++;
    } catch (error) {
      console.error('Error fetching interactions:', error);
      break;
    }
  }

  return allInteractions;
}

async function fetchInteractionDataFromFlowXO(interactionId) {
  const endpointUrl = baseUrl + interactionId;

  try {
    return (await axios.get(endpointUrl, { headers })).data;
  } catch (error) {
    console.error(
      `Error fetching data for Interaction ID ${interactionId}:`,
      error.message
    );
  }
}

async function importToBigQuery(interactions) {
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
        { name: 'task_log_type', type: 'STRING' },
        { name: '_id_interaction', type: 'STRING' },
        { name: 'workflow', type: 'STRING' },
        { name: 'workflow_name', type: 'STRING' },
        { name: 'request_interaction', type: 'STRING' },
        { name: 'result_interaction', type: 'STRING' },
        { name: 'bot', type: 'STRING' },
        { name: 'bot_name', type: 'STRING' },
        { name: 'bot_integration', type: 'STRING' },
        { name: 'created_at_interaction', type: 'STRING' },
        { name: '_id_task', type: 'STRING' },
        { name: 'result_task', type: 'STRING' },
        { name: 'task', type: 'STRING' },
        { name: 'user', type: 'STRING' },
        { name: 'last_task_attempt_at', type: 'STRING' },
        { name: 'task_kind', type: 'STRING' },
        { name: 'task_type', type: 'STRING' },
        { name: 'task_name', type: 'STRING' },
        { name: 'service', type: 'STRING' },
        { name: 'method', type: 'STRING' },
        { name: 'group', type: 'STRING' },
        { name: 'filtered_detail', type: 'STRING' },
        { name: 'response_path', type: 'STRING' },
        { name: 'input_data', type: 'STRING' },
        { name: 'expires_at_task', type: 'STRING' },
        { name: 'created_at_task', type: 'STRING' },
        { name: 'input_data_labelled', type: 'STRING' },
        { name: 'output_data_labelled', type: 'STRING' },
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

    await insertDataToBigQuery(interactions);
  } catch (error) {
    console.error('Error checking dataset existence:', error);
  }
}

async function insertDataToBigQuery(interactions) {
  let toSave = [];
  for (const task of interactions.tasks) {
    console.log(task.filtered_detail);
    toSave.push({
      _id_interaction: interactions.interaction._id,
      task_log_type: interactions.interaction.task_log_type,
      workflow: interactions.interaction.workflow,
      workflow_name: interactions.interaction.workflow_name,
      request_interaction: interactions.interaction.request,
      result_interaction: interactions.interaction.result,
      bot: interactions.interaction.bot,
      bot_name: interactions.interaction.bot_name,
      bot_integration: JSON.stringify(interactions.interaction.bot_integration),
      created_at_interaction: interactions.interaction.created_at,
      _id_task: task._id,
      result_task: task.result,
      task: task.task,
      user: task.user,
      last_task_attempt_at: task.last_task_attempt_at,
      task_kind: task.task_kind,
      task_type: task.task_type,
      task_name: task.task_name,
      service: JSON.stringify(task.service),
      method: task.method,
      group: task.group,
      filtered_detail: JSON.stringify(task.filtered_detail),
      response_path: task.response_path,
      input_data: JSON.stringify(task.input_data),
      expires_at_task: task.expires_at,
      created_at_task: task.created_at,
      input_data_labelled: JSON.stringify(task.input_data_labelled),
      output_data_labelled: JSON.stringify(task.output_data_labelled),
    });
  }

  let error;

  bigqueryClient
    .dataset(datasetId)
    .table(tableId)
    .insert(toSave, function (err, response) {
      console.log('\nerror:' + JSON.stringify(err));
      console.log('\nresponse:' + JSON.stringify(response));
    });

  console.log(`Inserted ${toSave.length} rows`);
}

export default router;
