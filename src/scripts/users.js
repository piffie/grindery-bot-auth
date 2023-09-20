import { Database } from "../db/conn.js";
import fs from "fs";
import csv from "csv-parser";
import csvWriter from "csv-writer";

// Usage: importUsersFromCSV(filePath)
// Description: This function imports user data from a CSV file into the database.
// - filePath: The path to the CSV file containing user data.
// Example: importUsersFromCSV("/path/to/your/file.csv");
async function importUsersFromCSV(filePath) {
  const db = await Database.getInstance();
  const collection = db.collection("users");
  const toInsert = [];

  try {
    // Read the CSV file and parse its contents
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        // Extract data from CSV row and format it
        toInsert.push({
          userTelegramID: data.UserID,
          responsePath: data.ResponsePath,
          userHandle: data.UserHandle,
          userName: data.FirstName + " " + data.LastName,
          patchwallet: data.wallet,
          dateAdded: new Date(data.FirstActive).toISOString(),
        });
      })
      .on("end", async () => {
        // Retrieve existing userTelegramIDs from the database
        const existingTelegramIDs = (
          await collection.distinct("userTelegramID")
        ).map(String);

        // Filter out new users not present in the database
        const newUsers = toInsert.filter(
          (entry) => !existingTelegramIDs.includes(entry.userTelegramID)
        );

        if (newUsers.length > 0) {
          // Insert new users into the database
          await collection.insertMany(newUsers);
          console.log("Missing users inserted");
        } else {
          console.log("No new users to insert.");
        }

        process.exit(0);
      });
  } catch (error) {
    console.error("Error reading CSV file:", error);
    process.exit(1);
  }
}

// Example usage of the function
// Description: This function removes users from the database whose userTelegramID contains a "+" character.
// removeUsersScientificNotationInTelegramID();
async function removeUsersScientificNotationInTelegramID() {
  try {
    const db = await Database.getInstance();
    const collectionUsers = db.collection("users");

    // Define a filter to find users with "+" in userTelegramID
    const filter = { userTelegramID: { $regex: /\+/ } };

    // Delete the matching documents
    const deleteResult = await collectionUsers.deleteMany(filter);

    console.log(
      `Deleted ${deleteResult.deletedCount} users with '+' in userTelegramID`
    );
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  } finally {
    process.exit(0);
  }
}

// Example usage of the functions:
// const users = [
//   { userTelegramID: "12345" },
//   { userTelegramID: "67890" },
//   { userTelegramID: "12345" },
//   { userTelegramID: "12345" },
//   { userTelegramID: "67890" },
// ];
// logUserTelegramIDsFromArrayOfUsers(users);
function logUserTelegramIDsFromArrayOfUsers(users) {
  const userTelegramIDCounts = {}; // To store the count of each unique userTelegramID

  // Iterate through the users array
  users.forEach((result) => {
    const userTelegramID = result.userTelegramID;

    // Check if userTelegramID already exists in the userTelegramIDCounts dictionary
    if (userTelegramIDCounts[userTelegramID]) {
      // If yes, increment the counter
      userTelegramIDCounts[userTelegramID]++;
    } else {
      // If not, initialize the counter to 1
      userTelegramIDCounts[userTelegramID] = 1;
    }
  });

  // Iterate through the dictionary and display the results
  for (const [userTelegramID, count] of Object.entries(userTelegramIDCounts)) {
    console.log(`userTelegramID: ${userTelegramID}, Count: ${count}`);
  }
}

// Function to get all users without outgoing transfers and export to CSV
async function getUsersWithoutOutgoingTransfersAndExportToCSV() {
  try {
    const db = await Database.getInstance();
    const usersCollection = db.collection("users");
    const transfersCollection = db.collection("transfers");

    // Get all users
    const allUsers = await usersCollection.find({}).toArray();

    // Get all transfers as an array
    const allTransfers = await transfersCollection.find({}).toArray();

    // Create a Set of senderTgId values from transfers for efficient lookup
    const senderTgIdsSet = new Set(
      allTransfers.map((transfer) => transfer.senderTgId)
    );

    // Array to store users without outgoing transfers
    const usersWithoutOutgoingTransfers = [];

    // Loop through all users
    for (const user of allUsers) {
      // Check if user's userTelegramID exists in the Set
      if (!senderTgIdsSet.has(user.userTelegramID)) {
        usersWithoutOutgoingTransfers.push(user);
      }
    }

    // Export users without outgoing transfers to CSV
    if (usersWithoutOutgoingTransfers.length > 0) {
      const csvWriterObject = csvWriter.createObjectCsvWriter({
        path: "users_without_outgoing_transfers.csv",
        header: [
          { id: "userTelegramID", title: "UserTelegramID" },
          { id: "responsePath", title: "ResponsePath" },
          { id: "userHandle", title: "UserHandle" },
          { id: "userName", title: "UserName" },
          { id: "patchwallet", title: "Patchwallet" },
          { id: "dateAdded", title: "DateAdded" },
        ],
      });

      await csvWriterObject.writeRecords(usersWithoutOutgoingTransfers);
      console.log(
        `Users have been exported to users_without_outgoing_transfers.csv`
      );
    } else {
      console.log("No users without outgoing transfers found.");
    }
  } catch (error) {
    throw new Error(`An error occurred: ${error.message}`);
  } finally {
    process.exit(0);
  }
}
