import express from "express";
import { PubSub } from "@google-cloud/pubsub";
import { authenticateApiKey } from "../utils/auth.js";

const pubSubClient = new PubSub({
  projectId: "your-project-id",
  keyFilename: "/path/to/keyfile.json",
});

const topicName = "grindery-bot-webhook";
const subscriptionName = "grindery-bot-webhook-sub";

const router = express.Router();

/**
 * POST /v1/webhook
 *
 * @summary Catch a webhook
 * @description Catch a webhook event and push it to the queue.
 * @tags Webhook
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
router.post("/", authenticateApiKey, async (req, res) => {
  try {
    const data = JSON.stringify(req.body);
    console.log(`Publishing message: ${data}`);
    const dataBuffer = Buffer.from(data);
    const messageId = await pubSubClient
      .topic(topicName)
      .publishMessage({ data: dataBuffer });
    if (messageId) {
      res.json({ success: true, messageId });
    } else {
      res.status(500).json({ success: false, error: "Event wasn't saved" });
    }
  } catch (error) {
    console.error(`Received error while publishing: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

const listenForMessages = () => {
  const subscription = pubSubClient.subscription(subscriptionName);

  const messageHandler = async (message) => {
    try {
      let result = {};

      // handle event here:

      // send transaction, save to db, send to segment, set result
      // if (message.data.event === "new_transaction" && event.params) ...

      // save user to db, send to segment, set result
      // if (message.data.event === "new_user"  && event.params) ...

      // save reward to db, set result
      // if (message.data.event === "new_reward"  && event.params) ...

      // ... rest of events

      // send result to a webhook (flowxo) here

      // "Ack" (acknowledge receipt of) the message
      console.log("Received message:", JSON.stringify(message.data, null, 2));
      message.ack();
    } catch (error) {
      console.error("messageHandler error:", error);
    }
  };

  subscription.on("message", messageHandler);
};

listenForMessages();

export default router;
