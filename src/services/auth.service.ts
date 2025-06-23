import jwt from 'jsonwebtoken';
import { UsersCollection, UserDocument } from '../models/user.model';
import { jwtConfig, generateTokens } from '../config/jwt'; 
import { AppError } from '../utils/error';
import { BAD_REQUEST, NOT_FOUND, UNAUTHORIZED } from '../utils/http-status';
import { TokenBlacklistCollection } from '../models/tokenBlacklist.model';

export const signUp = async (userData: {
  email: string;
  password: string;
}): Promise<{ user: UserDocument; accessToken: string; refreshToken: string }> => {
  const existingUser = await UsersCollection.findOne({ email: userData.email });
  if (existingUser) {
    throw new AppError('Email already exists', BAD_REQUEST);
  }

  const user = await UsersCollection.create({ email: userData.email, passwordHash: userData.password });
  const { accessToken, refreshToken } = await generateTokens(user);

  return { user, accessToken, refreshToken };
};

export const signIn = async (email: string, password: string): Promise<{
  user: UserDocument;
  accessToken: string;
  refreshToken: string;
}> => {
  const user = await UsersCollection.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid credentials', UNAUTHORIZED);
  }

  const { accessToken, refreshToken } = await generateTokens(user);
  return { user, accessToken, refreshToken };
};

export const signOut = async (token: string | undefined): Promise<void> => {
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
};
