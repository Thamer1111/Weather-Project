import mongoose from 'mongoose';
import logger from '../utils/logger';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb+srv://thamer:th11th11@weather-project.r8yzmxx.mongodb.net/?retryWrites=true&w=majority&appName=Weather-Project";

    await mongoose.connect(mongoURI);
    logger.info('MongoDB connected successfully');
  } catch (error: any) {
    logger.error('MongoDB connection error:', error.message || error);
    process.exit(1);
  }
};
