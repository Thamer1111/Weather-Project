import axios from 'axios';
import { WeatherCollection, WeatherDocument } from '../models/weather.model';
import { HistoryCollection } from '../models/history.model';
import { openWeatherConfig } from '../config/openweather';
import { AppError } from '../utils/error';
import { SERVICE_UNAVAILABLE, NOT_FOUND } from '../utils/http-status';
import logger from '../utils/logger';
import mongoose from 'mongoose';

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

export const getWeather = async (userId: mongoose.Types.ObjectId, rawLat: number, rawLon: number): Promise<FormattedWeatherData> => {
  const { lat: roundedLat, lon: roundedLon } = roundCoordinates(rawLat, rawLon);
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
          lat: rawLat,
          lon: rawLon,
          units: openWeatherConfig.units,
          appid: openWeatherConfig.apiKey,
        },
      });

      const apiData = response.data;
      formattedData = {
        source: 'openweather',
        coordinates: { lat: rawLat, lon: rawLon },
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
              lat: rawLat,
              lon: rawLon,
              requestedAt: now,
            });
          }
          return formattedData;
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
      lat: rawLat,
      lon: rawLon,
      requestedAt: now,
    });
  }

  return formattedData;
};
