import { Database } from "../db/conn.js";
import { TRANSFERS_COLLECTION } from "./constants.js";

export async function getIncomingTxsUser(db, userId) {
  return (
    await db
      .collection(TRANSFERS_COLLECTION)
      .find({ recipientTgId: userId })
      .toArray()
  ).map((entry) => ({
    ...entry,
    dateAdded: formatDate(entry.dateAdded),
  }));
}

export async function getOutcomingTxsUser(db, userId) {
  return (
    await db
      .collection(TRANSFERS_COLLECTION)
      .find({ senderTgId: userId })
      .toArray()
  ).map((entry) => ({
    ...entry,
    dateAdded: formatDate(entry.dateAdded),
  }));
}

function formatDate(date) {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
