import { WithId } from 'mongodb';
import { DEFAULT_CHAIN_ID, G1_TOKEN_SYMBOL } from '../utils/constants';
import { G1_POLYGON_ADDRESS } from '../../secrets';
import { SwapTelegram } from '../webhooks/swap';
import { TransferTelegram } from '../webhooks/transaction';
import { VestingTelegram } from '../webhooks/vesting';
import { SignUpRewardTelegram } from '../webhooks/signup-reward';
import { ReferralRewardTelegram } from '../webhooks/referral-reward';
import { LinkRewardTelegram } from '../webhooks/link-reward';
import { IsolatedRewardTelegram } from '../webhooks/isolated-reward';
import { MongoUser, TransactionStatus } from 'grindery-nexus-common-utils';
import { OrderTelegram } from '../webhooks/order';

/**
 * Defines the structure for SwapParams.
 */
export type SwapParams = {
  /** The value of the swap. */
  value: string;

  /** The event ID associated with the swap. */
  eventId: string;

  /** The Telegram user ID associated with the swap. */
  userTelegramID: string;

  /** Additional user information with MongoDB document ID. */
  userInformation?: WithId<MongoUser>;

  /** The recipient wallet address. */
  to?: string;

  /** Additional data for the swap. */
  data?: string;

  /** The input token for the swap. */
  tokenIn: string;

  /** The amount of input tokens. */
  amountIn: string;

  /** The output token for the swap. */
  tokenOut: string;

  /** The amount of output tokens. */
  amountOut: string;

  /** The price impact of the swap. */
  priceImpact: string;

  /** The gas value for the swap. */
  gas: string;

  /** The sender's address for the swap. */
  from: string;

  /** The symbol of the input token. */
  tokenInSymbol: string;

  /** The symbol of the output token. */
  tokenOutSymbol: string;

  /** The chain ID for the swap. */
  chainId?: string;

  /** Additional amount information for the swap. */
  amount?: string;

  /** The Telegram user ID of the sender. */
  senderTgId?: string;

  /**
   * Represents whether the transaction is a delegate call.
   * - `0` for non-delegate call
   * - `1` for delegate call
   */
  delegatecall?: 0 | 1;

  /** The chain in ID for the swap/bridge. */
  chainIn?: string;

  /** The chain out ID for the swap/bridge. */
  chainOut?: string;
};

/**
 * Creates swap parameters by merging the provided parameters with default values.
 * @param params The parameters for the swap.
 * @returns Swap parameters with default values for missing parameters.
 */
export function createSwapParams(
  params: SwapParams,
  userInformation: WithId<MongoUser>,
): SwapParams {
  return {
    ...{
      chainId: DEFAULT_CHAIN_ID,
      delegatecall: 0,
    },
    ...params,
    userInformation,
  };
}

/**
 * Defines the structure for TrackSwapSegmentParams.
 * Extends SwapParams and includes additional fields for tracking swap segments.
 */
export type TrackSwapSegmentParams = SwapParams & {
  /** The status of the swap transaction. Must be one of the TransactionStatus values. */
  status: TransactionStatus;
  /** The hash associated with the transaction. */
  transactionHash: string;
  /** The date when the segment was added. */
  dateAdded: Date;
};

/**
 * Defines the structure for NewUserParams.
 */
export type NewUserParams = {
  /** The event ID associated with the reward. */
  eventId: string;

  /** The Telegram user ID associated with the reward. */
  userTelegramID: string;

  /** The path for the response. */
  responsePath?: string;

  /** The handle of the user. */
  userHandle?: string;

  /** The name of the user. */
  userName?: string;

  /** The wallet patch information. */
  patchwallet?: string;

  /** The reason for the reward. */
  reason?: string;

  /** The message associated with the reward. */
  message?: string;

  /** The amount for the reward. */
  amount?: string;

  /** The token address for the reward. */
  tokenAddress?: string;

  /** The chain id for the reward. */
  chainId?: string;

  /** The Telegram user ID of the referent. */
  referentUserTelegramID?: string;

  /** Specifies if there is a signup reward. */
  isSignupReward?: boolean;

  /** Specifies if there is a referral reward. */
  isReferralReward?: boolean;

  /** Specifies if there is a link reward. */
  isLinkReward?: boolean;

  /**
   * Represents whether the transaction is a delegate call.
   * - `0` for non-delegate call
   * - `1` for delegate call
   */
  delegatecall?: 0 | 1;
};

/**
 * Creates reward parameters by merging the provided parameters with default values.
 * @param params The parameters for the reward.
 * @returns Reward parameters with default values for missing parameters.
 */
export function createRewardParams(
  params: NewUserParams,
  patchwallet: string,
): NewUserParams {
  return {
    ...{
      tokenAddress: G1_POLYGON_ADDRESS,
      chainId: DEFAULT_CHAIN_ID,
      isSignupReward: false,
      isReferralReward: false,
      isLinkReward: false,
      delegatecall: 0,
    },
    ...params,
    patchwallet,
  };
}

