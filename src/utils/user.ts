import { Db, WithId } from 'mongodb';
import { Database } from '../db/conn';
import { REWARDS_COLLECTION, USERS_COLLECTION } from './constants';
import { getPatchWalletAddressFromTgId } from './patchwallet';
import { addIdentitySegment } from './segment';
import { RewardParams } from '../types/webhook.types';
import { MongoReward, MongoUser } from 'grindery-nexus-common-utils';

/**
 * Represents a UserTelegram.
 */
export class UserTelegram {
  /**
   * The parameters used to create the UserTelegram instance.
   */
  params: RewardParams;

  /**
   * Indicates whether the user exists in the database.
   */
  isInDatabase: boolean = false;

  /**
   * The database instance associated with the user.
   */
  db: Db | null;

  /**
   * Constructs a new UserTelegram instance.
   * @param params - The parameters used to create the UserTelegram instance.
   */
  constructor(params: RewardParams) {
    this.params = params;
    this.isInDatabase = false;
  }

  /**
   * Builds a UserTelegram instance.
   * @param params - The parameters used to build the UserTelegram instance.
   * @returns A Promise that resolves with a UserTelegram instance.
   */
  static async build(params: RewardParams): Promise<UserTelegram> {
    // Create a new UserTelegram instance
    const user = new UserTelegram(params);

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

    // Return the built UserTelegram instance
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
  async HasSignUpReward(): Promise<boolean> {
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
