import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { BAD_REQUEST, OK, SERVICE_UNAVAILABLE, NOT_FOUND } from '../utils/http-status';
import { AppError } from '../utils/error';
import mongoose from 'mongoose';
import axios from 'axios';
import { WeatherCollection, WeatherDocument } from '../models/weather.model';
import { HistoryCollection } from '../models/history.model';
import { openWeatherConfig } from '../config/openweather';
import logger from '../utils/logger';

interface OpenWeatherApiData {
  weather: { description: string }[];
  main: { temp: number; humidity: number };
  dt: number;
}

interface FormattedWeatherData {
  source: 'cache' | 'openweather';
  coordinates: { lat: number; lon: number };
  tempC: number;
  humidity: number;
  description: string;
  fetchedAt: string;
}

const roundCoordinates = (lat: number, lon: number) => {
  return {
    lat: parseFloat(lat.toFixed(2)),
    lon: parseFloat(lon.toFixed(2)),
  };
};

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

    const userId = new mongoose.Types.ObjectId(req.user.id);

    const { lat: roundedLat, lon: roundedLon } = roundCoordinates(lat, lon);
    const now = new Date();

    const cacheThreshold = new Date(now.getTime() - openWeatherConfig.cacheMinutes * 60 * 1000);
    let weatherDoc: WeatherDocument | null = null;

    try {
      weatherDoc = await WeatherCollection.findOne({
        lat: roundedLat,
        lon: roundedLon,
        fetchedAt: { $gte: cacheThreshold },
      });
    } catch (err: any) {
      logger.error(`Error querying weather cache: ${err.message}`);
    }

    let formattedData: FormattedWeatherData;

    if (weatherDoc) {
      const cachedApiData = weatherDoc.data as unknown as OpenWeatherApiData; 
      formattedData = {
        source: 'cache',
        coordinates: { lat: weatherDoc.lat, lon: weatherDoc.lon },
        tempC: cachedApiData.main.temp,
        humidity: cachedApiData.main.humidity,
        description: cachedApiData.weather[0].description,
        fetchedAt: weatherDoc.fetchedAt.toISOString(),
      };
      if (weatherDoc.source !== 'cache') {
          await WeatherCollection.updateOne({ _id: weatherDoc._id }, { $set: { source: 'cache' } });
          weatherDoc.source = 'cache';
      }

    } else {
      try {
        const response = await axios.get<OpenWeatherApiData>(openWeatherConfig.baseUrl, {
          params: {
            lat: lat,
            lon: lon,
            units: openWeatherConfig.units,
            appid: openWeatherConfig.apiKey,
          },
        });

        const apiData = response.data;
        formattedData = {
          source: 'openweather',
          coordinates: { lat: lat, lon: lon },
          tempC: apiData.main.temp,
          humidity: apiData.main.humidity,
          description: apiData.weather[0].description,
          fetchedAt: new Date(apiData.dt * 1000).toISOString(),
        };

        weatherDoc = await WeatherCollection.findOneAndUpdate(
          { lat: roundedLat, lon: roundedLon },
          {
            lat: roundedLat,
            lon: roundedLon,
            data: apiData,
            fetchedAt: now,
            source: 'openweather',
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

      } catch (error: any) {
        logger.error(`Error fetching from OpenWeather API: ${error.message}`);
        
        const staleCacheThreshold = new Date(now.getTime() - openWeatherConfig.staleCacheToleranceMinutes * 60 * 1000);
        const staleWeatherDoc = await WeatherCollection.findOne({
            lat: roundedLat,
            lon: roundedLon,
            fetchedAt: { $gte: staleCacheThreshold },
        });

        if (staleWeatherDoc) {
            logger.warn('OpenWeather API down, serving stale cache data.');
            const staleApiData = staleWeatherDoc.data as unknown as OpenWeatherApiData; 
            formattedData = {
                source: 'cache',
                coordinates: { lat: staleWeatherDoc.lat, lon: staleWeatherDoc.lon },
                tempC: staleApiData.main.temp,
                humidity: staleApiData.main.humidity,
                description: staleApiData.weather[0].description,
                fetchedAt: staleWeatherDoc.fetchedAt.toISOString(),
            };
            if (staleWeatherDoc.source !== 'cache') {
                await WeatherCollection.updateOne({ _id: staleWeatherDoc._id }, { $set: { source: 'cache' } });
                staleWeatherDoc.source = 'cache';
            }
            
            if (staleWeatherDoc._id) {
              await HistoryCollection.create({
                user: userId,
                weather: staleWeatherDoc._id,
                lat: lat,
                lon: lon,
                requestedAt: now,
              });
            }
            res.status(OK).json(formattedData);
            return;
        }

        if (error.response && error.response.status === 404) {
          throw new AppError('Weather data not found for given coordinates', NOT_FOUND);
        }
        throw new AppError('External weather service unavailable', SERVICE_UNAVAILABLE);
      }
    }

    if (weatherDoc && weatherDoc._id) {
      await HistoryCollection.create({
        user: userId,
        weather: weatherDoc._id,
        lat: lat,
        lon: lon,
        requestedAt: now,
      });
    }

    res.status(OK).json(formattedData);
    return;
  } catch (error) {
    next(error);
  }
};
