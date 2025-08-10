import logger from './logger';

export class ServiceLogger {
  private logger = logger;

  logApiCall(service: string, method: string, url: string, params?: any, response?: any, duration?: number) {
    this.logger.info(`${service} API Call`, {
      service,
      method,
      url,
      params,
      response: response ? this.sanitizeResponse(response) : undefined,
      duration: duration ? `${duration}ms` : undefined,
    });
  }

  logApiError(service: string, method: string, url: string, error: any, params?: any) {
    this.logger.error(`${service} API Error`, {
      service,
      method,
      url,
      error: {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        code: error.code,
        stack: error.stack,
      },
      params,
    });
  }

  logServiceOperation(service: string, operation: string, details?: any, duration?: number) {
    this.logger.info(`${service} Operation`, {
      service,
      operation,
      details,
      duration: duration ? `${duration}ms` : undefined,
    });
  }

  logServiceError(service: string, operation: string, error: any, details?: any) {
    this.logger.error(`${service} Service Error`, {
      service,
      operation,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
      details,
    });
  }

  logCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, duration?: number) {
    this.logger.debug(`Cache ${operation}`, {
      operation,
      key,
      duration: duration ? `${duration}ms` : undefined,
    });
  }

  private sanitizeResponse(response: any): any {
    if (typeof response === 'object') {
      const sanitized = { ...response };
      // Remove sensitive fields
      delete sanitized.token;
      delete sanitized.access_token;
      delete sanitized.refresh_token;
      delete sanitized.password;
      delete sanitized.secret;
      return sanitized;
    }
    return response;
  }
}

// Create a singleton instance
export const serviceLogger = new ServiceLogger();
