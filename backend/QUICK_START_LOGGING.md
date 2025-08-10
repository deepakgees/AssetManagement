# Quick Start: Logging System

## 🚀 Getting Started

### 1. Start the Server
```bash
npm run dev
```

The server will automatically start logging to the `logs/` directory.

### 2. Check Logs in Real-Time
```bash
# View recent logs
npm run logs:recent

# Check for errors
npm run logs:errors

# Analyze HTTP requests
npm run logs:http

# Search for specific issues
npm run logs:search "database"
```

## 🔍 Common Debugging Scenarios

### Database Issues
```bash
# Search for database errors
npm run logs:search "database"
npm run logs:search "prisma"
```

### API Issues
```bash
# Search for Zerodha API issues
npm run logs:search "zerodha"
npm run logs:search "token"
```

### Slow Performance
```bash
# Check for slow requests
npm run logs:http
```

### Authentication Issues
```bash
# Search for auth problems
npm run logs:search "authentication"
npm run logs:search "token"
```

## 📊 Log File Structure

- `error-YYYY-MM-DD.log` - Only errors
- `combined-YYYY-MM-DD.log` - All logs
- `http-YYYY-MM-DD.log` - HTTP requests only

## 🎯 Quick Commands

```bash
# Show log summary
npm run logs:summary

# View last 50 log entries
npm run logs:recent 50

# Search for specific error
npm run logs:search "Connection timeout"

# Check today's errors
npm run logs:errors
```

## 🔧 Adding Logs to Your Code

### Basic Logging
```typescript
import logger from '../utils/logger';

// Info level
logger.info('Operation completed', { userId: 123, result: 'success' });

// Error level
logger.error('Something went wrong', { error: error.message, stack: error.stack });

// Debug level
logger.debug('Processing step', { step: 'validation', data: { ... } });
```

### Service Logging
```typescript
import { serviceLogger } from '../utils/serviceLogger';

// Log API calls
serviceLogger.logApiCall('ServiceName', 'GET', '/endpoint', params, response, duration);

// Log service errors
serviceLogger.logServiceError('ServiceName', 'operation', error, context);
```

## 🚨 Emergency Debugging

### 1. Server Won't Start
```bash
# Check for startup errors
npm run logs:search "startup"
npm run logs:search "port"
```

### 2. Database Connection Issues
```bash
# Check database logs
npm run logs:search "database"
npm run logs:search "connection"
```

### 3. API Authentication Failing
```bash
# Check Zerodha API issues
npm run logs:search "zerodha"
npm run logs:search "token"
```

### 4. Slow Response Times
```bash
# Check HTTP performance
npm run logs:http
```

## 📈 Monitoring Best Practices

1. **Check logs regularly**: Run `npm run logs:recent` daily
2. **Monitor errors**: Run `npm run logs:errors` when issues occur
3. **Track performance**: Use `npm run logs:http` to identify slow endpoints
4. **Search effectively**: Use specific terms like "database", "api", "error"

## 🔒 Security Notes

- Logs are automatically sanitized (passwords, tokens hidden)
- Log files are in `.gitignore` (not committed to repo)
- Sensitive data is automatically filtered out

## 📞 Need Help?

1. Check the comprehensive documentation: `LOGGING.md`
2. Use the log analyzer: `npm run logs:summary`
3. Search for specific issues: `npm run logs:search "your-issue"`

## 🎯 Pro Tips

- Use emojis in log messages for quick visual scanning
- Include context objects for better debugging
- Use appropriate log levels (error, warn, info, debug)
- Monitor log file sizes to prevent disk space issues
