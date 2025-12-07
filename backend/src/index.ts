import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { LoggedPrismaClient } from './utils/dbLogger';
import logger, { cleanupOldLogs } from './utils/logger';
import { requestLogger, errorLogger } from './middleware/requestLogger';

// Import routes
import accountRoutes from './routes/accounts';
import holdingsRoutes from './routes/holdings';
import positionsRoutes from './routes/positions';
import portfolioRoutes from './routes/portfolio';
import marginsRoutes from './routes/margins';
import captureTokenRoutes from './routes/captureToken';
import pnlRoutes from './routes/pnl';
import dividendRoutes from './routes/dividends';
import symbolMarginsRoutes from './routes/symbolMargins';
import fundTransactionRoutes from './routes/fundTransactions';
import historicalDataRoutes from './routes/historicalData';
import holdingCategoryMappingsRoutes from './routes/holdingCategoryMappings';

// Load environment variables
dotenv.config();

// Clean up old log files on startup
cleanupOldLogs();

const app = express();
const prisma = new LoggedPrismaClient();
const PORT = process.env.PORT || 7001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:7000',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(requestLogger);

// Health check endpoint
app.get('/api/health', (req, res) => {
  logger.info('Health check requested');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/accounts', accountRoutes);
app.use('/api/holdings', holdingsRoutes);
app.use('/api/holdingCategoryMappings', holdingCategoryMappingsRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/margins', marginsRoutes);
app.use('/api/captureToken', captureTokenRoutes);
app.use('/api/pnl', pnlRoutes);
app.use('/api/dividends', dividendRoutes);
app.use('/api/symbolMargins', symbolMarginsRoutes);
app.use('/api/fundTransactions', fundTransactionRoutes);
app.use('/api/historicalData', historicalDataRoutes);

// Direct auth routes (for easier redirect handling) - must be before 404 handler
app.use('/captureToken', captureTokenRoutes);

// Debug route to test if auth routes are working
app.get('/test-auth', (req, res) => {
  res.json({ message: 'Auth routes are working' });
});

// Error handling middleware
app.use(errorLogger);
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
  });
  
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
    await prisma.$disconnect();
    logger.info('Database disconnected');
  process.exit(0);
});

process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
    await prisma.$disconnect();
    logger.info('Database disconnected');
  process.exit(0);
});

// Uncaught exception handler
process.on('uncaughtException', (err) => {
  console.error('=== UNCAUGHT EXCEPTION DETECTED ===');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  console.error('====================================');
  
  logger.error('Uncaught Exception', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
  });
  
  // Give logger time to write before exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason,
    promise,
  });
  process.exit(1);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server started successfully`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:7000',
    nodeVersion: process.version,
    platform: process.platform,
  });
});

export { prisma }; 