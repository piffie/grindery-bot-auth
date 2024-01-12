import { TransferTelegram } from '../webhooks/transaction';
import { GX_POLYGON_ADDRESS, SOURCE_WALLET_ADDRESS } from '../../secrets';
import { Database } from '../db/conn';
import { TOP_UP_COLLECTION } from './constants';
import { UserTelegram } from './user';

export async function isTopUpTx(
  transferTelegram: TransferTelegram,
): Promise<void> {
  const db = await Database.getInstance();

  // Check if it's a top-up transaction
  if (!transferTelegram.params.isTopUp) return;

  // Get source user wallet details
  const sourceUser = await UserTelegram.build(
    transferTelegram.params.recipientTgId as string,
  );

  // Check if it's a top-up transaction
  if (
    transferTelegram.params.tokenAddress != GX_POLYGON_ADDRESS ||
    sourceUser.params?.patchwallet != SOURCE_WALLET_ADDRESS
  )
    return;

  // Check if a record for the user already exists
  // If record exists, update it by adding the new deposit amount to the old balance
  // If no record exists, create a new one
  await db?.collection(TOP_UP_COLLECTION).updateOne(
    { userTelegramID: transferTelegram.params.senderTgId },
    {
      $inc: { gxBalance: Number(transferTelegram.params.amount) },
    },
    { upsert: true },
  );
}
