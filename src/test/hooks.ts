import { Database } from '../db/conn';

export const mochaHooks = {
  afterEach: async function () {
    const db = await Database.getInstance();
    if (db && db.namespace === 'grindery-test-server') {
      await db.dropDatabase();
    }
  },
};
