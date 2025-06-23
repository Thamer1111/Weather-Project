import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { BAD_REQUEST, OK, SERVICE_UNAVAILABLE, NOT_FOUND } from '../utils/http-status';
import { AppError } from '../utils/error';
import mongoose from 'mongoose';
import * as WeatherService from '../services/weather.service';

export const getWeather = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', BAD_REQUEST);
    }

    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new AppError('Invalid latitude or longitude', BAD_REQUEST);
    }

    const userId = req.user._id;

    const weatherData = await WeatherService.getWeather(userId, lat, lon);

    res.status(OK).json(weatherData);
    return;
  } catch (error) {
    next(error);
  }
};
