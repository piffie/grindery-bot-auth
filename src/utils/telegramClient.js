import {TelegramClient} from "telegram";
import {StringSession} from "telegram/sessions/index.js";

const telegramClient = () => {
  return new TelegramClient(
    new StringSession(""),
    20757410,
    "d9818920b6ee370856801a6dfa73c5c8",
    {
      connectionRetries: 5,
    }
  );
};

export default telegramClient;
