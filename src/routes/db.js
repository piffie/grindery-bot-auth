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
    const incomingTxs = await getIncomingTxsUser(
      await Database.getInstance(),
      req.query.userTgId
    );

    const outgoingTxs = await getOutgoingTxsUser(
      await Database.getInstance(),
      req.query.userTgId
    );
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

async function myFunction(userTgId) {
  try {
    const db = await Database.getInstance();

    let finalText = "";

    finalText += await getIncomingTxsUser(db, userTgId, 0, 0).then(
      (incomingTxs) => {
        return incomingTxs.length > 0
          ? `<b>Incoming transfers:</b>\n${incomingTxs
              .map(
                (transfer) =>
                  `${transfer.tokenAmount} g1 from @${
                    transfer.senderUserHandle
                  } on ${transfer.dateAdded} ${
                    transfer.message
                      ? `[text details: ${transfer.message}]`
                      : ""
                  }`
              )
              .join("\n")}\n\n`
          : "";
      }
    );

    finalText += await getOutgoingTxsUser(db, userTgId, 0, 0).then(
      (outgoingTxs) => {
        return outgoingTxs.length > 0
          ? `<b>Outgoing transfers:</b>\n${outgoingTxs
              .map(
                (transfer) =>
                  `${transfer.tokenAmount} g1 to ${
                    transfer.recipientUserHandle
                      ? `@${transfer.recipientUserHandle}`
                      : `a new user (Telegram ID: ${transfer.recipientTgId})`
                  } on ${transfer.dateAdded} ${
                    transfer.message
                      ? `[text details: ${transfer.message}]`
                      : ""
                  }`
              )
              .join("\n")}\n\n`
          : "";
      }
    );

    finalText += await getRewardTxsUser(db, userTgId, 0, 0).then(
      (rewardTxs) => {
        return rewardTxs.length > 0
          ? `<b>Reward transfers:</b>\n${rewardTxs
              .map(
                (transfer) =>
                  `${transfer.amount} g1 on ${transfer.dateAdded} ${
                    transfer.message
                      ? `[text details: ${transfer.message}]`
                      : ""
                  }`
              )
              .join("\n")}\n\n`
          : "";
      }
    );

    console.log(finalText.trimEnd());
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
    return ""; // En cas d'erreur, retourne une chaîne vide.
  } finally {
    process.exit(0);
  }
}

export default router;
