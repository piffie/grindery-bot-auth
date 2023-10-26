import {
  REWARDS_COLLECTION,
} from './constants.js';

async function updateRewardDB(
    db,
    params
  ) {
    try {
      const $set = {};
  
      if (params.eventId) $set.eventId = params.eventId;
      if (params.userTelegramID) $set.userTelegramID = params.userTelegramID;
      if (params.responsePath) $set.responsePath = params.responsePath;
      if (params.walletAddress) $set.walletAddress = params.walletAddress;
      if (params.reason) $set.reason = params.reason;
      if (params.userHandle) $set.userHandle = params.userHandle;
      if (params.userName) $set.userName = params.userName;
      if (params.amount) $set.amount = params.amount;
      if (params.message) $set.message = params.message;
      if (params.transactionHash) $set.transactionHash = params.transactionHash;
      if (params.status) $set.status = params.status;
      if (params.dateAdded) $set.dateAdded = params.dateAdded;
      if (params.userOpHash) $set.userOpHash = params.userOpHash;
      if (params.newUserAddress) $set.newUserAddress = params.newUserAddress;
      if (params.parentTransactionHash) $set.parentTransactionHash = params.parentTransactionHash;
      if (params.sponsoredUserTelegramID) $set.sponsoredUserTelegramID = params.sponsoredUserTelegramID;
  
      const result = await db.collection(REWARDS_COLLECTION).updateOne(
        {
          userTelegramID: params.userTelegramID,
          eventId: params.eventId,
          reason: params.reason,
        },
        {
          $set
        },
        { upsert: true }
      );
  
      return result;
    } catch (error) {
      throw error;
    }
}
  
export const reward_helpers = {
  updateRewardDB
};