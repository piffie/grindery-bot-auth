import { Database } from '../db/conn.js';

export const mochaHooks = {
  afterEach: async function () {
    const db = await Database.getInstance('unit-test');
    if (db.namespace === 'grindery-test-server') {
      await db.dropDatabase();
    }
  },
};
