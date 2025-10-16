import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for logs (time only, no date)
const format = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define format for file logs (time only, no date)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...rest } = info;
    const restString = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
    return `${timestamp} ${level} ${message}${restString}`;
  }),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format,
  }),
  
  // Single daily log file for all logs
  new DailyRotateFile({
    filename: path.join('logs', '%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '5d', // Keep only 5 days of logs
    format: fileFormat,
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: fileFormat,
  transports,
});

// Create a stream object for Morgan HTTP logging
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Function to clean up old log files (keep only last 5)
export const cleanupOldLogs = () => {
  const logsDir = path.join(process.cwd(), 'logs');
  
  try {
    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      return;
    }

    // Get all log files (including .gz files and audit files)
    const files = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.log') || file.endsWith('.log.gz') || file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(logsDir, file),
        stats: fs.statSync(path.join(logsDir, file))
      }))
      .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()); // Sort by modification time, newest first

    // Keep only the 5 most recent files
    if (files.length > 5) {
      const filesToDelete = files.slice(5);
      
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
          console.log(`Deleted old log file: ${file.name}`);
        } catch (error) {
          console.error(`Failed to delete log file ${file.name}:`, error);
        }
      });
      
      console.log(`Cleaned up ${filesToDelete.length} old log files. Kept ${files.length - filesToDelete.length} most recent files.`);
    } else {
      console.log(`No cleanup needed. Found ${files.length} log files (keeping all).`);
    }
  } catch (error) {
    console.error('Error during log cleanup:', error);
  }
};

export default logger;
