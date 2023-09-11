import { Database } from "../db/conn.js";

// Example usage of the functions:
// removeDuplicateTransfers();
async function removeDuplicateTransfers() {
  try {
    const db = await Database.getInstance();
    const collectionTransfers = db.collection("transfers");

    // Aggregation pipeline to identify duplicates and keep the first instance
    const aggregationPipeline = [
      {
        $group: {
          _id: "$transactionHash",
          firstInstance: { $first: "$_id" },
        },
      },
    ];

    // Find the first instance of each duplicate transactionHash
    const firstInstances = await collectionTransfers
      .aggregate(aggregationPipeline)
      .toArray();

    // Create an array of _id values to keep (first instances)
    const idsToKeep = firstInstances.map((instance) => instance.firstInstance);

    // Delete all documents that are not in the idsToKeep array
    const deleteResult = await collectionTransfers.deleteMany({
      _id: { $nin: idsToKeep },
    });

    console.log(`Deleted ${deleteResult.deletedCount} duplicate transfers.`);
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  } finally {
    process.exit(0);
  }
}
