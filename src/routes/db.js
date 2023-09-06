import express from "express";
import { Database } from "../db/conn.js";
import { authenticateApiKey } from "../utils/auth.js";
import { getIncomingTxsUser, getOutcomingTxsUser } from "../utils/transfers.js";

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

router.get("/incoming-transfers", authenticateApiKey, async (req, res) => {
  try {
    return res
      .status(200)
      .send(
        await getIncomingTxsUser(
          await Database.getInstance(),
          req.query.userTgId
        )
      );
  } catch (error) {
    return res.status(500).send({ msg: "An error occurred", error });
  }
});

router.get("/outcoming-transfers", authenticateApiKey, async (req, res) => {
  try {
    return res
      .status(200)
      .send(
        await getOutcomingTxsUser(
          await Database.getInstance(),
          req.query.userTgId
        )
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

export default router;
