import { Db, WithId } from 'mongodb';
import { Database } from '../db/conn';
import { REWARDS_COLLECTION, USERS_COLLECTION } from './constants';
import { getPatchWalletAddressFromTgId } from './patchwallet';
import { addIdentitySegment } from './segment';
import { NewUserParams } from '../types/webhook.types';
import {
  MongoReward,
  MongoUser,
  TelegramUserId,
} from 'grindery-nexus-common-utils';
import { MongoUserWithAttributes, UserAttributes } from '../types/mongo.types';

/**
 * Represents a NewUserTelegram.
 */
export class NewUserTelegram {
  /**
   * The parameters used to create the NewUserTelegram instance.
   */
  params: NewUserParams;

  /**
   * Indicates whether the user exists in the database.
   */
  isInDatabase: boolean = false;

  /**
   * The database instance associated with the user.
   */
  db: Db | null;

  /**
   * Constructs a new NewUserTelegram instance.
   * @param params - The parameters used to create the NewUserTelegram instance.
   */
  constructor(params: NewUserParams) {
    this.params = params;
    this.isInDatabase = false;
  }

  /**
   * Builds a NewUserTelegram instance.
   * @param params - The parameters used to build the NewUserTelegram instance.
   * @returns A Promise that resolves with a NewUserTelegram instance.
   */
  static async build(params: NewUserParams): Promise<NewUserTelegram> {
    // Create a new NewUserTelegram instance
    const user = new NewUserTelegram(params);

    // Get the database instance
    user.db = await Database.getInstance();

    // Retrieve user data from the database
    const userDB = await user.getUserFromDatabase();

    // Check if user data exists in the database
    if (userDB) {
      user.isInDatabase = true;
      user.params.patchwallet = userDB.patchwallet;
    } else {
      // If user data doesn't exist in the database, attempt to get patchwallet address
      try {
        user.params.patchwallet = await getPatchWalletAddressFromTgId(
          user.params.userTelegramID,
        );
      } catch (error) {
        // Handle error if fetching patchwallet address fails
        console.error('Error:', error);
      }
    }

    // Return the built NewUserTelegram instance
    return user;
  }

  /**
   * Retrieves user data from the database.
   * @returns {Promise<WithId<MongoUser>>} - The user data from the database.
   */
  async getUserFromDatabase(): Promise<WithId<MongoUser> | null> {
    if (this.db)
      return (await this.db.collection(USERS_COLLECTION).findOne({
        userTelegramID: this.params.userTelegramID,
      })) as WithId<MongoUser> | null;
    return null;
  }

  /**
   * Checks if the user is in the database.
   * @returns {Promise<boolean>} - `true` if the user is in the database, `false` otherwise.
   */
  async isUserInDatabase(): Promise<boolean> {
    this.isInDatabase = !!(await this.getUserFromDatabase());
    return this.isInDatabase;
  }

  /**
   * Saves user data to the database.
   * @param {string} eventId - The event identifier.
   * @returns {Promise<void>} - The result of the database operation or `undefined` if the user is already in the database.
   */
  async saveToDatabase(eventId: string): Promise<void> {
    if (this.isInDatabase) return;

    await this.db?.collection(USERS_COLLECTION).updateOne(
      { userTelegramID: this.params.userTelegramID },
      {
        $set: {
          userTelegramID: this.params.userTelegramID,
          userHandle: this.params.userHandle,
          userName: this.params.userName,
          responsePath: this.params.responsePath,
          patchwallet: this.params.patchwallet,
          dateAdded: new Date(),
        },
      },
      { upsert: true },
    );

    console.log(
      `[${eventId}] ${this.params.userTelegramID} added to the user database.`,
    );
  }

  /**
   * Saves user data to a segmentation system.
   * @param {string} eventId - The event identifier.
   * @returns {Promise<void>} - The result of the operation or `undefined` if the user is already in the database.
   */
  async saveToSegment(eventId: string): Promise<void> {
    if (this.isInDatabase) return;

    try {
      await addIdentitySegment({
        ...this.params,
        dateAdded: new Date(),
      });

      console.log(
        `[${eventId}] ${this.params.userTelegramID} added to Segment.`,
      );
    } catch (error) {
      console.error(
        `[${eventId}] Error processing new user in Segment: ${error}`,
      );
    }
  }

