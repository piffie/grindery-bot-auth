import { Database } from "../db/conn.js";
import { getPatchWalletAddressFromTgId } from "../utils/patchwallet.js";

async function updatePatchWalletAddresses() {
  let db;
  try {
    db = await Database.getInstance();
    const collectionUsers = db.collection("users");

    for (const user of await collectionUsers
      .find({ patchwallet: "" })
      .toArray()) {
      try {
        await collectionUsers.updateOne(
          { _id: user._id },
          {
            $set: {
              patchwallet: await getPatchWalletAddressFromTgId(
                user.userTelegramID
              ),
            },
          }
        );

        console.log(
          `Updated PatchWallet address for user ${user.userTelegramID}`
        );
      } catch (error) {
        console.error(
          `Error updating PatchWallet address for user ${user.userTelegramID}: ${error.message}`
        );
      }
    }

    console.log("Update completed.");
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  } finally {
    process.exit(0);
  }
}
