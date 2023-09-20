const axios = require("axios");

const SEGMENT_API_ENDPOINT = "https://api.segment.io/v1/batch";
const SEGMENT_WRITE_KEY = "YOUR_SEGMENT_WRITE_KEY"; // Replace with your Segment write key

async function sendBatchRequest() {
  const db = await Database.getInstance();
  const usersCollection = db.collection("users");

  try {
    // Fetch users from MongoDB
    const users = await usersCollection.find().toArray();

    // Map users to the required format for the request payload
    const batch = users.map((user) => ({
      type: "identify",
      userId: user._id.toString(), // Assuming `_id` is ObjectId type
      traits: {
        email: user.email,
        name: user.name,
        age: user.age,
      },
      timestamp: new Date().toISOString(),
    }));

    const payload = {
      batch: batch,
      context: {
        device: {
          type: "phone",
          name: "Apple iPhone 6",
        },
      },
    };

    const config = {
      headers: {
        Authorization: `Bearer ${SEGMENT_WRITE_KEY}`,
        "Content-Type": "application/json",
      },
    };

    const response = await axios.post(SEGMENT_API_ENDPOINT, payload, config);
    console.log("Data sent successfully:", response.data);
  } catch (error) {
    console.error(
      "Error sending batch request:",
      error.response ? error.response.data : error.message
    );
  } finally {
    process.exit(0);
  }
}

sendBatchRequest();
