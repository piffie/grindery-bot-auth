import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.ATLAS_URI || "";
const client = new MongoClient(connectionString);

export class Database {
  static instance;

  static async getInstance(req) {
    if (!Database.instance) {
      let conn;
      try {
        conn = await client.connect();
      } catch (e) {
        console.error(e);
      }

      Database.instance = conn.db("grindery-bot");
    }
    return Database.instance;
  }
}
