import express from "express";
import { PubSub } from "@google-cloud/pubsub";
import { authenticateApiKey } from "../utils/auth.js";
import {
  handleNewReward,
  handleNewTransaction,
  handleNewUser,
} from '../utils/webhook.js';
import { v4 as uuidv4 } from 'uuid';
import { v1 } from '@google-cloud/pubsub';

/**
 * This is a generic and extendable implementation of a webhook endpoint and pub/sub messages queue.
 * It can be used to catch any webhook event and push it to the queue for processing.
 *
 * Add new events to the switch statement in the messageHandler function.
 * Events that are not defined in switch statement will be acknowledged and removed from the queue by default.
 */

// Init pub/sub client
const pubSubClient = new PubSub();

// Creates a publisher client.
const publisherClient = new v1.PublisherClient({
  // optional auth parameters
});

// Get topic and subscription names from env
const topicName = process.env.PUBSUB_TOPIC_NAME;
const subscriptionName = process.env.PUBSUB_SUBSCRIPTION_NAME;
const projectId = process.env.PROJECT_ID;

const router = express.Router();

/**
 * POST /v1/webhook
 *
 * @summary Catch a webhook
 * @description Catches a webhook event and pushes it to the queue for processing.
 * @tags Webhook
 * @security BearerAuth
 * @param {object} request.body - The request body containing the event name and params
 * @return {object} 200 - Success response with message ID
 * @example request - 200 - Example request body
 * {
 *   "event": "event_name",
 *   "params": { "param1": "value1" }
 * }
 * @example response - 200 - Success response example
 * {
 *   "success": true,
 *   "messageId": "some-uuid"
 * }
 *
 * @example response - 500 - Error response example
 * {
 *   "success": false,
 *   "error": "error message"
 * }
 */
router.post('/', authenticateApiKey, async (req, res) => {
  try {
    req.body.event === 'new_transaction_batch'
      ? req.body.params.forEach(
          (transaction) => (transaction.eventId = uuidv4())
        )
      : (req.body.params.eventId = uuidv4());

    const data = JSON.stringify(req.body);
    console.log(`Publishing message: ${data}`);

    const formattedTopic = publisherClient.projectTopicPath(
      projectId,
      topicName
    );

    // Publishes the message as a string, e.g. "Hello, world!" or JSON.stringify(someObject)
    const dataBuffer = Buffer.from(data);
    const messagesElement = {
      data: dataBuffer,
    };
    const messages = [messagesElement];

    // Build the request
    const request = {
      topic: formattedTopic,
      messages: messages,
    };

    // Retry settings control how the publisher handles retryable failures. Default values are shown.
    // The `retryCodes` array determines which grpc errors will trigger an automatic retry.
    // The `backoffSettings` object lets you specify the behaviour of retries over time.
    const retrySettings = {
      retryCodes: [
        10, // 'ABORTED'
        1, // 'CANCELLED',
        4, // 'DEADLINE_EXCEEDED'
        13, // 'INTERNAL'
        8, // 'RESOURCE_EXHAUSTED'
        14, // 'UNAVAILABLE'
        2, // 'UNKNOWN'
      ],
      backoffSettings: {
        // The initial delay time, in milliseconds, between the completion
        // of the first failed request and the initiation of the first retrying request.
        initialRetryDelayMillis: 3600000,
        // The multiplier by which to increase the delay time between the completion
        // of failed requests, and the initiation of the subsequent retrying request.
        retryDelayMultiplier: 1.3,
        // The maximum delay time, in milliseconds, between requests.
        // When this value is reached, retryDelayMultiplier will no longer be used to increase delay time.
        maxRetryDelayMillis: 60000,
        // The initial timeout parameter to the request.
        initialRpcTimeoutMillis: 5000,
        // The multiplier by which to increase the timeout parameter between failed requests.
        rpcTimeoutMultiplier: 1.0,
        // The maximum timeout parameter, in milliseconds, for a request. When this value is reached,
        // rpcTimeoutMultiplier will no longer be used to increase the timeout.
        maxRpcTimeoutMillis: 600000,
        // The total time, in milliseconds, starting from when the initial request is sent,
        // after which an error will be returned, regardless of the retrying attempts made meanwhile.
        totalTimeoutMillis: 600000,
      },
    };

    const [response] = await publisherClient.publish(request, {
      retry: retrySettings,
    });
    console.log(`Message ${response.messageIds} published.`);

    if (response) {
      res.json({ success: true, response });
    } else {
      res.status(500).json({ success: false, error: "Event wasn't saved" });
    }
  } catch (error) {
    console.error(`Received error while publishing: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Subscribe to messages from Pub/Sub
const listenForMessages = () => {
  // get subscription
  const subscription = pubSubClient.subscription(subscriptionName);

  // Process and acknowledge pub/sub message
  const messageHandler = async (message) => {
    const messageDataString = message.data.toString();
    const messageData = JSON.parse(messageDataString);
    console.log('Received message:', JSON.stringify(messageData, null, 2));

    try {
      let processed = false; // Has event been processed. If not, message will be requeued.

      // Handle events below. If event is not specified, message will be acknowledged and removed from the queue.

      // Example events:
      switch (messageData.event) {
        // User initiated new transaction
        case 'new_transaction':
          processed = await handleNewTransaction(messageData.params);
          break;
        // User initiated new transaction batch
        case 'new_transaction_batch':
          for (let singleTransaction of messageData.params) {
            // Publishing each transaction as a new event
            const transactionEvent = {
              event: 'new_transaction',
              params: singleTransaction,
            };
            const transactionDataBuffer = Buffer.from(
              JSON.stringify(transactionEvent)
            );
            await pubSubClient
              .topic(topicName)
              .publishMessage({ data: transactionDataBuffer });
          }
          processed = true;
          break;
        // New user started the bot
        case 'new_user':
          processed = await handleNewUser(messageData.params);
          break;
        // New reward has been issued to user
        case 'new_reward':
          processed = await handleNewReward(messageData.params);
          break;
        default:
          processed = true;
          break;
      }

      if (!processed) {
        throw new Error('Error processing event');
      }

      console.log(
        'Acknowledged message:',
        JSON.stringify(messageData, null, 2)
      );
      message.ack(); // "Ack" (acknowledge receipt of) the message
    } catch (error) {
      console.error('messageHandler error:', error);
      message.nack(); // "Nack" (don't acknowledge receipt of) the message
    }
  };

  subscription.on('message', messageHandler);
};

// Start listening for pub/sub messages
listenForMessages();

export default router;
