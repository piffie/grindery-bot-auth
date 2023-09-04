import express from "express";
import {isRequired} from "../utils/auth.js";
import {Database} from "../db/conn.js";

const router = express.Router();

router.post("/", isRequired, async (req, res) => {
  // Get the database instance and select the 'users' collection
  const db = await Database.getInstance(req);
  const collection = db.collection("users");

  // Check if the user already exists based on telegramUserID
  if (
    req.body.telegramUserID &&
    (await collection.findOne({telegramUserID: req.body.telegramUserID}))
  ) {
    return res.status(404).send({
      msg: "This user already exists.",
    });
  }

  // Insert the new user into the collection
  res.status(201).send(
    await collection.insertOne({
      ...req.body,
      dateAdded: new Date(),
      isActive: true,
    })
  );
});

router.post("/transfers", isRequired, async (req, res) => {
  // Get the database instance and select the 'transfers' collection
  const db = await Database.getInstance(req);
  const collection = db.collection("transfers");

  // Check if the transfer already exists based on txID
  if (req.body.txId && (await collection.findOne({txId: req.body.txId}))) {
    return res.status(404).send({
      msg: "This transfer already exists.",
    });
  }

  // Insert the new transfer into the collection
  res.status(201).send(
    await collection.insertOne({
      ...req.body,
      timestamp: new Date(),
      isActive: true,
    })
  );
});

router.post("/rewards", isRequired, async (req, res) => {
  // Get the database instance and select the 'rewards' collection
  const db = await Database.getInstance(req);
  const collection = db.collection("rewards");

  // Insert the new reward into the collection
  res.status(201).send(
    await collection.insertOne({
      ...req.body,
      timestamp: new Date(),
      isActive: true,
    })
  );
});

export default router;
