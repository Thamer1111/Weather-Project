import { Request, Response, NextFunction } from 'express';
import * as HistoryService from '../services/history.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { OK, BAD_REQUEST } from '../utils/http-status';
import { AppError } from '../utils/error';
import mongoose from 'mongoose';

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

    const parsedLat = lat ? parseFloat(lat as string) : undefined;
    const parsedLon = lon ? parseFloat(lon as string) : undefined;

    if (parsedLat !== undefined && (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90)) {
        throw new AppError('Invalid latitude filter', BAD_REQUEST);
    }
    if (parsedLon !== undefined && (isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180)) {
        throw new AppError('Invalid longitude filter', BAD_REQUEST);
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

    if (parsedCount) {
      const total = await HistoryService.countHistory(userId, historyQuery);
      res.status(OK).json({ total });
    } else {
      const history = await HistoryService.getHistory(userId, historyQuery);
      res.status(OK).json(history);
    }
  } catch (error) {
    next(error);
  }
};
