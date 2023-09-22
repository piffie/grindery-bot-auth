import express from "express";
import { Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import createTelegramPromise from "../utils/telegramPromise.js";
import { uuid } from "uuidv4";
import TGClient from "../utils/telegramClient.js";
import { telegramHashIsValid } from "../utils/auth.js";
import { Database } from "../db/conn.js";
import { getUser } from "../utils/telegram.js";

const router = express.Router();
const operations = {};

/**
 * POST /v1/telegram/init
 *
 * @summary Initialize a Telegram Session
 * @description Start a session with Telegram using phone number and password, awaiting a phone code for full authentication.
 * @tags Telegram
 * @security BearerAuth
 * @param {object} request.body - The request body containing the phone and password.
 * @return {object} 200 - Success response with operation ID and status
 * @example request - 200 - Example request body
 * {
 *   "phone": "5511987876565",
 *   "password": "user_password"
 * }
 * @example response - 200 - Success response example
 * {
 *   "operationId": "some-uuid",
 *   "status": "pending"
 * }
 */
router.post("/init", telegramHashIsValid, async (req, res) => {
  const operationId = uuid();

  const client = TGClient(new StringSession(""));
  operations[operationId] = {
    status: "pending",
    client: client,
    phoneCodePromise: null,
  };
  const globalPhoneCodePromise = createTelegramPromise();
  operations[operationId].phoneCodePromise = globalPhoneCodePromise;

  client
    .start({
      phoneNumber: req.body.phone,
      password: async () => {
        return req.body.password;
      },
      phoneCode: async () => {
        if (operations[operationId].phoneCodePromise) {
          let code = await operations[operationId].phoneCodePromise.promise;
          operations[operationId].phoneCodePromise = createTelegramPromise();
          return code;
        }
        throw new Error("Phone code promise not found.");
      },
      onError: (err) => {
        operations[operationId].status = "error";
        operations[operationId].error = err;
      },
    })
    .then(() => {
      operations[operationId].status = "completed";
    });

  res.json({
    operationId: operationId,
    status: "pending",
  });
});

/**
 * POST /v1/telegram/callback
 *
 * @summary Set Phone Code for Authentication
 * @description Provide the phone code received on the user's device to authenticate the session with Telegram.
 * @tags Telegram
 * @security BearerAuth
 * @param {object} request.body - The request body containing the operation ID and phone code.
 * @return {object} 200 - Success response with session and status
 * @return {object} 404 - Error response if operation not found
 * @example request - Example request body
 * {
 *   "operationId": "some-uuid",
 *   "code": "12345"
 * }
 * @example response - 200 - Success response example
 * {
 *   "session": "session-string",
 *   "status": "code_received"
 * }
 * @example response - 404 - Error response example
 * {
 *   "error": "Operation not found"
 * }
 */
router.post("/callback", telegramHashIsValid, async (req, res) => {
  const operationId = req.body.operationId;
  const code = req.body.code;

  if (operations[operationId]) {
    operations[operationId].phoneCodePromise.resolve(code);
    const session = operations[operationId].client.session.save();
    try {
      const user = getUser(req);
      if (!user?.id) {
        return res.status(401).send({ msg: "Invalid user" });
      }

      const db = await Database.getInstance(req);
      await db.collection("users").updateOne(
        { userTelegramID: user.id.toString() },
        {
          $set: {
            telegramSession: session,
          },
        }
      );
      res.json({
        session: encodeURIComponent(session),
        status: "code_received",
      });
    } catch (error) {}
  } else {
    res.status(404).json({ error: "Operation not found" });
  }
});

/**
 * GET /v1/telegram/status
 *
 * @summary Check Telegram Connection Status
 * @description Check if the Telegram client is currently connected.
 * @tags Telegram
 * @security BearerAuth
 * @param {string} request.query.session - The session string to identify the client.
 * @return {object} 200 - Success response with connection status
 * @example response - 200 - Success response example
 * {
 *   "status": true // or false
 * }
 */
router.get("/status", telegramHashIsValid, async (req, res) => {
  const client = TGClient(new StringSession(req.query.session));
  await client.connect();
  const status = client.connected;

  res.status(200).json({ status: status });
});

/**
 * GET /v1/telegram/contacts
 *
 * @summary Get Telegram Contacts
 * @description Retrieve telegram user's contact list.
 * @tags Telegram
 * @security BearerAuth
 * @return {object} 200 - Success response with the list of contacts
 * @example response - 200 - Success response example (simplified for brevity)
 * {
 *   "contacts": [{...}, {...}] // array of contact objects
 * }
 */
router.get("/contacts", telegramHashIsValid, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user?.id) {
      return res.status(401).send({ msg: "Invalid user" });
    }
    const db = await Database.getInstance(req);
    const userDoc = await db
      .collection("users")
      .findOne({ userTelegramID: user.id.toString() });
    const session = userDoc.telegramSession;
    if (!session) {
      return res.status(200).json([]);
    }
    const client = TGClient(new StringSession(session));
    await client.connect();

    if (!client.connected) {
      return res.status(200).json([]);
    }
    const contacts = await client.invoke(
      new Api.contacts.GetContacts({
        hash: BigInt("-4156887774564"),
      })
    );

    /*const usersArray = await db
      .collection("users")
      .find({
        $or: contacts.users.map((user) => ({
          userTelegramID: user.id.toString(),
        })),
      })
      .toArray();*/

    res.status(200).json(
      contacts.users.map((user) => ({
        ...user,
        /*isGrinderyUser: usersArray.find(
          (u) => u.userTelegramID === user.id.toString()
        )
          ? true
          : false,*/
      }))
    );
  } catch (error) {
    console.error("Error getting user", error);
    return res.status(500).send({ msg: "An error occurred", error });
  }
});

