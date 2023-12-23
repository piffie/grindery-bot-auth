/**
 * Interface representing information about a blockchain.
 */
export interface ChainInfo {
  /**
   * Array containing endpoint strings for the blockchain.
   */
  endpoint: string[];

  /**
   * (Optional) Name patch for the blockchain (if available).
   */
  name_patch?: string;

  /**
   * URL of the explorer for the blockchain.
   */
  explorer: string;

  /**
   * Display name of the blockchain.
   */
  name_display: string;
}
