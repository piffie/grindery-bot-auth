import { Database } from '../db/conn.js';
import { REWARDS_COLLECTION, USERS_COLLECTION } from './constants.js';
import { getPatchWalletAddressFromTgId } from './patchwallet.js';
import { addIdentitySegment } from './segment.js';

export async function createUserTelegram(
  telegramID,
  responsePath,
  userHandle,
  userName
) {
  const user = new UserTelegram(telegramID, responsePath, userHandle, userName);
  await user.initializeUserDatabase();
  return user;
}

export class UserTelegram {
  constructor(telegramID, responsePath, userHandle, userName) {
    this.telegramID = telegramID;
    this.responsePath = responsePath;
    this.patchwallet = undefined;
    this.userHandle = userHandle;
    this.userName = userName;
    this.isInDatabase = false;
  }

  async initializeUserDatabase() {
    this.db = await Database.getInstance();

    const userDB = await this.getUserFromDatabase();

    if (userDB) {
      this.isInDatabase = true;
      this.patchwallet = userDB.patchwallet;
    } else {
      try {
        this.patchwallet = await getPatchWalletAddressFromTgId(this.telegramID);
      } catch (error) {}
    }
  }

  async getUserFromDatabase() {
    return await this.db
      .collection(USERS_COLLECTION)
      .findOne({ userTelegramID: this.telegramID });
  }

  async isUserInDatabase() {
    this.isInDatabase = (await this.getUserFromDatabase()) ? true : false;
    return this.isInDatabase;
  }

  async saveToDatabase(eventId) {
    if (this.isInDatabase) {
      return undefined;
    }

    const user = await this.db.collection(USERS_COLLECTION).insertOne({
      userTelegramID: this.telegramID,
      userHandle: this.userHandle,
      userName: this.userName,
      responsePath: this.responsePath,
      patchwallet: this.patchwallet,
      dateAdded: new Date(),
    });

    console.log(`[${eventId}] ${this.telegramID} added to the user database.`);

    return user;
  }

  async saveToSegment(eventId) {
    if (this.isInDatabase) {
      return undefined;
    }

    try {
      const identitySegment = await addIdentitySegment({
        userTelegramID: this.telegramID,
        responsePath: this.responsePath,
        userHandle: this.userHandle,
        userName: this.userName,
        patchwallet: this.patchwallet,
        dateAdded: new Date(),
      });

      console.log(`[${eventId}] ${this.telegramID} added to Segment.`);

      return identitySegment;
    } catch (error) {
      console.error(
        `[${eventId}] Error processing new user in Segment: ${error}`
      );
    }

    return undefined;
  }

  async getSignUpReward() {
    return await this.db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: this.telegramID, reason: 'user_sign_up' })
      .toArray();
  }

  async HasSignUpReward() {
    return (await this.getSignUpReward()).length > 0 ? true : false;
  }

  async getReferralRewards() {
    return await this.db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: this.telegramID, reason: '2x_reward' })
      .toArray();
  }

  async getNbrReferralRewards() {
    return (await this.getReferralRewards()).length;
  }

  async getLinkRewards() {
    return await this.db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: this.telegramID, reason: 'referral_link' })
      .toArray();
  }

  async getNbrLinkRewards() {
    return (await this.getLinkRewards()).length;
  }
}
