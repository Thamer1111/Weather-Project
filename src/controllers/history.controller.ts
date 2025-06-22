import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { OK, BAD_REQUEST } from '../utils/http-status';
import { AppError } from '../utils/error';
import mongoose from 'mongoose';
import { HistoryCollection } from '../models/history.model';

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

export const getHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new AppError('User not authenticated', BAD_REQUEST));
    }
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const { skip, limit, sort, from, to, lat, lon, count } = req.query;

    const parsedSkip = skip ? parseInt(skip as string, 10) : 0;
    const parsedLimit = limit ? parseInt(limit as string, 10) : 10;
    const parsedCount = count === 'true';

    let parsedLat: number | undefined;
    let parsedLon: number | undefined;

    if (lat !== undefined) {
        parsedLat = parseFloat(lat as string);
        if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
            throw new AppError('Invalid latitude value in filter', BAD_REQUEST);
        }
    }
    if (lon !== undefined) {
        parsedLon = parseFloat(lon as string);
        if (isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180) {
            throw new AppError('Invalid longitude value in filter', BAD_REQUEST);
        }
    }
    
    if ((parsedLat !== undefined && parsedLon === undefined) || (parsedLat === undefined && parsedLon !== undefined)) {
      throw new AppError('Both lat and lon must be provided for coordinate filtering', BAD_REQUEST);
    }
    
    const parsedFrom = from ? new Date(from as string) : undefined;
    const parsedTo = to ? new Date(to as string) : undefined;

    if (parsedFrom && isNaN(parsedFrom.getTime())) {
        throw new AppError('Invalid "from" date format', BAD_REQUEST);
    }
    if (parsedTo && isNaN(parsedTo.getTime())) {
        throw new AppError('Invalid "to" date format', BAD_REQUEST);
    }

    const historyQuery = {
      skip: parsedSkip,
      limit: parsedLimit,
      sort: sort as string | undefined,
      from: parsedFrom,
      to: parsedTo,
      lat: parsedLat,
      lon: parsedLon,
    };

    let matchQuery: any = { user: userId };
    if (historyQuery.from || historyQuery.to) {
      matchQuery.requestedAt = {};
      if (historyQuery.from) matchQuery.requestedAt.$gte = historyQuery.from;
      if (historyQuery.to) matchQuery.requestedAt.$lte = historyQuery.to;
    }
    if (historyQuery.lat !== undefined && historyQuery.lon !== undefined) {
      const roundedCoords = roundCoordinates(historyQuery.lat, historyQuery.lon);
      matchQuery.lat = roundedCoords.lat;
      matchQuery.lon = roundedCoords.lon;
    }

    let sortQuery: any = {};
    if (historyQuery.sort) {
      const direction = historyQuery.sort.startsWith('-') ? -1 : 1;
      const field = historyQuery.sort.startsWith('-') ? historyQuery.sort.substring(1) : historyQuery.sort;
      sortQuery[field] = direction;
    } else {
      sortQuery.requestedAt = -1;
    }

    if (parsedCount) {
      const total = await HistoryCollection.countDocuments(matchQuery);
      res.status(OK).json({ total });
      return;
    } else {
      const history = await HistoryCollection.aggregate([
        { $match: matchQuery },
        { $sort: sortQuery },
        { $skip: historyQuery.skip },
        { $limit: historyQuery.limit },
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
      res.status(OK).json(history);
      return;
    }
  } catch (error) {
    next(error);
  }
};