  /**
   * Retrieves the sign-up rewards for the user.
   * @returns {Promise<Array>} - An array of sign-up rewards.
   */
  async getSignUpReward(): Promise<WithId<MongoReward>[] | []> {
    if (this.db)
      return (await this.db
        .collection(REWARDS_COLLECTION)
        .find({
          userTelegramID: this.params.userTelegramID,
          reason: 'user_sign_up',
        })
        .toArray()) as WithId<MongoReward>[] | [];
    return [];
  }

  /**
   * Checks if the user has sign-up rewards.
   * @returns {Promise<boolean>} - `true` if the user has sign-up rewards, `false` otherwise.
   */
  async hasSignUpReward(): Promise<boolean> {
    return (await this.getSignUpReward()).length > 0;
  }

  /**
   * Retrieves referral rewards for the user.
   * @returns {Promise<Array>} - An array of referral rewards.
   */
  async getReferralRewards(): Promise<WithId<MongoReward>[] | []> {
    if (this.db)
      return (await this.db
        .collection(REWARDS_COLLECTION)
        .find({
          userTelegramID: this.params.userTelegramID,
          reason: '2x_reward',
        })
        .toArray()) as WithId<MongoReward>[] | [];
    return [];
  }

  /**
   * Retrieves the number of referral rewards for the user.
   * @returns {Promise<number>} - The number of referral rewards.
   */
  async getNbrReferralRewards(): Promise<number> {
    return (await this.getReferralRewards()).length;
  }

  /**
   * Retrieves link rewards for the user.
   * @returns {Promise<Array>} - An array of link rewards.
   */
  async getLinkRewards(): Promise<WithId<MongoReward>[] | []> {
    if (this.db)
      return (await this.db
        .collection(REWARDS_COLLECTION)
        .find({
          userTelegramID: this.params.userTelegramID,
          reason: 'referral_link',
        })
        .toArray()) as WithId<MongoReward>[] | [];
    return [];
  }

  /**
   * Retrieves the number of link rewards for the user.
   * @returns {Promise<number>} - The number of link rewards.
   */
  async getNbrLinkRewards(): Promise<number> {
    return (await this.getLinkRewards()).length;
  }
}

/**
 * Represents a user on the Telegram platform with associated attributes.
 */
export class UserTelegram {
  /**
   * The unique Telegram user ID.
   */
  userTelegramID: TelegramUserId;

  /**
   * Indicates whether the user exists in the database.
   */
  isInDatabase: boolean = false;

  /**
   * The database instance associated with the user.
   */
  db: Db | null;

  /**
   * The user parameters retrieved from the database.
   */
  params?: WithId<MongoUserWithAttributes>;

  /**
   * Constructs a new UserTelegram instance.
   * @param userTelegramID - The unique Telegram user ID.
   */
  constructor(userTelegramID: TelegramUserId) {
    this.userTelegramID = userTelegramID;
    this.isInDatabase = false;
  }

  /**
   * Creates a UserTelegram instance with the given user Telegram ID.
   * @param {TelegramUserId} userTelegramID - The user Telegram ID.
   * @returns {Promise<UserTelegram>} A Promise resolving to a UserTelegram instance.
   * @throws {Error} Throws an error if there is an issue fetching user data from the database.
   */
  static async build(userTelegramID: TelegramUserId): Promise<UserTelegram> {
    // Create a new UserTelegram instance with the provided user Telegram ID.
    const user = new UserTelegram(userTelegramID);

    // Get the database instance.
    user.db = await Database.getInstance();

    // Fetch user data from the database based on the user Telegram ID.
    const userDB = await user.getUserFromDatabase();

    // If user data is found in the database, update the instance properties.
    if (userDB) {
      user.isInDatabase = true;
      user.params = userDB;
    }

    // Return the UserTelegram instance.
    return user;
  }

  /**
   * Retrieves user data from the database.
   * @returns {Promise<WithId<MongoUserWithAttributes>>} - The user data from the database.
   */
  async getUserFromDatabase(): Promise<WithId<MongoUserWithAttributes> | null> {
    if (this.db)
      return (await this.db.collection(USERS_COLLECTION).findOne({
        userTelegramID: this.userTelegramID,
      })) as WithId<MongoUserWithAttributes> | null;
    return null;
  }

  /**
   * Checks if the user is in the database.
   * @returns {Promise<boolean>} - `true` if the user is in the database, `false` otherwise.
   */
  async isUserInDatabase(): Promise<boolean> {
    this.isInDatabase = !!(await this.getUserFromDatabase());
    return this.isInDatabase;
  }

