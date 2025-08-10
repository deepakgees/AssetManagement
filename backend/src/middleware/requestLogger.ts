import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface LoggedRequest extends Request {
  startTime?: number;
}

export const requestLogger = (req: LoggedRequest, res: Response, next: NextFunction) => {
  // Add start time to request object
  req.startTime = Date.now();

  // Log basic request information only
  logger.info(`${req.method} ${req.originalUrl}`);

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - (req.startTime || 0);
    
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

export const errorLogger = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Error in ${req.method} ${req.originalUrl}`, {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
  });

  next(err);
};
