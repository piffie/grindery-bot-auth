import express from "express";
import {Database} from "../db/conn.js";
import {authenticateApiKey} from "../utils/auth.js";

const router = express.Router();

router.get("/txSent", authenticateApiKey, async (req, res) => {
  const {days, topX, limit = 10, skip = 0} = req.query;

  try {
    const db = await Database.getInstance(req);

    let dateFilter = {};

    if (days && !isNaN(days)) {
      dateFilter = {
        dateAdded: {
          $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      };
    }

    const pipeline = [
      {$match: dateFilter},
      {$group: {_id: "$senderTgId", count: {$sum: 1}}},
      {$sort: {count: -1}},
      {$skip: parseInt(skip)},
      {$limit: parseInt(limit)},
    ];

    if (topX && !isNaN(topX)) {
      pipeline.push({$limit: parseInt(topX)});
    }

    const results = await db
      .collection("transfers")
      .aggregate(pipeline)
      .toArray();

    return res.status(200).send(results);
  } catch (error) {
    return res.status(500).send({msg: "An error occurred", error});
  }
});

router.get("/tokensSent", authenticateApiKey, async (req, res) => {
  const {days, limit = 10, skip = 0, topX} = req.query;

  try {
    const db = await Database.getInstance(req);

    let dateFilter = {};

    if (days && !isNaN(days)) {
      dateFilter = {
        dateAdded: {
          $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      };
    }

    const pipeline = [
      {$match: dateFilter},
      {
        $group: {
          _id: "$senderTgId",
          totalTokens: {$sum: {$toDecimal: "$tokenAmount"}},
        },
      },
      {$sort: {totalTokens: -1}},
      {$skip: parseInt(skip)},
      {$limit: topX ? parseInt(topX) : parseInt(limit)},
    ];

    const results = await db
      .collection("transfers")
      .aggregate(pipeline)
      .toArray();

    return res.status(200).send(results);
  } catch (error) {
    console.log(error);
    return res.status(500).send({msg: "An error occurred", error});
  }
});

router.get("/rewards", authenticateApiKey, async (req, res) => {
  const {days, skip = 0, limit = 10, topX} = req.query;

  let dateFilter = {};

  if (days && !isNaN(days)) {
    dateFilter = {
      dateAdded: {
        $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      },
    };
  }

  try {
    const db = await Database.getInstance(req);
    const pipeline = [
      {$match: dateFilter},
      {
        $group: {
          _id: "$userTelegramID",
          totalRewards: {$sum: {$toDecimal: "$amount"}},
        },
      },
      {$sort: {totalRewards: -1}},
      {$skip: parseInt(skip)},
      {$limit: topX ? parseInt(topX) : parseInt(limit)},
    ];

    const leaderboard = await db
      .collection("rewards")
      .aggregate(pipeline)
      .toArray();
    return res.status(200).send(leaderboard);
  } catch (error) {
    return res.status(500).send({msg: "An error occurred", error});
  }
});

export default router;
