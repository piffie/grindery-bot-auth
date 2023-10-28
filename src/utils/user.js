import { Database } from '../db/conn';
import { REWARDS_COLLECTION, USERS_COLLECTION } from './constants';
import { addIdentitySegment } from './segment';

export class User {
  constructor(telegramID, responsePath, patchwallet, userHandle, userName) {
    this.telegramID = telegramID;
    this.responsePath = responsePath;
    this.patchwallet = patchwallet;
    this.userHandle = userHandle;
    this.userName = userName;
    this.isUserInDatabase = false;
    this.initializeUserDatabase();
  }

  async initializeUserDatabase() {
    this.isUserInDatabase = await this.isInDatabase();
    this.db = await Database.getInstance();
  }

  async isInDatabase() {
    this.isUserInDatabase = (await this.db
      .collection(USERS_COLLECTION)
      .findOne({ userTelegramID: this.telegramID }))
      ? true
      : false;

    return this.isUserInDatabase;
  }

  async saveToDatabase() {
    if (this.isUserInDatabase) {
      return undefined;
    }

    return await this.db.collection(USERS_COLLECTION).insertOne({
      userTelegramID: this.telegramID,
      userHandle: this.userHandle,
      userName: this.userName,
      responsePath: this.responsePath,
      patchwallet: this.patchwallet,
      dateAdded: new Date(),
    });
  }

  async saveToSegment() {
    if (this.isUserInDatabase) {
      return undefined;
    }

    return await addIdentitySegment({
      responsePath: this.responsePath,
      userHandle: this.userHandle,
      userName: this.userName,
      patchwallet: this.patchwallet,
      dateAdded: new Date(),
    });
  }

  async getSignUpReward() {
    return await this.db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: this.telegramID, reason: 'user_sign_up' })
      .toArray();
  }

  async HasSignUpReward() {
    return (await getSignUpReward()).length > 0 ? true : false;
  }

  async getReferralRewards() {
    return await this.db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: this.telegramID, reason: '2x_reward' })
      .toArray();
  }

  async getNbrReferralRewards() {
    return (await getReferralRewards()).length;
  }

  async getLinkRewards() {
    return await this.db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: this.telegramID, reason: 'referral_link' })
      .toArray();
  }

  async getNbrLinkRewards() {
    return (await getLinkRewards()).length;
  }
}
