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
