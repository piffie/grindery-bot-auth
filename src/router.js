import { Router } from "express";
import bot_auth from "./routes/bot_auth.js";
import notifications from "./routes/notifications.js";

const router = Router();

router.use("/bot-auth", bot_auth);
router.use("/notifications", notifications);

export default router;