/**
 * GET /v1/telegram/me
 *
 * @summary Get telegram webapp user
 * @description Gets telegram webapp user record from DB collection.
 * @tags Telegram
 * @security BearerAuth
 * @return {object} 200 - Success response with connection status
 * @example response - 200 - Success response example
 * {
 *   "_id": "123",
 *   "userTelegramID": "456",
 *   "userName": "User Name",
 *   "userHandle": "username",
 *   "responsePath": "123/456",
 *   "patchwallet": "0x123",
 *   "dateAdded": "2021-01-01T00:00:00.000Z"
 * }
 */
router.get("/me", telegramHashIsValid, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user?.id) {
      return res.status(401).send({ msg: "Invalid user" });
    }
    const db = await Database.getInstance(req);
    return res
      .status(200)
      .send(
        await db
          .collection("users")
          .findOne({ userTelegramID: user.id.toString() })
      );
  } catch (error) {
    console.error("Error getting user", error);
    return res.status(500).send({ msg: "An error occurred", error });
  }
});

/**
 * GET /v1/telegram/activity
 *
 * @summary Get telegram user activity
 * @description Gets telegram user activity (transactions) from DB collection.
 * @tags Telegram
 * @security BearerAuth
 * @return {object} 200 - Success response with connection status
 * @example response - 200 - Success response example
 * [
 *  {
 *    "_id": "6asdfghjff2936fefd07cf93",
 *     "TxId": "xdc3ooo",
 *     "chainId": "eip155:137",
 *     "tokenSymbol": "g1",
 *     "tokenAddress": "0xe36BD65609c08Cgavehr3520293523CF4560533d0",
 *     "senderTgId": "1899300004",
 *     "senderWallet": "0x1234556751f3D2e4dE9D8B860311936090bcaC95",
 *     "senderName": "undefined",
 *     "recipientTgId": "5900000139",
 *     "recipientWallet": "0x43371FD1Df1a3ee6550ca42f61956feasdfghj33",
 *     "tokenAmount": "10",
 *     "transactionHash": "0xdtgbrfve594b7950ef2e5fe6efa89eb4daf6e1424b641eee0dd4db2f8e5fdf8f",
 *     "dateAdded": "2021-01-01T00:00:00.000Z"
 *   }
 * ]
 */
router.get("/activity", telegramHashIsValid, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user?.id) {
      return res.status(401).send({ msg: "Invalid user" });
    }
    const db = await Database.getInstance(req);
    return res.status(200).send(
      await db
        .collection("transfers")
        .find({
          $or: [
            { senderTgId: user.id.toString() },
            { recipientTgId: user.id.toString() },
          ],
        })
        .toArray()
    );
  } catch (error) {
    console.error("Error getting activity", error);
    return res.status(500).send({ msg: "An error occurred", error });
  }
});

