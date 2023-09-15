import "dotenv/config";
import axios from "axios";

export async function addIdentitySegment(user) {
  return await axios.post(
    "https://api.segment.io/v1/identify",
    {
      userId: user.userTelegramID,
      traits: {
        responsePath: user.responsePath,
        userHandle: user.userHandle,
        userName: user.userName,
        patchwallet: user.patchwallet,
      },
      timestamp: user.dateAdded,
    },
    {
      timeout: 100000,
      headers: {
        Authorization: `Bearer ${process.env.SEGMENT_KEY}`,
      },
    }
  );
}

export async function addTrackSegment(params) {
  return await axios.post(
    "https://api.segment.io/v1/track",
    {
      userId: user.userTelegramID,
      event: "Transfer",
      properties: {
        TxId: params.TxId,
        chainId: "eip155:137",
        tokenSymbol: "g1",
        tokenAddress: process.env.G1_POLYGON_ADDRESS,
        senderTgId: params.senderTgId,
        senderWallet: params.senderWallet,
        senderName: params.senderName,
        recipientTgId: params.recipientTgId,
        recipientWallet: params.recipientWallet,
        tokenAmount: params.tokenAmount,
        transactionHash: params.transactionHash,
      },
      timestamp: user.dateAdded,
    },
    {
      timeout: 100000,
      headers: {
        Authorization: `Bearer ${process.env.SEGMENT_KEY}`,
      },
    }
  );
}
