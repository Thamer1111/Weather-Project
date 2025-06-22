import jwt from 'jsonwebtoken';
import { UsersCollection, UserDocument } from '../models/user.model';
import { jwtConfig } from '../config/jwt';
import { AppError } from '../utils/error';
import { BAD_REQUEST, NOT_FOUND, UNAUTHORIZED } from '../utils/http-status';

const signUp = async (userData: {
  email: string;
  password: string;
}): Promise<{ user: UserDocument; accessToken: string; refreshToken: string }> => {
  const existingUser = await UsersCollection.findOne({ email: userData.email });
  if (existingUser) {
    throw new AppError('Email already exists', BAD_REQUEST);
  }

  const user = await UsersCollection.create({
    email: userData.email,
    passwordHash: userData.password
  });
  const { accessToken, refreshToken } = await generateTokens(user);

  return { user, accessToken, refreshToken };
}

const signIn = async (email: string, password: string): Promise<{
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
}

const generateTokens = async (
  user: UserDocument
): Promise<{ accessToken: string; refreshToken: string }> => {
  const accessToken = jwt.sign(
    {
      type: 'access',
      user: {
        id: user._id.toHexString(),
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    },
    jwtConfig.secret,
    jwtConfig.accessToken.options
  );

  const refreshToken = jwt.sign(
    {
      type: 'refresh',
      user: {
        id: user._id.toHexString(),
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    },
    jwtConfig.secret,
    jwtConfig.refreshToken.options
  );

  return { accessToken, refreshToken };
};

export {
  signUp,
  signIn,
  generateTokens,
};
