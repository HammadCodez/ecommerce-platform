import mongoose from 'mongoose';
import logger from '../utils/logger';

const { MONGO_URI, DB_NAME } = process.env;

if (!MONGO_URI) {
  logger.error('MONGO_URI environment variable not defined');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, { dbName: DB_NAME })
  .then((connection) => {
    logger.info(`MongoDB connected: ${connection.connection.host}`);
  })
  .catch((err) => {
    logger.error(`MongoDB connection error: ${err.message}`, { stack: err.stack });
    process.exit(1);
  });

export const dbConnection = mongoose.connection;
