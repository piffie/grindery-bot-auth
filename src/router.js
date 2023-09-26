import { Router } from 'express';
import bot_auth from './routes/bot_auth.js';
import notifications from './routes/notifications.js';
import data from './routes/bot_data.js';
import telegram from './routes/telegram.js';
import db from './routes/db.js';
import support from './routes/support.js';
import leaderboard from './routes/leaderboard.js';

const router = Router();

router.use('/bot-auth', bot_auth);
router.use('/notifications', notifications);
router.use('/data', data);
router.use('/telegram', telegram);
router.use('/db', db);
router.use('/support', support);
router.use('/leaderboard', leaderboard);

export default router;
