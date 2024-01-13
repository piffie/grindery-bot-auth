import { G1_POLYGON_ADDRESS } from '../../secrets';
import { CHAIN_MAPPING } from './chains';
import ERC20 from '../abi/ERC20.json';
import Web3 from 'web3';
import BN from 'bn.js';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import { DEFAULT_CHAIN_ID } from './constants';
import HedgeyBatchPlanner from '../abi/HedgeyBatchPlanner.json';
import BigNumber from 'bignumber.js';

/**
 * Creates and returns a contract instance using Web3 with the specified chainId and tokenAddress.
 * @param {string} chainId - Chain ID (default: 'eip155:137').
 * @param {string} tokenAddress - Token address (default: G1_POLYGON_ADDRESS from secrets).
 * @returns {Contract} - Web3 contract instance.
 * @throws {Error} - Throws an error if the chainId is invalid.
 */
export function getContract(
  chainId: string = DEFAULT_CHAIN_ID,
  tokenAddress: string = G1_POLYGON_ADDRESS,
): Contract {
  if (!CHAIN_MAPPING[chainId]) {
    throw new Error('Invalid chain: ' + chainId);
  }

  return new new Web3(CHAIN_MAPPING[chainId].endpoint[1]).eth.Contract(
    ERC20 as AbiItem[],
    tokenAddress,
  );
}

/**
 * Converts various types of numeric inputs to a string representation.
 * @param {any} arg - Input value to convert to a string.
 * @returns {string} - String representation of the input value.
 * @throws {Error} - Throws an error for invalid number values or types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function numberToString(arg: any): string {
  if (typeof arg === 'string') {
    if (!arg.match(/^-?[0-9.]+$/)) {
      throw new Error(
        `while converting number to string, invalid number value '${arg}', should be a number matching (^-?[0-9.]+).`,
      );
    }
    return arg;
  } else if (typeof arg === 'number') {
    return String(arg);
  } else if (
    typeof arg === 'object' &&
    arg.toString &&
    (arg.toTwos || arg.dividedToIntegerBy)
  ) {
    return arg.toPrecision ? String(arg.toPrecision()) : arg.toString(10);
  }
  throw new Error(
    `while converting number to string, invalid number value '${arg}' type ${typeof arg}.`,
  );
}

/**
 * Scales a given Ethereum value with specified decimals.
 * @param {string} etherInput - Ethereum value input.
 * @param {number} decimals - Number of decimals.
 * @returns {string} - Scaled Ethereum value.
 * @throws {Error} - Throws errors for invalid or malformed input values.
 */
export function scaleDecimals(etherInput: string, decimals: number): string {
  let ether = numberToString(etherInput);
  const base = new BN(10).pow(new BN(decimals));
  const baseLength = base.toString(10).length - 1;

  // Is it negative?
  const negative = ether.substring(0, 1) === '-';
  if (negative) {
    ether = ether.substring(1);
  }

  if (ether === '.') {
    throw new Error(
      `[ethjs-unit] while converting number ${etherInput} to wei, invalid value`,
    );
  }

  // Split it into a whole and fractional part
  const comps = ether.split('.');
  if (comps.length > 2) {
    throw new Error(
      `[ethjs-unit] while converting number ${etherInput} to wei, too many decimal points`,
    );
  }

  let whole = comps[0];
  let fraction = comps[1];

  if (!whole) {
    whole = '0';
  }
  if (!fraction) {
    fraction = '0';
  }
  if (fraction.length > baseLength) {
    throw new Error(
      `[ethjs-unit] while converting number ${etherInput} to wei, too many decimal places`,
    );
  }

  while (fraction.length < baseLength) {
    fraction += '0';
  }

  return (
    negative
      ? new BN(whole).mul(base).add(new BN(fraction)).mul(new BN(-1))
      : new BN(whole).mul(base).add(new BN(fraction))
  ).toString(10);
}

/**
 * Creates and returns a contract instance of the Hedgey Batch Planner.
 * @param {string} chainId - Chain ID (default: 'eip155:137').
 * @returns {Contract} - Web3 contract instance.
 * @throws {Error} - Throws an error if the chainId is invalid.
 */
export function getHedgeyBatchPlannerContract(
  chainId: string = DEFAULT_CHAIN_ID,
): Contract {
  if (!CHAIN_MAPPING[chainId]) {
    throw new Error('Invalid chain: ' + chainId);
  }
  return new new Web3().eth.Contract(HedgeyBatchPlanner as AbiItem[]);
}

/**
 * Converts an amount in Wei to Ether with specified decimal precision.
 * @param {string | BN | number} weiAmount - The amount in Wei to be converted.
 * @param {number} [decimals=18] - The number of decimals to include in the Ether result.
 * @returns {string} - The Ether amount as a string with the specified decimal precision.
 * @throws {Error} - Throws an error if the input Wei amount is not a valid number.
 */
export function weiToEther(
  weiAmount: string | BN | number,
  decimals: number = 18,
): string {
  // Ensure the input is a string for Web3 processing
  const weiString = weiAmount.toString();

  // Parse the Wei amount to an integer
  const weiInteger = parseInt(weiString);

  // Check if the parsed integer is a valid number
  if (isNaN(weiInteger)) {
    throw new Error('Invalid input: the Wei amount is not a valid number.');
  }

  // Convert Wei to Ether using BigNumber and return the result
  return new BigNumber(weiInteger)
    .div(new BigNumber(10).pow(decimals))
    .toString();
}

/**
 * Retrieves the user's balance for a specific token on a given blockchain.
 *
 * @param {string} userAddress - The address of the user.
 * @param {string} tokenAddress - The address of the token.
 * @param {string} chainId - The identifier of the blockchain.
 * @returns {Promise<string>} A Promise that resolves to the user's balance as a string.
 */
export async function getUserBalance(
  userAddress: string,
  tokenAddress: string,
  chainId: string,
): Promise<string> {
  const contract = getContract(chainId, tokenAddress);

  return BigNumber(await contract.methods['balanceOf'](userAddress).call())
    .div(BigNumber(10).pow(BigNumber(await contract.methods.decimals().call())))
    .toString();
}
