import {Router} from "express";
import bot_auth from "./routes/bot_auth.js";
import notifications from "./routes/notifications.js";
import data from "./routes/bot_data.js";
import telegram from "./routes/telegram.js";
import users from "./routes/users.js";

const router = Router();

router.use("/bot-auth", bot_auth);
router.use("/notifications", notifications);
router.use("/data", data);
router.use("/telegram", telegram);
router.use("/users", users);

export default router;
