import { Router } from 'express';
import * as HistoryController from '../controllers/history.controller';
import { authorized } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authorized, HistoryController.getHistory);

export default router;
