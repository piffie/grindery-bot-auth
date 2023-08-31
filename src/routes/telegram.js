import express from "express";
import telegramClient from "../utils/telegramClient.js";
import createTelegramPromise from "../utils/telegramPromise.js";
import {uuid} from "uuidv4";

const router = express.Router();
const operations = {};

router.post("/init", async (req, res) => {
  const operationId = uuid();

  const client = telegramClient();
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
    res.json({status: "code_received"});
  } else {
    res.status(404).json({error: "Operation not found"});
  }
});

export default router;
