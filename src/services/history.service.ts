import { HistoryCollection, HistoryDocument } from '../models/history.model';
import { AppError } from '../utils/error';
import { BAD_REQUEST } from '../utils/http-status';
import mongoose from 'mongoose';

interface HistoryQueryParams {
  skip?: number;
  limit?: number;
  sort?: string;
  from?: Date;
  to?: Date;
  lat?: number;
  lon?: number;
}

const roundCoordinates = (lat: number, lon: number) => {
  return {
    lat: parseFloat(lat.toFixed(2)),
    lon: parseFloat(lon.toFixed(2)),
  };
};

export const getHistory = async (userId: mongoose.Types.ObjectId, params: HistoryQueryParams): Promise<any[]> => {
  const { skip = 0, limit = 10, sort = '-requestedAt', from, to, lat, lon } = params;

  let matchQuery: any = { user: userId };
  if (from || to) {
    matchQuery.requestedAt = {};
    if (from) matchQuery.requestedAt.$gte = from;
    if (to) matchQuery.requestedAt.$lte = to;
  }
  if (lat !== undefined && lon !== undefined) {
    const roundedCoords = roundCoordinates(lat, lon);
    matchQuery.lat = roundedCoords.lat;
    matchQuery.lon = roundedCoords.lon;
  } else if (lat !== undefined || lon !== undefined) {
      throw new AppError('Both lat and lon must be provided for coordinate filtering', BAD_REQUEST);
  }

  let sortQuery: any = {};
  if (sort) {
    const direction = sort.startsWith('-') ? -1 : 1;
    const field = sort.startsWith('-') ? sort.substring(1) : sort;
    sortQuery[field] = direction;
  } else {
    sortQuery.requestedAt = -1;
  }

  const history = await HistoryCollection.aggregate([
    { $match: matchQuery },
    { $sort: sortQuery },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: 'weathers', 
        localField: 'weather',
        foreignField: '_id',
        as: 'weatherDetails'
      }
    },
    { $unwind: { path: '$weatherDetails', preserveNullAndEmptyArrays: true } }, 
    {
      $project: {
        _id: 0, 
        lat: '$lat',
        lon: '$lon',
        requestedAt: '$requestedAt',
        weather: {
          source: { $ifNull: ['$weatherDetails.source', 'openweather'] }, 
          tempC: '$weatherDetails.data.main.temp',
          
          description: { $ifNull: ['$weatherDetails.data.weather.0.description', 'N/A'] },
          fetchedAt: '$weatherDetails.fetchedAt' 
        }
      }
    }
  ]);

  return history;
};

export const countHistory = async (userId: mongoose.Types.ObjectId, params: HistoryQueryParams): Promise<number> => {
  const { from, to, lat, lon } = params;

  let matchQuery: any = { user: userId };
  if (from || to) {
    matchQuery.requestedAt = {};
    if (from) matchQuery.requestedAt.$gte = from;
    if (to) matchQuery.requestedAt.$lte = to;
  }
  if (lat !== undefined && lon !== undefined) {
    const roundedCoords = roundCoordinates(lat, lon);
    matchQuery.lat = roundedCoords.lat;
    matchQuery.lon = roundedCoords.lon;
  } else if (lat !== undefined || lon !== undefined) {
      throw new AppError('Both lat and lon must be provided for coordinate filtering', BAD_REQUEST);
  }

  return HistoryCollection.countDocuments(matchQuery);
};
