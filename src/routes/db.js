import express from "express";
import { Database } from "../db/conn.js";
import { authenticateApiKey } from "../utils/auth.js";

const router = express.Router();

/**
 * POST /v1/db/:collectionName
 *
 * @summary Add record to DB
 * @description Adds record to DB collection.
 * @tags Database
 * @security BearerAuth
 * @param {string} collectionName.path.required - Collection name
 * @param {object} request.body - The request body containing the record object.
 * @return {object} 200 - Success response
 * @example request - 200 - Example request body
 * {
 *   "param1": "value1",
 *   "param2": "value2"
 * }
 */
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

/**
 * GET /v1/db/:collectionName
 *
 * @summary Get records from DB
 * @description Gets records from DB collection. Accepts filtering through query params.
 * @tags Database
 * @security BearerAuth
 * @param {string} collectionName.path.required - Collection name
 * @param {string} [limit.query] - Optional limit for pagination
 * @param {string} [start.query] - Optional offset for pagination
 * @return {object} 200 - Success response
 */
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
