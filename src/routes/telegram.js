import express from "express";
import {TelegramClient, Api} from "telegram";
import {StringSession} from "telegram/sessions/index.js";
import createTelegramPromise from "../utils/telegramPromise.js";
import {uuid} from "uuidv4";
import TGClient from "../utils/telegramClient.js";

const router = express.Router();
const operations = {};

router.post("/init", async (req, res) => {
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

router.post("/callback", async (req, res) => {
  const operationId = req.body.operationId;
  const code = req.body.code;

  if (operations[operationId]) {
    operations[operationId].phoneCodePromise.resolve(code);
    const session = operations[operationId].client.session.save();
    res.json({session: session, status: "code_received"});
  } else {
    res.status(404).json({error: "Operation not found"});
  }
});

router.get("/status", async (req, res) => {
  const client = TGClient(new StringSession(req.query.session));
  await client.connect();
  const status = client.connected;

  res.status(200).json({status: status});
});

router.get("/contacts", async (req, res) => {
  const client = TGClient(new StringSession(req.query.session));
  await client.connect();

  if (!client.connected) {
    return res.status(200).json([]);
  }

  const contacts = await client.invoke(
    new Api.contacts.GetContacts({
      hash: BigInt("-4156887774564"),
    })
  );

  res.status(200).json(contacts);
});

export default router;
