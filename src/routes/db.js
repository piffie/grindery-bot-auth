import express from "express";
import { Database } from "../db/conn.js";
import { authenticateApiKey } from "../utils/auth.js";
import { distributeReferralRewards } from "../scripts/rewards.js";

const router = express.Router();

router.post(
  "/distributeReferralRewards",
  authenticateApiKey,
  async (req, res) => {
    try {
      await distributeReferralRewards();

      res
        .status(200)
        .send({ message: "Referral rewards distributed successfully." });
    } catch (error) {
      res.status(500).send({ message: "An error occurred", error });
    }
  }
);

router.post("/:collectionName", authenticateApiKey, async (req, res) => {
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

router.get("/:collectionName", authenticateApiKey, async (req, res) => {
  const { limit, start, ...query } = req.query;
  try {
    const db = await Database.getInstance(req);
    return res.status(200).send(
      await db
        .collection(req.params.collectionName)
        .find(query)
        .skip(parseInt(start) >= 0 ? parseInt(start) : 0)
        .limit(limit !== undefined && parseInt(limit) > 0 ? parseInt(limit) : 0)
        .toArray()
    );
  } catch (error) {
    return res.status(500).send({ msg: "An error occurred", error });
  }
});

export default router;
