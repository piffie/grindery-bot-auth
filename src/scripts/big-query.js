import { BigQuery } from '@google-cloud/bigquery';
import axios from 'axios';
import 'dotenv/config';

const bigqueryClient = new BigQuery();
const baseUrl = 'https://flowxo.com/api/interactions/';
const headers = {
  Authorization: `Bearer ${process.env.FLOWXO_TOKEN}`,
};

const workflowId = '650b00450e23a50027cc5acb';
const datasetId = 'flowxo';
const tableId = 'interactions';

async function main() {
  const interactions = await getInteractionsData();
  await importToBigQuery(interactions);
}

async function getInteractionsData() {
  const interactions = await getAllInteractionsFromFlowXO();

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

  console.log(`All interactions retrieved fromw Workflow ${workflowId}`);
}

async function getAllInteractionsFromFlowXO() {
  const queryParams = {
    status: 'completed',
    workflow: workflowId,
    page: 1,
    start: '2023-10-01T07:00:00.000Z',
    end: '2023-10-11T23:59:59.000Z',
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

      if (response.status !== 200) {
        throw new Error(`Request failed with status: ${response.status}`);
      }

      const { interactions, hasMore } = response.data;
      allInteractions.push(...interactions);

      //if (!hasMore) {
      break; // No more pages to fetch
      //}

      console.log(
        `Getting all workflow (${workflowId}) interactions from FlowXo - page ${queryParams.page} - total number of interactions ${response.data.total} - interactions retrieved ${response.data.skip}`
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
        { name: '_id', type: 'STRING' },
        { name: 'workflow', type: 'STRING' },
        { name: 'workflow_name', type: 'STRING' },
        { name: 'request', type: 'STRING' },
        { name: 'result', type: 'STRING' },
        { name: 'bot', type: 'STRING' },
        { name: 'bot_name', type: 'STRING' },
        { name: 'bot_integration', type: 'STRING' },
        { name: 'created_at', type: 'STRING' },
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
        // { name: 'filtered_detail:', type: 'STRING' },
        { name: 'response_path', type: 'STRING' },
        // { name: 'input_data', type: 'STRING' },
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

      console.log(`Table ${table.id} created.`);
    }

    await insertDataToBigQuery(interactions);
  } catch (error) {
    console.error('Error checking dataset existence:', error);
  }
}

async function insertDataToBigQuery(interactions) {
  let toSave = [];
  for (const task of interactions.tasks) {
    console.log(task);
    // console.log(JSON.stringify(task.filtered_detail));
    toSave.push({
      task_log_type: interactions.interaction.task_log_type,
      _id: interactions.interaction._id,
      workflow: interactions.interaction.workflow,
      workflow_name: interactions.interaction.workflow_name,
      request: interactions.interaction.request,
      result: interactions.interaction.result,
      bot: interactions.interaction.bot,
      bot_name: interactions.interaction.bot_name,
      bot_integration: JSON.stringify(interactions.interaction.bot_integration),
      created_at: interactions.interaction.created_at,
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
      // filtered_detail: JSON.stringify(task.filtered_detail),
      response_path: task.response_path,
      // input_data: JSON.stringify(task.input_data),
      expires_at_task: task.expires_at,
      created_at_task: task.created_at,
      input_data_labelled: JSON.stringify(task.input_data_labelled),
      output_data_labelled: JSON.stringify(task.output_data_labelled),
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
}

await main();
