import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { OK, BAD_REQUEST } from '../utils/http-status';
import { AppError } from '../utils/error';
import mongoose from 'mongoose';
import * as HistoryService from '../services/history.service'; // استيراد HistoryService

export const getHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', BAD_REQUEST);
    }
    const userId = req.user._id;
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

    if (parsedCount) {
      const total = await HistoryService.countHistory(userId, historyQuery);
      res.status(OK).json({ total });
      return;
    } else {
      const history = await HistoryService.getHistory(userId, historyQuery);
      res.status(OK).json(history);
      return;
    }
  } catch (error) {
    next(error);
  }
};
