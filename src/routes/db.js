import express from "express";
import {isRequired} from "../utils/auth.js";
import {Database} from "../db/conn.js";

const router = express.Router();

router.post("/:collectionName", isRequired, async (req, res) => {
  const collectionName = req.params.collectionName;
  const db = await Database.getInstance(req);
  const collection = db.collection(collectionName);

  res.status(201).send(
    await collection.insertOne({
      ...req.body,
      dateAdded: new Date(),
    })
  );
});

router.get("/:collectionName", isRequired, async (req, res) => {
  const collectionName = req.params.collectionName;
  const query = {...req.query};

  try {
    const db = await Database.getInstance(req);
    const collection = db.collection(collectionName);

    const result = await collection.find(query).toArray();
    return res.status(200).send(result);
  } catch (error) {
    return res.status(500).send({msg: "An error occurred", error});
  }
});

export default router;
