import { G1_POLYGON_ADDRESS } from '../../secrets';
import { DEFAULT_CHAIN_ID } from './constants';
import { daysSinceStartDate } from './time';
import { UserTelegram } from './user';
import { getUserBalance } from './web3';

/**
 * The starting date for the calculation.
 */
const START_DATE = new Date('2024-01-12T00:00:00Z');

/**
 * The minimum USD price per G1 for conversion.
 */
const MIN_USD_PRICE_PER_G1 = 0.0005;

/**
 * The maximum USD price per G1 for conversion.
 */
const MAX_USD_PRICE_PER_G1 = 0.005;

/**
 * The base rate for G1 to USD conversion.
 */
const BASE_RATE = MIN_USD_PRICE_PER_G1 * 1.2;

/**
 * Factor for the first calculation component (m1).
 */
const M1_FACTOR = 0.2;

/**
 * Factor for the second calculation component (m2).
 */
const M2_FACTOR = 0.4;

/**
 * Factor for the third calculation component (m3).
 */
const M3_FACTOR = 0.3;

/**
 * Factor for the fourth calculation component (m4).
 */
const M4_FACTOR = -0.2;

/**
 * Factor for the fifth calculation component (m5).
 */
const M5_FACTOR = 0.25;

/**
 * Factor for the sixth calculation component (m6).
 */
const M6_FACTOR = MAX_USD_PRICE_PER_G1;

/**
 * USD conversion factor.
 */
const USD_CONV = 0.036;

/**
 * Computes the G1 to GX conversion based on various factors and inputs.
 * @param {number} snapshotG1 - The snapshot of G1.
 * @param {number} amountG1ToConvert - The amount of G1 to convert.
 * @param {number} amountUSDToConvert - The amount of USD to convert.
 * @param {number} mvu - The MVU (Minimum Viable Utility) value.
 * @returns {object} - Object containing the results of the conversion.
 */
export function computeG1ToGxConversion(
  snapshotG1: number,
  amountG1ToConvert: number,
  amountUSDToConvert: number,
  mvu: number,
) {
  // Calculate m1 based on the amount of USD to convert.
  const m1 = Math.min(1, amountUSDToConvert / 50) * M1_FACTOR;

  // Calculate m12 using logarithmic and linear functions.
  const m12 = Math.max((Math.log2(amountG1ToConvert / 1000) + 1) * 10, 1);

  // Calculate m2 based on the amount of USD to convert and m12.
  const m2 = Math.min(M2_FACTOR, (amountUSDToConvert / m12) * M2_FACTOR);

  // Calculate m3 based on the MVU value.
  const m3 = (mvu / 10) * M3_FACTOR;

  // Calculate m4 based on the days since the start date.
  const m4 = (daysSinceStartDate(START_DATE) - 1) * (M4_FACTOR / (30 - 1));

  // Calculate m5 based on the ratio of amountG1ToConvert to snapshotG1.
  const m5 =
    amountG1ToConvert / snapshotG1 < 0.8
      ? 0
      : amountG1ToConvert / snapshotG1 < 0.95
      ? (amountG1ToConvert / snapshotG1 - 0.8) *
        (M5_FACTOR / (0.95 - 0.8)) *
        100
      : M5_FACTOR;

  // Calculate m6 as the minimum of the sum of m1, m2, m3, m4, and m5.
  const m6 = Math.min(1, m1 + m2 + m3 + m4 + m5);

  // Calculate the final_g1_usd based on BASE_RATE, M6_FACTOR, and m6.
  const final_g1_usd = BASE_RATE + (M6_FACTOR - BASE_RATE) * m6;

  // Calculate gx_from_usd by dividing amountUSDToConvert by USD_CONV.
  const gx_from_usd = amountUSDToConvert / USD_CONV;

  // Calculate usd_from_g1 by multiplying final_g1_usd by amountG1ToConvert.
  const usd_from_g1 = final_g1_usd * amountG1ToConvert;

  // Calculate gx_from_g1 by dividing usd_from_g1 by USD_CONV.
  const gx_from_g1 = usd_from_g1 / USD_CONV;

  // Return an object containing the calculated values, each rounded to a specific number of decimal places.
  return {
    m1: m1.toFixed(4),
    m2: m2.toFixed(4),
    m3: m3.toFixed(4),
    m4: m4.toFixed(4),
    m5: m5.toFixed(4),
    m6: m6.toFixed(4),
    final_g1_usd: final_g1_usd.toFixed(6),
    gx_from_usd: gx_from_usd.toFixed(2),
    usd_from_g1: usd_from_g1.toFixed(2),
    gx_from_g1: gx_from_g1.toFixed(2),
    total_gx: (gx_from_usd + gx_from_g1).toFixed(2),
  };
}

/**
 * Retrieves the TGE balance for a user on the Polygon network.
 *
 * @param {string} userTelegramID - The Telegram User ID of the user.
 * @param {number} amountG1 - The amount of G1 to trade.
 * @returns {Promise<number>} A Promise that resolves to the user's TGE balance.
 */
export async function getUserTgeBalance(
  userTelegramID: string,
  amountG1: number,
): Promise<number> {
  // Build the UserTelegram object based on the provided Telegram User ID.
  const user = await UserTelegram.build(userTelegramID);

  // Get the real balance of the user in G1 on the Polygon network.
  const realBalance = parseFloat(
    await getUserBalance(
      user.patchwalletAddress() || '', // User's Ethereum wallet address.
      G1_POLYGON_ADDRESS, // Address of the G1 token on Polygon.
      DEFAULT_CHAIN_ID, // Polygon chain ID.
    ),
  );

  // Get the virtual balance of the user.
  const virtualBalance = user.getVirtualBalance();

  // Check if the amount of G1 to trade exceeds the real balance.
  if (amountG1 > realBalance) {
    throw new Error(
      `Amount of G1 to trade (${amountG1}) is too high compared to your current balance (${realBalance})`,
    );
  }

  // Calculate the TGE balance based on the conditions.
  return virtualBalance && realBalance < virtualBalance
    ? (amountG1 / realBalance) * virtualBalance
    : amountG1;
}
