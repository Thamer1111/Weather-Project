import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { dev } from '../utils/helpers';
import { CREATED, OK, BAD_REQUEST, UNAUTHORIZED, NOT_FOUND } from '../utils/http-status';
import { AppError } from '../utils/error';
import { UsersCollection, UserDocument } from '../models/user.model';
import { generateTokens, jwtConfig } from '../config/jwt';
import jwt from 'jsonwebtoken';
import { TokenBlacklistCollection } from '../models/tokenBlacklist.model'; 

const signUp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const existingUser = await UsersCollection.findOne({ email });
    if (existingUser) {
      throw new AppError('Email already exists', BAD_REQUEST);
    }

    const user = await UsersCollection.create({ email, passwordHash: password });
    const { accessToken, refreshToken } = await generateTokens(user);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: !dev,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: !dev,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    res.status(CREATED).json({
      token: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

const signIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await UsersCollection.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid credentials', UNAUTHORIZED);
    }

    const { accessToken, refreshToken } = await generateTokens(user);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: !dev,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: !dev,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(OK).json({
      token: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

const signOut = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.accessToken || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

  if (token) {
    try {
      const decoded = jwt.decode(token) as { exp: number }; 
      if (decoded && decoded.exp) {
        const expiresAt = new Date(decoded.exp * 1000); 
        await TokenBlacklistCollection.create({ token, expiresAt }); 
      }
    } catch (error) {
      console.warn("Failed to blacklist token or token already expired:", error);
    }
  }

  res.cookie('accessToken', 'none', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
  });
  res.cookie('refreshToken', 'none', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
  });

  res.status(OK).send();
};

export {
  signUp,
  signIn,
  signOut,
};
