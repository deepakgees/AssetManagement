import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { LoggedPrismaClient } from './utils/dbLogger';
import logger from './utils/logger';
import { requestLogger, errorLogger } from './middleware/requestLogger';

// Import routes
import accountRoutes from './routes/accounts';
import holdingsRoutes from './routes/holdings';
import positionsRoutes from './routes/positions';
import portfolioRoutes from './routes/portfolio';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new LoggedPrismaClient();
const PORT = process.env.PORT || 7001;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

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
app.use('/api/positions', positionsRoutes);
app.use('/api/portfolio', portfolioRoutes);

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
  logger.error('Uncaught Exception', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
  });
  process.exit(1);
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