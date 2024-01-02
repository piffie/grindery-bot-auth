import {
  REWARDS_COLLECTION,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
} from './constants';
import { Db, ObjectId } from 'mongodb';
import { formatDate } from './time';
import {
  IncomingTransaction,
  OutgoingTransaction,
} from '../types/tx_formatting.types';

/**
 * Retrieves incoming transactions for a user from the database.
 * @param db The MongoDB database instance.
 * @param userId The user's Telegram ID.
 * @param start The starting index for pagination.
 * @param limit The limit of transactions to fetch.
 * @returns A Promise resolving to an array of transactions.
 */
export async function getIncomingTxsUser(
  db: Db,
  userId: string,
  start: number,
  limit: number,
): Promise<IncomingTransaction[]> {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .find({ recipientTgId: userId })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()
    ).map(
      async (entry) =>
        ({
          ...entry,
          dateAdded: formatDate(entry.dateAdded),
          senderUserHandle:
            (
              await db
                .collection(USERS_COLLECTION)
                .findOne({ userTelegramID: entry.senderTgId })
            )?.userHandle || null,
        } as IncomingTransaction),
    ),
  );
}

/**
 * Retrieves outgoing transactions for a user from the database.
 * @param db The MongoDB database instance.
 * @param userId The user's Telegram ID.
 * @param start The starting index for pagination.
 * @param limit The limit of transactions to fetch.
 * @returns A Promise resolving to an array of transactions.
 */
export async function getOutgoingTxsUser(
  db: Db,
  userId: string,
  start: number,
  limit: number,
): Promise<OutgoingTransaction[]> {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .find({ senderTgId: userId })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()
    ).map(
      async (entry) =>
        ({
          ...entry,
          dateAdded: formatDate(entry.dateAdded),
          recipientUserHandle:
            (
              await db
                .collection(USERS_COLLECTION)
                .findOne({ userTelegramID: entry.recipientTgId })
            )?.userHandle || null,
        } as OutgoingTransaction),
    ),
  );
}

/**
 * Retrieves outgoing transactions to new users from the database.
 * @param db The MongoDB database instance.
 * @param userId The user's Telegram ID.
 * @param start The starting index for pagination.
 * @param limit The limit of transactions to fetch.
 * @returns A Promise resolving to an array of transactions.
 */
export async function getOutgoingTxsToNewUsers(
  db: Db,
  userId: string,
  start: number,
  limit: number,
): Promise<OutgoingTransaction[]> {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .aggregate([
          {
            $match: {
              senderTgId: userId,
              recipientTgId: { $ne: null },
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'recipientTgId',
              foreignField: 'userTelegramID',
              as: 'user',
            },
          },
          {
            $match: {
              user: { $size: 0 },
            },
          },
          {
            $project: {
              user: 0,
            },
          },
          {
            $sort: {
              dateAdded: -1,
            },
          },
          {
            $skip: start,
          },
          ...(limit > 0
            ? [
                {
                  $limit: limit,
                },
              ]
            : []),
        ])
        .toArray()
    ).map(
      async (entry) =>
        ({
          ...entry,
          dateAdded: formatDate(entry.dateAdded),
        } as OutgoingTransaction),
    ),
  );
}

/**
 * Represents a transaction involving rewards in the system.
 */
type RewardTransaction = {
  /**
   * The date when the reward transaction was added.
   */
  dateAdded: string;

  /**
   * A descriptive message associated with the reward transaction.
   */
  message: string;

  /**
   * The unique identifier of the reward transaction.
   */
  _id: ObjectId;

  /**
   * The amount of tokens associated with the reward transaction.
   */
  amount: string;
};

/**
 * Retrieves reward transactions for a user from the database.
 * @param db The MongoDB database instance.
 * @param userId The user's Telegram ID.
 * @param start The starting index for pagination.
 * @param limit The limit of transactions to fetch.
 * @returns An array of reward transactions.
 */
export async function getRewardTxsUser(
  db: Db,
  userId: string,
  start: number,
  limit: number,
): Promise<RewardTransaction[]> {
  return (
    await db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: userId })
      .sort({ dateAdded: -1 })
      .skip(start)
      .limit(limit)
      .toArray()
  ).map(
    (entry) =>
      ({
        ...entry,
        dateAdded: formatDate(entry.dateAdded),
      } as RewardTransaction),
  );
}

/**
 * Retrieves referral link reward transactions for a user from the database.
 * @param db The MongoDB database instance.
 * @param userId The user's Telegram ID.
 * @param start The starting index for pagination.
 * @param limit The limit of transactions to fetch.
 * @returns A Promise resolving to an array of transactions.
 */
export async function getRewardLinkTxsUser(
  db: Db,
  userId: string,
  start: number,
  limit: number,
) {
  return await Promise.all(
    (
      await db
        .collection(REWARDS_COLLECTION)
        .find({ userTelegramID: userId, reason: 'referral_link' })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()
    ).map(async (entry) => ({
      ...entry,
      dateAdded: formatDate(entry.dateAdded),
      sponsoredUserHandle:
        (
          await db
            .collection(USERS_COLLECTION)
            .findOne({ userTelegramID: entry.sponsoredUserTelegramID })
        )?.userHandle || null,
    })),
  );
}
