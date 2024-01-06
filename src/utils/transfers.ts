import {
  REWARDS_COLLECTION,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
} from './constants';
import { Db, WithId } from 'mongodb';
import { formatDate } from './time';
import {
  MongoIncomingTransfer,
  MongoOutgoingTransfer,
  MongoRewardFmt,
} from '../types/mongo.types';
import { TransactionStatus } from 'grindery-nexus-common-utils';

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
): Promise<WithId<MongoIncomingTransfer>[]> {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .find({ recipientTgId: userId, status: TransactionStatus.SUCCESS })
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
        } as WithId<MongoIncomingTransfer>),
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
): Promise<WithId<MongoOutgoingTransfer>[]> {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .find({ senderTgId: userId, status: TransactionStatus.SUCCESS })
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
        } as WithId<MongoOutgoingTransfer>),
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
): Promise<WithId<MongoOutgoingTransfer>[]> {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .aggregate([
          {
            $match: {
              senderTgId: userId,
              recipientTgId: { $ne: null },
              status: TransactionStatus.SUCCESS,
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
        } as WithId<MongoOutgoingTransfer>),
    ),
  );
}

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
): Promise<WithId<MongoRewardFmt>[]> {
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
      } as WithId<MongoRewardFmt>),
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
): Promise<WithId<MongoRewardFmt>[]> {
  return await Promise.all(
    (
      await db
        .collection(REWARDS_COLLECTION)
        .find({ userTelegramID: userId, reason: 'referral_link' })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()
    ).map(
      async (entry) =>
        ({
          ...entry,
          dateAdded: formatDate(entry.dateAdded),
          sponsoredUserHandle:
            (
              await db
                .collection(USERS_COLLECTION)
                .findOne({ userTelegramID: entry.sponsoredUserTelegramID })
            )?.userHandle || null,
        } as WithId<MongoRewardFmt>),
    ),
  );
}
