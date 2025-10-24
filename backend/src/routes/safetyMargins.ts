import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../index';
import logger from '../utils/logger';

const router = express.Router();

// Validation middleware
const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// GET /api/safetyMargins - Get all safety margin records
router.get('/', [
  query('type').optional().isIn(['commodity', 'equity']).withMessage('Type must be either commodity or equity'),
  query('symbol').optional().isString().trim().withMessage('Symbol must be a string')
], validateRequest, async (req, res) => {
  try {
    const { type, symbol } = req.query;
    logger.info('Fetching safety margin records', { type, symbol });
    
    const whereClause: any = {};
    
    if (type) {
      whereClause.type = type;
    }
    
    if (symbol) {
      whereClause.symbol = {
        contains: symbol as string,
        mode: 'insensitive'
      };
    }
    
    const records = await prisma.safetyMargin.findMany({
      where: whereClause,
      orderBy: [
        { type: 'asc' },
        { symbol: 'asc' }
      ]
    });

    logger.info(`Found ${records.length} safety margin records`);
    res.json(records);
  } catch (error) {
    logger.error('Error fetching safety margin records', { error });
    res.status(500).json({ 
      error: 'Failed to fetch safety margin records',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/safetyMargins/:id - Get a specific safety margin record
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer')
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Fetching safety margin record with ID: ${id}`);
    
    const record = await prisma.safetyMargin.findUnique({
      where: { id: parseInt(id) }
    });

    if (!record) {
      logger.warn(`Safety margin record not found with ID: ${id}`);
      return res.status(404).json({ error: 'Safety margin record not found' });
    }

    logger.info(`Found safety margin record: ${record.symbol} (${record.type})`);
    res.json(record);
  } catch (error) {
    logger.error('Error fetching safety margin record', { error, id: req.params.id });
    res.status(500).json({ 
      error: 'Failed to fetch safety margin record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/safetyMargins/symbol/:symbol - Get safety margin by symbol and type
router.get('/symbol/:symbol', [
  param('symbol').isString().trim().isLength({ min: 1 }).withMessage('Symbol must be a non-empty string'),
  query('type').optional().isIn(['commodity', 'equity']).withMessage('Type must be either commodity or equity')
], validateRequest, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { type } = req.query;
    logger.info(`Fetching safety margin for symbol: ${symbol}`, { type });
    
    const whereClause: any = {
      symbol: {
        equals: symbol,
        mode: 'insensitive'
      }
    };
    
    if (type) {
      whereClause.type = type;
    }
    
    const records = await prisma.safetyMargin.findMany({
      where: whereClause,
      orderBy: { type: 'asc' }
    });

    if (records.length === 0) {
      logger.warn(`Safety margin record not found for symbol: ${symbol}`, { type });
      return res.status(404).json({ error: 'Safety margin record not found for this symbol' });
    }

    logger.info(`Found ${records.length} safety margin record(s) for symbol: ${symbol}`);
    res.json(records);
  } catch (error) {
    logger.error('Error fetching safety margin by symbol', { error, symbol: req.params.symbol });
    res.status(500).json({ 
      error: 'Failed to fetch safety margin by symbol',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/safetyMargins - Create a new safety margin record
router.post('/', [
  body('symbol')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Symbol must be a string between 1 and 50 characters'),
  body('safetyMargin')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Safety margin must be a number between 0 and 100'),
  body('type')
    .isString()
    .isIn(['commodity', 'equity'])
    .withMessage('Type must be either commodity or equity')
], validateRequest, async (req, res) => {
  try {
    const { symbol, safetyMargin, type } = req.body;
    logger.info(`Creating new safety margin record: ${symbol} with margin: ${safetyMargin} and type: ${type}`);
    
    const record = await prisma.safetyMargin.create({
      data: {
        symbol,
        safetyMargin: parseFloat(safetyMargin),
        type: type || 'commodity'
      }
    });

    logger.info(`Created safety margin record with ID: ${record.id}`);
    res.status(201).json(record);
  } catch (error) {
    logger.error('Error creating safety margin record', { error, body: req.body });
    
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return res.status(409).json({ 
        error: 'Safety margin record already exists',
        message: 'A record with this symbol and type already exists'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create safety margin record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/safetyMargins/:id - Update a safety margin record
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('symbol')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Symbol must be a string between 1 and 50 characters'),
  body('safetyMargin')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Safety margin must be a number between 0 and 100'),
  body('type')
    .isString()
    .isIn(['commodity', 'equity'])
    .withMessage('Type must be either commodity or equity')
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const { symbol, safetyMargin, type } = req.body;
    logger.info(`Updating safety margin record ID: ${id} with symbol: ${symbol}, margin: ${safetyMargin}, and type: ${type}`);
    
    // Check if record exists
    const existingRecord = await prisma.safetyMargin.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingRecord) {
      logger.warn(`Safety margin record not found with ID: ${id}`);
      return res.status(404).json({ error: 'Safety margin record not found' });
    }

    const record = await prisma.safetyMargin.update({
      where: { id: parseInt(id) },
      data: {
        symbol,
        safetyMargin: parseFloat(safetyMargin),
        type: type || 'commodity'
      }
    });

    logger.info(`Updated safety margin record with ID: ${record.id}`);
    res.json(record);
  } catch (error) {
    logger.error('Error updating safety margin record', { error, id: req.params.id, body: req.body });
    
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return res.status(409).json({ 
        error: 'Safety margin record already exists',
        message: 'A record with this symbol and type already exists'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update safety margin record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/safetyMargins/:id - Delete a safety margin record
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer')
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Deleting safety margin record with ID: ${id}`);
    
    // Check if record exists
    const existingRecord = await prisma.safetyMargin.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingRecord) {
      logger.warn(`Safety margin record not found with ID: ${id}`);
      return res.status(404).json({ error: 'Safety margin record not found' });
    }

    await prisma.safetyMargin.delete({
      where: { id: parseInt(id) }
    });

    logger.info(`Deleted safety margin record with ID: ${id}`);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting safety margin record', { error, id: req.params.id });
    res.status(500).json({ 
      error: 'Failed to delete safety margin record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
