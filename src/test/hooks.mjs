import { Database } from "../db/conn.js";
import { REWARDS_TEST_COLLECTION } from "../utils/constants.js";

export const mochaHooks = {
  afterEach: async function () {
    const db = await Database.getInstance("unit-test");
    if (db.namespace === "grindery-test-server") {
      await db.dropDatabase();
    }
  },
};
