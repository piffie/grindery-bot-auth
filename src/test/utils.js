import { Database } from '../db/conn.js';
import {
  REWARDS_COLLECTION,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
} from '../utils/constants.js';

export const dbMock = await Database.getInstance('unit-test');
export const collectionUsersMock = dbMock.collection(USERS_COLLECTION);
export const collectionRewardsMock = dbMock.collection(REWARDS_COLLECTION);
export const collectionTransfersMock = dbMock.collection(TRANSFERS_COLLECTION);

export const mockUserTelegramID = '2114356934';
export const mockResponsePath = '64d170d6dc5a2a45328ad6f6/c/43320456';
export const mockUserHandle = 'myUserHandle';
export const mockUserName = 'myUserName';
export const mockWallet = '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5';

export const mockUserTelegramID1 = '2114356931';
export const mockResponsePath1 = '64d170d6dc5a2a45328ad6f6/c/43320452';
export const mockUserHandle1 = 'myUserHandle1';
export const mockUserName1 = 'myUserName1';
export const mockWallet1 = '0x594CfCaa67Bc8789D17D39eb5F1DfC7dD95242cd';

export const mockAccessToken =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const mockTransactionHash =
  '0xd7ca91c2ed1c33fc97366861487e731f0eacbec2bdb76cd09b34679e6cade9b3';
export const mockTransactionHash1 =
  '0x93c0ca80f2171b05b68531d176183efcbad940265be5e21b1c12d6f321bd44b9';
export const mockTransactionHash2 =
  '0x88be0d614f53ab6cc1339194356980711765ea1511105d4c582e79c099402911';
export const mockUserOpHash =
  '0x938cfe7b1fd476d96965d0dfecf86097bb05502856c8eabf175deac507328f3e';
export const mockUserOpHash1 =
  '0xacdf0f6fa96a50ca250f759dcd9502c3a16c65b076d6114fc5c53a832897e0a0';

export const segmentIdentifyUrl = 'https://api.segment.io/v1/identify';
export const segmentTrackUrl = 'https://api.segment.io/v1/track';
export const patchwalletResolverUrl = 'https://paymagicapi.com/v1/resolver';
export const patchwalletAuthUrl = 'https://paymagicapi.com/v1/auth';
export const patchwalletTxUrl = 'https://paymagicapi.com/v1/kernel/tx';
export const patchwalletTxStatusUrl =
  'https://paymagicapi.com/v1/kernel/userOpHash';
