import { Request, Response, NextFunction } from 'express';
import * as WeatherService from '../services/weather.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { BAD_REQUEST, OK } from '../utils/http-status';
import { AppError } from '../utils/error';
import mongoose from 'mongoose';

export const getWeather = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new AppError('User not authenticated', BAD_REQUEST));
    }

    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new AppError('Invalid latitude or longitude', BAD_REQUEST);
    }

    const userIdAsObjectId = new mongoose.Types.ObjectId(req.user.id);
    const weatherData = await WeatherService.getWeather(userIdAsObjectId, lat, lon);

    res.status(OK).json({
      source: weatherData.source,
      coordinates: weatherData.coordinates,
      tempC: weatherData.tempC,
      humidity: weatherData.humidity,
      description: weatherData.description,
      fetchedAt: weatherData.fetchedAt,
    });
  } catch (error) {
    next(error);
  }
};
