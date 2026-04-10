// backend/src/utils/logger.ts
import fs from 'fs';
import path from 'path';
import winston from 'winston';
import 'winston-daily-rotate-file';

// Ensure the logs directory exists
const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Determine environment and log level
const env = process.env.NODE_ENV?.trim() ?? 'development';
const level = env === 'production' ? 'info' : 'debug';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// File transport (daily rotating)
const fileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level,
  format: combine(timestamp(), errors({ stack: true }), json()),
});

// Console transport (development only)
const consoleTransport = new winston.transports.Console({
  level,
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    printf(({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`)
  ),
  silent: env === 'production',
});

const logger = winston.createLogger({
  level,
  transports: [fileTransport, consoleTransport],
  exitOnError: false,
});

// Add http shortcut method that returns the logger instance for proper typing
(logger as any).http = (message: string): void => {
  logger.log({ level: 'http', message });
};






export default logger as winston.Logger & { http: (message: string) => void };
