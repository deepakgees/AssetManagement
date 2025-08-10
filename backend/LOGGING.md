# Comprehensive Logging System

This document explains the comprehensive logging system implemented in the backend to help with debugging and monitoring.

## Overview

The logging system uses Winston with the following features:
- **Multiple log levels**: error, warn, info, http, debug
- **File rotation**: Logs are automatically rotated daily and compressed
- **Structured logging**: JSON format for easy parsing
- **Request/Response tracking**: Full HTTP request/response logging
- **Database query logging**: All database operations are logged
- **External API logging**: Zerodha API calls are tracked
- **Error tracking**: Comprehensive error logging with stack traces

## Log Files

Logs are stored in the `logs/` directory with the following files:

- `error-YYYY-MM-DD.log`: Only error level logs
- `combined-YYYY-MM-DD.log`: All log levels
- `http-YYYY-MM-DD.log`: HTTP request/response logs

## Log Levels

### Error (🔴)
- Application errors and exceptions
- Database connection failures
- External API errors
- Unhandled exceptions

### Warn (🟡)
- Validation failures
- Missing resources (404s)
- Rate limiting events
- Deprecated feature usage

### Info (🟢)
- Application startup/shutdown
- Successful operations
- Health checks
- Important business events

### HTTP (🟣)
- All HTTP requests and responses
- Request duration tracking
- Status codes and response sizes

### Debug (⚪)
- Database queries
- Detailed operation steps
- Cache operations
- Internal state changes

## Usage Examples

### Basic Logging

```typescript
import logger from '../utils/logger';

// Info level
logger.info('User logged in successfully', { userId: 123, email: 'user@example.com' });

// Error level
logger.error('Database connection failed', { 
  error: { message: 'Connection timeout', stack: error.stack },
  database: 'postgresql'
});

// Debug level
logger.debug('Processing user data', { userId: 123, step: 'validation' });
```

### Request Logging

The system automatically logs all HTTP requests with:
- Request method and URL
- Request headers (sensitive data hidden)
- Request body (for non-GET requests)
- Response status code and duration
- Response size

### Database Logging

All database operations are automatically logged:
- SQL queries with parameters
- Query execution time
- Database errors with full context

### External API Logging

```typescript
import { serviceLogger } from '../utils/serviceLogger';

// Log API calls
serviceLogger.logApiCall('Zerodha', 'GET', '/holdings', params, response, duration);

// Log API errors
serviceLogger.logApiError('Zerodha', 'POST', '/token', error, params);
```

## Debugging Common Issues

### 1. Database Connection Issues

Check the logs for:
```
🔗 Database connected
💥 Database Error
```

### 2. API Authentication Issues

Look for:
```
🔄 Starting token exchange process
💥 Token exchange error
```

### 3. Slow Response Times

Check HTTP logs for requests with high duration:
```
✅ GET /api/accounts - 200 (1500ms)
```

### 4. Missing Resources

Look for 404 warnings:
```
⚠️ Account not found with ID: 123
🚫 Route not found: GET /api/invalid
```

### 5. Validation Errors

Check for validation warnings:
```
⚠️ Account creation validation failed
```

## Environment Configuration

### Development
- All log levels enabled
- Console output with colors
- Detailed debug information

### Production
- Only warn and error levels
- File logging only
- Sanitized sensitive information

## Log Rotation

Logs are automatically rotated:
- **Daily rotation**: New log file each day
- **Compression**: Old logs are compressed
- **Retention**: Logs kept for 14 days
- **Size limit**: 20MB per file

## Monitoring and Alerts

### Error Rate Monitoring
Monitor `error-*.log` for:
- High error rates
- Specific error patterns
- Database connection failures

### Performance Monitoring
Monitor HTTP logs for:
- Slow response times (>1000ms)
- High error rates
- Unusual traffic patterns

### API Health Monitoring
Monitor service logs for:
- External API failures
- Authentication issues
- Rate limiting events

## Best Practices

### 1. Use Appropriate Log Levels
- **Error**: Only for actual errors that need attention
- **Warn**: For issues that might need investigation
- **Info**: For important business events
- **Debug**: For detailed troubleshooting

### 2. Include Context
Always include relevant context in log messages:
```typescript
logger.error('Failed to fetch user data', {
  userId: 123,
  operation: 'getUser',
  error: { message: error.message, stack: error.stack }
});
```

### 3. Sanitize Sensitive Data
Never log sensitive information:
- Passwords
- API keys
- Access tokens
- Personal data

### 4. Use Structured Logging
Use objects for structured data:
```typescript
logger.info('User action', {
  action: 'login',
  userId: 123,
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});
```

## Troubleshooting

### Logs Not Appearing
1. Check if logs directory exists
2. Verify file permissions
3. Check disk space
4. Ensure Winston is properly configured

### High Log Volume
1. Adjust log levels for production
2. Implement log filtering
3. Use log aggregation tools

### Performance Impact
1. Use async logging where possible
2. Implement log buffering
3. Consider log sampling for high-traffic endpoints

## Integration with Monitoring Tools

The structured JSON logs can be easily integrated with:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Splunk**
- **Datadog**
- **New Relic**
- **AWS CloudWatch**

## Security Considerations

1. **Log file permissions**: Ensure logs are not world-readable
2. **Sensitive data**: Never log passwords, tokens, or personal information
3. **Log retention**: Implement appropriate retention policies
4. **Access control**: Limit access to log files
5. **Encryption**: Consider encrypting log files in transit and at rest
