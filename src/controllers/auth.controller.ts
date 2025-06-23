import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { dev } from '../utils/helpers';
import { CREATED, OK, BAD_REQUEST, UNAUTHORIZED, NOT_FOUND } from '../utils/http-status';
import { AppError } from '../utils/error';
import * as AuthService from '../services/auth.service'; 

const signUp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const { user, accessToken, refreshToken } = await AuthService.signUp({ email, password });

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
    const { email, password } = req.body; // توقع email/password

    const { user, accessToken, refreshToken } = await AuthService.signIn(email, password);

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

  await AuthService.signOut(token);

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
