import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UsersCollection, UserDocument } from '../models/user.model';
import { jwtConfig } from '../config/jwt';
import { AppError } from '../utils/error';
import { FORBIDDEN, UNAUTHORIZED } from '../utils/http-status';
import logger from '../utils/logger';
import mongoose from 'mongoose';

export interface AuthRequest extends Request {
  user?: UserDocument;
}

export const authorized = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(new AppError('You are not logged in', UNAUTHORIZED));
    }

    const decoded = jwt.verify(token, jwtConfig.secret) as {
      type: string;
      user: {
        id: string;
        email: string;
        role: string;
      };
      iat: number;
      exp: number;
    };

    if (decoded.type !== 'access') {
      return next(new AppError('Invalid token type', UNAUTHORIZED));
    }

    const user = await UsersCollection.findById(decoded.user.id);
    if (!user) {
      return next(new AppError('User no longer exists', UNAUTHORIZED));
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token has expired', UNAUTHORIZED));
    } else {
      next(new AppError('Invalid token', UNAUTHORIZED));
    }
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', FORBIDDEN)
      );
    }
    next();
  };
};
