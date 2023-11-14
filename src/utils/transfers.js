import {
  REWARDS_COLLECTION,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
} from './constants.js';

export async function getIncomingTxsUser(db, userId, start, limit) {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .find({ recipientTgId: userId })
        .sort({ dateAdded: -1 })
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
        .sort({ dateAdded: -1 })
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

export async function getOutgoingTxsToNewUsers(db, userId, start, limit) {
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
    ).map(async (entry) => ({
      ...entry,
      dateAdded: formatDate(entry.dateAdded),
    }))
  );
}

export async function getRewardTxsUser(db, userId, start, limit) {
  return (
    await db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: userId })
      .sort({ dateAdded: -1 })
      .skip(start)
      .limit(limit)
      .toArray()
  ).map((entry) => ({
    ...entry,
    dateAdded: formatDate(entry.dateAdded),
  }));
}

export async function getRewardLinkTxsUser(db, userId, start, limit) {
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
    }))
  );
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
  });
}
