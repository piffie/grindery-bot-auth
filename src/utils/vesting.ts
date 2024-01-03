import {
  DEFAULT_CHAIN_ID,
  GRINDERY_VESTING_ADMIN,
  HEDGEY_LOCKUP_LOCKER,
  HEDGEY_VESTING_LOCKER,
  IDO_START_DATE,
  TOKEN_LOCK_TERM,
} from './constants';
import { G1_POLYGON_ADDRESS } from '../../secrets';
import { HedgeyPlanParams, HedgeyRecipientParams } from '../types/hedgey.types';
import {
  getContract,
  getHedgeyBatchPlannerContract,
  scaleDecimals,
} from './web3';
import BigNumber from 'bignumber.js';

/**
 * Calculates and generates plans for distributing tokens to recipients over time.
 *
 * @param recipients An array of HedgeyRecipientParams containing recipient information.
 * @param tokenAddress The token contract address. Defaults to G1_POLYGON_ADDRESS if not provided.
 * @param chainId The chain ID. Defaults to DEFAULT_CHAIN_ID if not provided.
 *
 * @returns A Promise that resolves to an object containing totalAmount and plans.
 *          - totalAmount: The total sum of token amounts for all recipients.
 *          - plans: An array of HedgeyPlanParams representing the distribution plans.
 */
export async function getPlans(
  recipients: HedgeyRecipientParams[],
  tokenAddress: string = G1_POLYGON_ADDRESS,
  chainId: string = DEFAULT_CHAIN_ID,
): Promise<{
  totalAmount: string;
  plans: HedgeyPlanParams[];
}> {
  const startDate = Math.round(IDO_START_DATE.getTime() / 1000); // Could use Date.now() instead of constant
  let totalAmount = BigNumber(0);

  const plans = await Promise.all(
    recipients.map(async (plan) => {
      const amountWei = BigNumber(
        scaleDecimals(
          plan.amount,
          await getContract(chainId, tokenAddress).methods.decimals().call(),
        ),
      );

      totalAmount = totalAmount.plus(amountWei);
      return [
        plan.recipientAddress,
        amountWei.toString(),
        startDate,
        startDate, // No cliff
        amountWei
          .div(BigNumber(TOKEN_LOCK_TERM))
          .decimalPlaces(0, BigNumber.ROUND_CEIL)
          .toString(), // Rate is tokens unlocked per second
      ] as HedgeyPlanParams;
    }),
  );

  return { totalAmount: totalAmount.toString(), plans };
}

/**
 * Generates data for batch vesting or locking plans based on the useVesting flag.
 *
 * @param useVesting A boolean flag indicating whether to use vesting or locking.
 * @param chainId The chain ID for the contract interaction.
 * @param tokenAddress The token contract address.
 * @param totalAmount The total amount of tokens to distribute.
 * @param plans An array of HedgeyPlanParams representing the distribution plans.
 *
 * @returns A Promise that resolves to an array of strings containing ABI-encoded data for contract interaction.
 */

export async function getData(
  useVesting: boolean,
  chainId: string,
  tokenAddress: string,
  totalAmount: string,
  plans: HedgeyPlanParams[],
): Promise<string> {
  return useVesting
    ? getHedgeyBatchPlannerContract(chainId)
        .methods['batchVestingPlans'](
          HEDGEY_VESTING_LOCKER,
          tokenAddress,
          totalAmount,
          plans,
          1, // Period: Linear
          GRINDERY_VESTING_ADMIN,
          true,
          4, // Vesting (fixed Hedgey constant)
        )
        .encodeABI()
    : getHedgeyBatchPlannerContract(chainId)
        .methods['batchLockingPlans'](
          HEDGEY_LOCKUP_LOCKER,
          tokenAddress,
          totalAmount,
          plans,
          1, // Period: Linear
          5, // Investor Lockups (fixed Hedgey constant)
        )
        .encodeABI();
}
