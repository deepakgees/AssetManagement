import logger from './logger';
import { PrismaClient } from '@prisma/client';

export class DatabaseLogger {
  private logger = logger;

  logQuery(query: string, params: any, duration: number) {
    // Query logging disabled as per requirements
    // this.logger.debug(`Database Query`, {
    //   query,
    //   params,
    //   duration: `${duration}ms`,
    // });
  }

  logError(error: any, query?: string, params?: any) {
    this.logger.error(`Database Error`, {
      error: {
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack,
      },
      query,
      params,
    });
  }

  logConnection(status: 'connected' | 'disconnected' | 'error') {
    this.logger.info(`Database ${status}`, {
      status,
    });
  }

  logTransaction(operation: 'begin' | 'commit' | 'rollback', duration?: number) {
    // Transaction logging disabled as per requirements
    // this.logger.debug(`Database Transaction ${operation}`, {
    //   operation,
    //   duration: duration ? `${duration}ms` : undefined,
    // });
  }
}

// Create a singleton instance
export const dbLogger = new DatabaseLogger();

// Extend PrismaClient with logging
export class LoggedPrismaClient extends PrismaClient {
  constructor() {
    super({
      log: [
        // Query logging disabled as per requirements
        // {
        //   emit: 'event',
        //   level: 'query',
        // },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });

    // Query logging disabled as per requirements
    // this.$on('query', (e) => {
    //   dbLogger.logQuery(e.query, e.params, e.duration);
    // });

    // Log errors
    this.$on('error', (e) => {
      dbLogger.logError(e);
    });

    // Log info
    this.$on('info', (e) => {
      logger.info(`Database Info: ${e.message}`);
    });

    // Log warnings
    this.$on('warn', (e) => {
      logger.warn(`Database Warning: ${e.message}`);
    });
  }
}