/**
 * Represents parameters for an Identity Segment, extending NewUserParams.
 */
export type IdentitySegmentParams = NewUserParams & {
  /**
   * The date when the segment was added.
   */
  dateAdded: Date;
};

/**
 * Defines the structure for TransactionParams.
 */
export type TransactionParams = {
  /** The Telegram user ID of the sender. */
  senderTgId: string;

  /** The amount of the transaction. */
  amount: string;

  /** The Telegram user ID of the recipient. */
  recipientTgId: string;

  /** The event ID associated with the transaction. */
  eventId: string;

  /** The chain ID for the transaction. */
  chainId?: string;

  /** The token address for the transaction. */
  tokenAddress?: string;

  /** The message associated with the transaction. */
  message?: string;

  /** The symbol of the token for the transaction. */
  tokenSymbol?: string;

  /** Additional sender information with MongoDB document ID. */
  senderInformation?: WithId<MongoUser>;

  /**
   * Represents whether the transaction is a delegate call.
   * - `0` for non-delegate call
   * - `1` for delegate call
   */
  delegatecall?: 0 | 1;
};

/**
 * Creates a transaction by merging the provided parameters with default values.
 * @param params The parameters for the transaction.
 * @param senderInformation Additional sender information.
 * @returns A transaction with default values for missing parameters.
 */
export function createTransaction(
  params: TransactionParams,
  senderInformation: WithId<MongoUser>,
): TransactionParams {
  return {
    ...{
      tokenSymbol: G1_TOKEN_SYMBOL,
      tokenAddress: G1_POLYGON_ADDRESS,
      chainId: DEFAULT_CHAIN_ID,
      delegatecall: 0,
    },
    ...params,
    senderInformation,
  };
}

/**
 * Defines the structure for TrackSegmentParams.
 * Extends TransactionParams and includes additional fields for tracking segments.
 */
export type TrackSegmentParams = TransactionParams & {
  /** The wallet address of the recipient. */
  recipientWallet: string;

  /** The hash associated with the transaction. */
  transactionHash: string;

  /** The date when the segment was added. */
  dateAdded: Date;
};

/**
 * Type union for different reward types.
 * @typeparam IsolatedRewardTelegram Type for an isolated reward in Telegram.
 * @typeparam LinkRewardTelegram Type for a link reward in Telegram.
 * @typeparam ReferralRewardTelegram Type for a referral reward in Telegram.
 * @typeparam SignUpRewardTelegram Type for a sign-up reward in Telegram.
 */
export type Reward =
  | IsolatedRewardTelegram
  | LinkRewardTelegram
  | ReferralRewardTelegram
  | SignUpRewardTelegram;

/**
 * Type union for different operations in Telegram.
 * @typeparam Reward Type union for different reward types.
 * @typeparam TransferTelegram Type for Telegram transfers.
 * @typeparam SwapTelegram Type for Telegram swaps.
 */
export type TelegramOperations =
  | Reward
  | TransferTelegram
  | SwapTelegram
  | VestingTelegram
  | OrderTelegram;

/**
 * Represents the result of a wallet patch operation.
 */
export interface PatchRawResult {
  /** The user operation hash, if available. */
  userOpHash?: string;

  /** The transaction hash, if available. */
  txHash?: string;
}

/**
 * Represents an indicator for error occurrence.
 */
type ErrorIndicator = {
  /**
   * Indicates whether an error occurred during the operation.
   */
  isError: boolean;
};

/**
 * Represents the result of a wallet patch operation, including raw result details.
 */
export interface PatchResult extends PatchRawResult, ErrorIndicator {}

/**
 * Represents the initialization result of a transaction operation.
 */
export interface TransactionInit extends ErrorIndicator {
  /**
   * The initialized transaction instance.
   */
  transactionInstance: TransferTelegram;
}

/**
 * Represents the initialization result of a SignUpRewardTelegram instance.
 */
export interface RewardInit {
  /**
   * The initialized reward instance.
   */
  rewardInstance:
    | IsolatedRewardTelegram
    | LinkRewardTelegram
    | SignUpRewardTelegram;

  /**
   * Indicates if a reward should not be issued.
   */
  shouldBeIssued: boolean;
}

/**
 * Represents the initialization result of a SignUpRewardTelegram instance.
 */
export interface OrderInit {
  /**
   * The initialized order instance.
   */
  orderInstance: OrderTelegram;

  /**
   * Indicates if the order should proceed.
   */
  shouldProceed: boolean;
}

/**
 * Represents the result of handling a pending hash operation.
 */
export type HandlePendingHashResult = {
  /**
   * The transaction result or status.
   * It could be an instance of `PatchResult` or `undefined`.
   */
  tx: PatchResult | undefined;

  /**
   * Indicates the status of output for a pending hash operation.
   * It's an optional boolean field.
   */
  outputPendingHash?: boolean;
};
