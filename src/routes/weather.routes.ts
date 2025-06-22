import { Router } from 'express';
import * as WeatherController from '../controllers/weather.controller';
import { authorized } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authorized, WeatherController.getWeather);

export default router;