/**
 * GET /v1/telegram/user
 *
 * @summary Get telegram user public profile
 * @description Gets telegram user public profile from DB collection.
 * @tags Telegram
 * @security BearerAuth
 * @param {string} request.query.id - The telegram id of the user.
 * @return {object} 200 - Success response with connection status
 * @example response - 200 - Success response example
 * {
 *   "_id": "123",
 *   "userTelegramID": "456",
 *   "userName": "User Name",
 *   "userHandle": "username",
 *   "patchwallet": "0x123"
 * }
 */
router.get("/user", telegramHashIsValid, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user?.id) {
      return res.status(401).send({ msg: "Invalid user" });
    }
    if (!req.query.id) {
      return res.status(400).send({ msg: "Invalid user ID" });
    }
    const db = await Database.getInstance(req);
    return res
      .status(200)
      .send(
        await db.collection("users").findOne({ userTelegramID: req.query.id })
      );
  } catch (error) {
    console.error("Error getting user", error);
    return res.status(500).send({ msg: "An error occurred", error });
  }
});

/**
 * GET /v1/telegram/rewards
 *
 * @summary Get telegram user rewards
 * @description Gets telegram user rewards (transactions) from DB collection.
 * @tags Telegram
 * @security BearerAuth
 * @return {object} 200 - Success response with connection status
 * @example response - 200 - Success response example
 * [
 *  {
 *    "_id": "64f623c2ff2936zxcv07cbab",
 *    "userTelegramID": "1652aaa020",
 *    "responsePath": "64d170d6dggaaa00578ad6f6/c/1652061020",
 *    "walletAddress": "0x151bF7ccvvb2e6E32acC4362A8A5Bb26c5EAc38E",
 *    "reason": "user_sign_up",
 *    "userHandle": "username",
 *    "userName": "Firstname L`astname",
 *    "amount":"100",
 *    "message":"Sign up reward",
 *    "transactionHash": "0x2d9c28626cc15b8aaassacd1c16a66886769a381b53be247f0518a55c0d5a334",
 *    "dateAdded": "2021-01-01T00:00:00.000Z"
 *  }
 * ]
 */
router.get("/rewards", telegramHashIsValid, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user?.id) {
      return res.status(401).send({ msg: "Invalid user" });
    }
    const db = await Database.getInstance(req);
    return res.status(200).send(
      await db
        .collection("rewards")
        .find({
          userTelegramID: user.id.toString(),
        })
        .toArray()
    );
  } catch (error) {
    console.error("Error getting rewards", error);
    return res.status(500).send({ msg: "An error occurred", error });
  }
});

/**
 * GET /v1/telegram/user/photo
 *
 * @summary Get telegram user public profile photo
 * @description Gets telegram user public profile photo from Telegram API
 * @tags Telegram
 * @security BearerAuth
 * @param {object} request.query.username - Contact username
 * @return {object} 200 - Success response with photo as base64 url string
 * @return {object} 404 - Error response if operation not found
 * @example response - 200 - Success response example
 * {
 *   "photo": "data:image/png;base64,asdfghjklqwertyuiopzxcvbnm"
 * }
 */
router.get("/user/photo", telegramHashIsValid, async (req, res) => {
  try {
    const username = req.query.username;

    if (!username) {
      return res.status(401).send({ msg: "Username is required" });
    }
    const user = getUser(req);
    if (!user?.id) {
      return res.status(401).send({ msg: "Invalid user" });
    }
    const db = await Database.getInstance(req);
    const userDoc = await db
      .collection("users")
      .findOne({ userTelegramID: user.id.toString() });
    const session = userDoc.telegramSession;
    if (!session) {
      return res.status(200).json([]);
    }
    const client = TGClient(new StringSession(session));
    await client.connect();

    if (!client.connected) {
      return res.status(200).json({ photo: "" });
    }

    const photo = await client.downloadProfilePhoto(username);

    const base64Photo = btoa(String.fromCharCode(...new Uint8Array(photo)));

    return res.status(200).json({
      photo: base64Photo ? `data:image/png;base64,${base64Photo}` : "",
    });
  } catch (error) {
    console.error("Error getting user photo", error);
    return res.status(500).send({ msg: "An error occurred", error });
  }
});

export default router;
