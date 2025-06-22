import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import logger from './utils/logger';
import { dev, port } from './utils/helpers';
import authRoutes from './routes/auth.routes';
import weatherRoutes from './routes/weather.routes';
import historyRoutes from './routes/history.routes';
import { OK, INTERNAL_SERVER_ERROR } from './utils/http-status';
import { connectDB } from './config/database';
import { AppError } from './utils/error';

dotenv.config();

connectDB();

const app: Express = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(helmet());
app.use(morgan('tiny', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/history', historyRoutes);

app.get('/', (req: Request, res: Response) => {
  res
    .status(OK)
    .json({ message: 'WeatherHub API - Welcome!' });
});

app.use((err: Error | AppError, req: Request, res: Response, next: NextFunction): void => {
  logger.error('Error:', err.message);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      ...(dev && { stack: err.stack })
    });
    return;
  }

  res.status(INTERNAL_SERVER_ERROR).json({
    status: 'error',
    message: 'Something went wrong!',
    ...(dev && { error: err.message, stack: err.stack })
  });
});

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});
