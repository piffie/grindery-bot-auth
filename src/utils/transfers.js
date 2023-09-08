import { Database } from "../db/conn.js";
import {
  REWARDS_COLLECTION,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
} from "./constants.js";

export async function getIncomingTxsUser(db, userId, start, limit) {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .find({ recipientTgId: userId })
        .skip(start)
        .limit(limit)
        .toArray()
    ).map(async (entry) => ({
      ...entry,
      dateAdded: formatDate(entry.dateAdded),
      senderUserHandle:
        (
          await db
            .collection(USERS_COLLECTION)
            .findOne({ userTelegramID: entry.senderTgId })
        )?.userHandle || null,
    }))
  );
}

export async function getOutgoingTxsUser(db, userId, start, limit) {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .find({ senderTgId: userId })
        .skip(start)
        .limit(limit)
        .toArray()
    ).map(async (entry) => ({
      ...entry,
      dateAdded: formatDate(entry.dateAdded),
      recipientUserHandle:
        (
          await db
            .collection(USERS_COLLECTION)
            .findOne({ userTelegramID: entry.recipientTgId })
        )?.userHandle || null,
    }))
  );
}

export async function getRewardTxsUser(db, userId, start, limit) {
  return (
    await db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: userId })
      .skip(start)
      .limit(limit)
      .toArray()
  ).map((entry) => ({
    ...entry,
    dateAdded: formatDate(entry.dateAdded),
  }));
}

// function formatDate(date) {
//   return new Date(date).toLocaleString("en-US", {
//     year: "numeric",
//     month: "2-digit",
//     day: "2-digit",
//     hour: "2-digit",
//     minute: "2-digit",
//     second: "2-digit",
//     hour12: true,
//     timeZoneName: "short",
//   });
// }

function formatDate(date) {
  const options = {
    day: "2-digit",
    month: "short",
  };
  return new Date(date).toLocaleDateString("en-US", options);
}
