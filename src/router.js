import { Router } from "express";
import bot_auth from "./routes/bot_auth.js";

const router = Router();

router.use("/bot-auth", bot_auth);

export default router;
