import { TransferTelegram } from '../webhooks/transaction';
import { GX_POLYGON_ADDRESS, SOURCE_WALLET_ADDRESS } from '../../secrets';
import { Database } from '../db/conn';
import { TOP_UP_COLLECTION, USERS_COLLECTION } from './constants';
import { WithId } from 'mongodb';
import { MongoUser } from 'grindery-nexus-common-utils';

export async function isTopUpTx(inst: TransferTelegram): Promise<void> {
  const db = await Database.getInstance();

  // Check if it's a top-up transaction
  if (!inst.params.isTopUp) return;

  // Get source wallet details
  const sourceWallet = (await db?.collection(USERS_COLLECTION).findOne({
    userTelegramID: inst.params.recipientTgId,
  })) as WithId<MongoUser> | null;

  // Check if it's a top-up transaction
  if (
    inst.params.tokenAddress != GX_POLYGON_ADDRESS ||
    sourceWallet?.patchwallet != SOURCE_WALLET_ADDRESS
  )
    return;

  // Check if a record for the user already exists
  const existingRecord = (await db?.collection(TOP_UP_COLLECTION).findOne({
    userTelegramID: inst.params.senderTgId,
  })) as WithId<MongoUser> | null;

  if (existingRecord) {
    // If record exists, update it by adding the new deposit amount to the old balance
    await db?.collection(TOP_UP_COLLECTION).updateOne(
      { userTelegramID: inst.params.senderTgId },
      { $inc: { gxBalance: Number(inst.params.amount) } }, // Increment gxBalance by the deposit amount
    );
  } else {
    // If no record exists, create a new one
    await db?.collection(TOP_UP_COLLECTION).insertOne({
      userTelegramID: inst.params.senderTgId,
      gxBalance: Number(inst.params.amount),
    });
  }
}
