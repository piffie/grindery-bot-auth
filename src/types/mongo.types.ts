import { MongoReward, MongoTransfer } from 'grindery-nexus-common-utils';

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
