import express from "express";
import { Database } from "../db/conn.js";
import { authenticateApiKey } from "../utils/auth.js";
import {
  getIncomingTxsUser,
  getOutgoingTxsUser,
  getRewardTxsUser,
} from "../utils/transfers.js";

const router = express.Router();

router.post("/:collectionName", authenticateApiKey, async (req, res) => {
  const collectionName = req.params.collectionName;
  const db = await Database.getInstance();
  const collection = db.collection(collectionName);

  res.status(201).send(
    await collection.insertOne({
      ...req.body,
      dateAdded: new Date(),
    })
  );
});

router.get("/format-transfers-user", authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();
    const start =
      parseInt(req.query.start) >= 0 ? parseInt(req.query.start) : 0;
    const limit =
      req.query.limit && parseInt(req.query.limit) > 0
        ? parseInt(req.query.limit)
        : 0;

    let formattedTxs = "";

    formattedTxs += await getIncomingTxsUser(
      db,
      req.query.userTgId,
      start,
      limit
    ).then((incomingTxs) => {
      return incomingTxs.length > 0
        ? `<b>Incoming transfers:</b>\n${incomingTxs
            .map(
              (transfer) =>
                `- ${transfer.tokenAmount} g1 from @${
                  transfer.senderUserHandle
                } on ${transfer.dateAdded} ${
                  transfer.message ? `[text details: ${transfer.message}]` : ""
                }`
            )
            .join("\n")}\n\n`
        : "";
    });

    formattedTxs += await getOutgoingTxsUser(
      db,
      req.query.userTgId,
      start,
      limit
    ).then((outgoingTxs) => {
      return outgoingTxs.length > 0
        ? `<b>Outgoing transfers:</b>\n${outgoingTxs
            .map(
              (transfer) =>
                `- ${transfer.tokenAmount} g1 to ${
                  transfer.recipientUserHandle
                    ? `@${transfer.recipientUserHandle}`
                    : `a new user (Telegram ID: ${transfer.recipientTgId})`
                } on ${transfer.dateAdded} ${
                  transfer.message ? `[text details: ${transfer.message}]` : ""
                }`
            )
            .join("\n")}\n\n`
        : "";
    });

    formattedTxs += await getRewardTxsUser(
      db,
      req.query.userTgId,
      start,
      limit
    ).then((rewardTxs) => {
      return rewardTxs.length > 0
        ? `<b>Reward transfers:</b>\n${rewardTxs
            .map(
              (transfer) =>
                `- ${transfer.amount} g1 on ${transfer.dateAdded} ${
                  transfer.message ? `[text details: ${transfer.message}]` : ""
                }`
            )
            .join("\n")}\n\n`
        : "";
    });

    res.status(200).send({ formattedTxs: formattedTxs.trimEnd() });
  } catch (error) {
    return res.status(500).send({ msg: "An error occurred", error });
  }
});

router.get("/:collectionName", authenticateApiKey, async (req, res) => {
  const collectionName = req.params.collectionName;
  const query = { ...req.query };

  try {
    const db = await Database.getInstance();
    const collection = db.collection(collectionName);

    const result = await collection.find(query).toArray();
    return res.status(200).send(result);
  } catch (error) {
    return res.status(500).send({ msg: "An error occurred", error });
  }
});

export default router;
