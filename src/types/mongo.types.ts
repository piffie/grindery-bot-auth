import {
  MongoReward,
  MongoTransfer,
  MongoUser,
} from 'grindery-nexus-common-utils';

/**
 * Represents a MongoDB document for Incoming Transfer transactions.
 */
export type MongoIncomingTransfer = MongoTransfer & {
  /** Date when the transfer was added - Represented as a string */
  dateAdded: string;

  /** Sender's user handle, if available. Can be null. */
  senderUserHandle: string | null;
};

/**
 * Represents a MongoDB document for Outgoing Transfer transactions.
 */
export type MongoOutgoingTransfer = MongoTransfer & {
  /** Date when the transfer was added - Represented as a string */
  dateAdded: string;

  /** Recipient's user handle, if available. Can be null. */
  recipientUserHandle?: string | null;
};

/**
 * Represents a MongoDB document for Formatted Reward transactions.
 */
export type MongoRewardFmt = MongoReward & {
  /** Date when the reward was added - Represented as a string */
  dateAdded: string;

  /** Sponsored user's handle, if available. Can be null. */
  sponsoredUserHandle?: string | null;
};

/**
 * Represents a user with additional attributes stored in the MongoDB database.
 */
export type MongoUserWithAttributes = MongoUser & {
  /**
   * The attributes associated with the user.
   */
  attributes: UserAttributes;
};

/**
 * Represents the attributes of a user stored in the database.
 */
export type UserAttributes = {
  /**
   * The affinity score of the user.
   */
  aff_score: string | null;

  /**
   * The balance in 100123 currency units.
   */
  balance_100123: string | null;

  /**
   * The host score of the user.
   */
  host_score: string | null;

  /**
   * Indicates if the user is currently active.
   */
  isActiveUser: boolean;

  /**
   * Indicates if the user is blacklisted.
   */
  isBlacklist: boolean;

  /**
   * Indicates if the user is a contributing user.
   */
  isContributeUser: boolean;

  /**
   * Indicates if the user is considered dead.
   */
  isDead: boolean;

  /**
   * Indicates if the user's funds are double-spent.
   */
  isDoubleSpent: boolean;

  /**
   * Indicates if the user is a drone.
   */
  isDrone: boolean;

  /**
   * Indicates if the user owns a drone.
   */
  isDroneOwner: boolean;

  /**
   * Indicates if the user is a gamer.
   */
  isGamer: boolean;

  /**
   * Indicates if the user is a slave.
   */
  isSlave: boolean;

  /**
   * Indicates if the user is considered walking dead.
   */
  isWalkingDead: boolean;

  /**
   * The rounded MVU score of the user.
   */
  mvu_rounded: string | null;

  /**
   * The MVU score of the user.
   */
  mvu_score: string | null;

  /**
   * The virtual balance of the user.
   */
  virtual_balance: string | null;
};
