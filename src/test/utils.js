import { Database } from "../db/conn.js";
import {
  REWARDS_TEST_COLLECTION,
  TRANSFERS_TEST_COLLECTION,
  USERS_TEST_COLLECTION,
} from "../utils/constants.js";

export const dbMock = await Database.getInstance("unit-test");
export const collectionUsersMock = dbMock.collection(USERS_TEST_COLLECTION);
export const collectionRewardsMock = dbMock.collection(REWARDS_TEST_COLLECTION);
export const collectionTransfersMock = dbMock.collection(
  TRANSFERS_TEST_COLLECTION
);

export const mockUserTelegramID = "2114356934";
export const mockResponsePath = "64d170d6dc5a2a45328ad6f6/c/43320456";
export const mockUserHandle = "myUserHandle";
export const mockUserName = "myUserName";
export const mockWallet = "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5";
export const mockAccessToken =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const mockTransactionHash =
  "0xd7ca91c2ed1c33fc97366861487e731f0eacbec2bdb76cd09b34679e6cade9b3";