  /**
   * Retrieves the sign-up rewards for the user.
   * @returns {Promise<Array>} - An array of sign-up rewards.
   */
  async getSignUpReward(): Promise<WithId<MongoReward>[] | []> {
    if (this.db)
      return (await this.db
        .collection(REWARDS_COLLECTION)
        .find({
          userTelegramID: this.userTelegramID,
          reason: 'user_sign_up',
        })
        .toArray()) as WithId<MongoReward>[] | [];
    return [];
  }

  /**
   * Checks if the user has sign-up rewards.
   * @returns {Promise<boolean>} - `true` if the user has sign-up rewards, `false` otherwise.
   */
  async hasSignUpReward(): Promise<boolean> {
    return (await this.getSignUpReward()).length > 0;
  }

  /**
   * Retrieves referral rewards for the user.
   * @returns {Promise<Array>} - An array of referral rewards.
   */
  async getReferralRewards(): Promise<WithId<MongoReward>[] | []> {
    if (this.db)
      return (await this.db
        .collection(REWARDS_COLLECTION)
        .find({
          userTelegramID: this.userTelegramID,
          reason: '2x_reward',
        })
        .toArray()) as WithId<MongoReward>[] | [];
    return [];
  }

  /**
   * Retrieves the number of referral rewards for the user.
   * @returns {Promise<number>} - The number of referral rewards.
   */
  async getNbrReferralRewards(): Promise<number> {
    return (await this.getReferralRewards()).length;
  }

  /**
   * Retrieves link rewards for the user.
   * @returns {Promise<Array>} - An array of link rewards.
   */
  async getLinkRewards(): Promise<WithId<MongoReward>[] | []> {
    if (this.db)
      return (await this.db
        .collection(REWARDS_COLLECTION)
        .find({
          userTelegramID: this.userTelegramID,
          reason: 'referral_link',
        })
        .toArray()) as WithId<MongoReward>[] | [];
    return [];
  }

  /**
   * Retrieves the number of link rewards for the user.
   * @returns {Promise<number>} - The number of link rewards.
   */
  async getNbrLinkRewards(): Promise<number> {
    return (await this.getLinkRewards()).length;
  }

  /**
   * Returns the user handle.
   * @returns {string | undefined} The user handle, or undefined if not present.
   */
  userHandle(): string | undefined {
    return this.params?.userHandle;
  }

  /**
   * Returns the user name.
   * @returns {string | undefined} The user name, or undefined if not present.
   */
  userName(): string | undefined {
    return this.params?.userName;
  }

  /**
   * Returns the patchwallet address.
   * @returns {string | undefined} The patchwallet address, or undefined if not present.
   */
  patchwalletAddress(): string | undefined {
    return this.params?.patchwallet;
  }

  /**
   * Returns the response path.
   * @returns {string | undefined} The response path, or undefined if not present.
   */
  responsePath(): string | undefined {
    return this.params?.responsePath;
  }

  /**
   * Returns the user Telegram ID.
   * @returns {string} The user Telegram ID.
   */
  getUserTelegramID(): string {
    return this.userTelegramID;
  }

  /**
   * Returns the user attributes.
   * @returns {UserAttributes | undefined} The user attributes, or undefined if not present.
   */
  attributes(): UserAttributes | undefined {
    return this.params?.attributes;
  }

  /**
   * Returns the MVU score as a number.
   * @returns {number | undefined} The MVU score, or undefined if not present or invalid.
   */
  getMvu(): number | undefined {
    if (this.params && this.params.attributes.mvu_score) {
      const parsedMvu = parseFloat(this.params.attributes.mvu_score);
      if (!(isNaN(parsedMvu) && parsedMvu <= 0)) return parsedMvu;
    }
    return undefined;
  }

  /**
   * Returns the virtual balance as a number.
   * @returns {number | undefined} The virtual balance, or undefined if not present or invalid.
   */
  getVirtualBalance(): number | undefined {
    if (this.params && this.params.attributes.virtual_balance) {
      const parsedVirtualBalance = parseFloat(
        this.params.attributes.virtual_balance,
      );
      if (!(isNaN(parsedVirtualBalance) && parsedVirtualBalance <= 0))
        return parsedVirtualBalance;
    }
    return undefined;
  }
}
