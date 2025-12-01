import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { prisma } from '../index';
import logger from '../utils/logger';
import axios from 'axios';

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

// GET /api/symbolMargins - Get all symbol margin records
router.get('/', [
  query('symbolType').optional().isIn(['equity', 'commodity', 'currency', 'debt']).withMessage('Symbol type must be one of: equity, commodity, currency, debt'),
  query('symbol').optional().isString().trim().withMessage('Symbol must be a string'),
  query('hasSafetyMargin').optional().isBoolean().withMessage('hasSafetyMargin must be a boolean')
], validateRequest, async (req, res) => {
  try {
    const { symbolType, symbol, hasSafetyMargin } = req.query;
    logger.info('Fetching symbol margin records', { symbolType, symbol, hasSafetyMargin });
    
    const whereClause: any = {};
    
    if (symbolType) {
      whereClause.symbolType = symbolType;
    }
    
    if (symbol) {
      whereClause.symbol = {
        contains: symbol as string,
        mode: 'insensitive'
      };
    }
    
    if (hasSafetyMargin !== undefined) {
      if (hasSafetyMargin === 'true') {
        whereClause.safetyMargin = { not: null };
      } else {
        whereClause.safetyMargin = null;
      }
    }
    
    const records = await prisma.symbolMargin.findMany({
      where: whereClause,
      orderBy: [
        { symbolType: 'asc' },
        { symbol: 'asc' }
      ]
    });

    logger.info(`Found ${records.length} symbol margin records`);
    res.json(records);
  } catch (error) {
    logger.error('Error fetching symbol margin records', { error });
    res.status(500).json({ 
      error: 'Failed to fetch symbol margin records',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/symbolMargins/:id - Get a specific symbol margin record
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer')
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Fetching symbol margin record with ID: ${id}`);
    
    const record = await prisma.symbolMargin.findUnique({
      where: { id: parseInt(id) }
    });

    if (!record) {
      logger.warn(`Symbol margin record not found with ID: ${id}`);
      return res.status(404).json({ error: 'Symbol margin record not found' });
    }

    logger.info(`Found symbol margin record: ${record.symbol} (${record.symbolType})`);
    res.json(record);
  } catch (error) {
    logger.error('Error fetching symbol margin record', { error, id: req.params.id });
    res.status(500).json({ 
      error: 'Failed to fetch symbol margin record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/symbolMargins/symbol/:symbol - Get symbol margin by symbol and type
router.get('/symbol/:symbol', [
  param('symbol').isString().trim().isLength({ min: 1 }).withMessage('Symbol must be a non-empty string'),
  query('symbolType').optional().isIn(['equity', 'commodity', 'currency', 'debt']).withMessage('Symbol type must be one of: equity, commodity, currency, debt')
], validateRequest, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { symbolType } = req.query;
    logger.info(`Fetching symbol margin for symbol: ${symbol}`, { symbolType });
    
    const whereClause: any = {
      symbol: {
        equals: symbol,
        mode: 'insensitive'
      }
    };
    
    if (symbolType) {
      whereClause.symbolType = symbolType;
    }
    
    const records = await prisma.symbolMargin.findMany({
      where: whereClause,
      orderBy: { symbolType: 'asc' }
    });

    if (records.length === 0) {
      logger.warn(`Symbol margin record not found for symbol: ${symbol}`, { symbolType });
      return res.status(404).json({ error: 'Symbol margin record not found for this symbol' });
    }

    logger.info(`Found ${records.length} symbol margin record(s) for symbol: ${symbol}`);
    res.json(records);
  } catch (error) {
    logger.error('Error fetching symbol margin by symbol', { error, symbol: req.params.symbol });
    res.status(500).json({ 
      error: 'Failed to fetch symbol margin by symbol',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/symbolMargins - Create a new symbol margin record
router.post('/', [
  body('symbol')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Symbol must be a string between 1 and 50 characters'),
  body('margin')
    .isFloat({ min: 0 })
    .withMessage('Margin must be a positive number'),
  body('safetyMargin')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Safety margin must be a number between 0 and 100'),
  body('lotSize')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Lot size must be a positive integer'),
  body('symbolType')
    .isString()
    .isIn(['equity', 'commodity', 'currency', 'debt'])
    .withMessage('Symbol type must be one of: equity, commodity, currency, debt')
], validateRequest, async (req, res) => {
  try {
    const { symbol, margin, safetyMargin, lotSize, symbolType } = req.body;
    logger.info(`Creating new symbol margin record: ${symbol} with margin: ${margin}, safetyMargin: ${safetyMargin}, lotSize: ${lotSize}, and type: ${symbolType}`);
    
    const record = await prisma.symbolMargin.create({
      data: {
        symbol,
        margin: parseFloat(margin),
        safetyMargin: safetyMargin ? parseFloat(safetyMargin) : null,
        lotSize: lotSize ? parseInt(lotSize) : null,
        symbolType: symbolType || 'equity'
      }
    });

    logger.info(`Created symbol margin record with ID: ${record.id}`);
    res.status(201).json(record);
  } catch (error) {
    logger.error('Error creating symbol margin record', { error, body: req.body });
    
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return res.status(409).json({ 
        error: 'Symbol margin record already exists',
        message: 'A record with this symbol and type already exists'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create symbol margin record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/symbolMargins/:id - Update a symbol margin record
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('symbol')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Symbol must be a string between 1 and 50 characters'),
  body('margin')
    .isFloat({ min: 0 })
    .withMessage('Margin must be a positive number'),
  body('safetyMargin')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Safety margin must be a number between 0 and 100'),
  body('lotSize')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Lot size must be a positive integer'),
  body('symbolType')
    .isString()
    .isIn(['equity', 'commodity', 'currency', 'debt'])
    .withMessage('Symbol type must be one of: equity, commodity, currency, debt')
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const { symbol, margin, safetyMargin, lotSize, symbolType } = req.body;
    logger.info(`Updating symbol margin record ID: ${id} with symbol: ${symbol}, margin: ${margin}, safetyMargin: ${safetyMargin}, lotSize: ${lotSize}, and type: ${symbolType}`);
    
    // Check if record exists
    const existingRecord = await prisma.symbolMargin.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingRecord) {
      logger.warn(`Symbol margin record not found with ID: ${id}`);
      return res.status(404).json({ error: 'Symbol margin record not found' });
    }

    const record = await prisma.symbolMargin.update({
      where: { id: parseInt(id) },
      data: {
        symbol,
        margin: parseFloat(margin),
        safetyMargin: safetyMargin ? parseFloat(safetyMargin) : null,
        lotSize: lotSize !== undefined ? (lotSize ? parseInt(lotSize) : null) : undefined,
        symbolType: symbolType || 'equity'
      }
    });

    logger.info(`Updated symbol margin record with ID: ${record.id}`);
    res.json(record);
  } catch (error) {
    logger.error('Error updating symbol margin record', { error, id: req.params.id, body: req.body });
    
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return res.status(409).json({ 
        error: 'Symbol margin record already exists',
        message: 'A record with this symbol and type already exists'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update symbol margin record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PATCH /api/symbolMargins/:id/safety-margin - Update only safety margin
router.patch('/:id/safety-margin', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('safetyMargin')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Safety margin must be a number between 0 and 100')
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const { safetyMargin } = req.body;
    logger.info(`Updating safety margin for record ID: ${id} to: ${safetyMargin}`);
    
    // Check if record exists
    const existingRecord = await prisma.symbolMargin.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingRecord) {
      logger.warn(`Symbol margin record not found with ID: ${id}`);
      return res.status(404).json({ error: 'Symbol margin record not found' });
    }

    const record = await prisma.symbolMargin.update({
      where: { id: parseInt(id) },
      data: {
        safetyMargin: safetyMargin || null
      }
    });

    logger.info(`Updated safety margin for record ID: ${id}`);
    res.json(record);
  } catch (error) {
    logger.error('Error updating safety margin', { error, id: req.params.id });
    res.status(500).json({ 
      error: 'Failed to update safety margin',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/symbolMargins/:id/historical-count - Get historical record count for a symbol
router.get('/:id/historical-count', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer')
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Getting historical record count for symbol margin ID: ${id}`);
    
    // Get the symbol margin record
    const symbolMargin = await prisma.symbolMargin.findUnique({
      where: { id: parseInt(id) },
      select: { symbol: true, symbolType: true }
    });

    if (!symbolMargin) {
      logger.warn(`Symbol margin record not found with ID: ${id}`);
      return res.status(404).json({ error: 'Symbol margin record not found' });
    }

    let historicalCount = 0;
    
    // Only count historical records for equity symbols
    if (symbolMargin.symbolType === 'equity') {
      historicalCount = await prisma.historicalPriceEquity.count({
        where: { symbol: symbolMargin.symbol }
      });
    }

    logger.info(`Historical record count for symbol ${symbolMargin.symbol}: ${historicalCount}`);
    res.json({ 
      symbol: symbolMargin.symbol,
      symbolType: symbolMargin.symbolType,
      historicalCount 
    });
  } catch (error) {
    logger.error('Error getting historical record count', { error, id: req.params.id });
    res.status(500).json({ 
      error: 'Failed to get historical record count',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/symbolMargins/:id - Delete a symbol margin record
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer')
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Deleting symbol margin record with ID: ${id}`);
    
    // Check if record exists
    const existingRecord = await prisma.symbolMargin.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingRecord) {
      logger.warn(`Symbol margin record not found with ID: ${id}`);
      return res.status(404).json({ error: 'Symbol margin record not found' });
    }

    // If it's an equity symbol, also delete historical data
    if (existingRecord.symbolType === 'equity') {
      logger.info(`Deleting historical data for equity symbol: ${existingRecord.symbol}`);
      
      // Delete historical price data for this equity symbol
      const deletedHistoricalData = await prisma.historicalPriceEquity.deleteMany({
        where: { symbol: existingRecord.symbol }
      });
      
      logger.info(`Deleted ${deletedHistoricalData.count} historical records for symbol: ${existingRecord.symbol}`);
    }

    // Delete the symbol margin record
    await prisma.symbolMargin.delete({
      where: { id: parseInt(id) }
    });

    logger.info(`Deleted symbol margin record with ID: ${id}`);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting symbol margin record', { error, id: req.params.id });
    res.status(500).json({ 
      error: 'Failed to delete symbol margin record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/symbolMargins/sync-commodities - Sync commodities from Kite API
router.post('/sync-commodities', async (req, res) => {
  try {
    logger.info('Starting commodities sync from Kite API');
    
    // Fetch commodities data from Kite API
    const response = await axios.get('https://api.kite.trade/margins/commodity');
    const commoditiesData = response.data;
    
    logger.info(`Fetched ${commoditiesData.length} commodity records from Kite API`);
    
    // Group by trading symbol and find the highest nrml_margin for each symbol
    const symbolMargins = new Map<string, number>();
    
    commoditiesData.forEach((item: any) => {
      const symbol = item.tradingsymbol;
      const margin = item.nrml_margin;
      
      if (symbol && margin) {
        // If symbol already exists, take the higher margin value
        if (symbolMargins.has(symbol)) {
          const existingMargin = symbolMargins.get(symbol) || 0;
          if (margin > existingMargin) {
            symbolMargins.set(symbol, margin);
          }
        } else {
          symbolMargins.set(symbol, margin);
        }
      }
    });
    
    logger.info(`Processed ${symbolMargins.size} unique symbols`);
    
    let createdCount = 0;
    let updatedCount = 0;
    
    // Process each symbol margin
    for (const [symbol, margin] of symbolMargins) {
      try {
        // Check if record already exists
        const existingRecord = await prisma.symbolMargin.findFirst({
          where: {
            symbol: {
              equals: symbol,
              mode: 'insensitive'
            },
            symbolType: 'commodity'
          }
        });
        
        if (existingRecord) {
          // Update existing record if margin is different
          if (existingRecord.margin !== margin) {
            await prisma.symbolMargin.update({
              where: { id: existingRecord.id },
              data: { margin }
            });
            updatedCount++;
            logger.info(`Updated margin for ${symbol}: ${existingRecord.margin} -> ${margin}`);
          }
        } else {
          // Create new record
          await prisma.symbolMargin.create({
            data: {
              symbol,
              margin,
              symbolType: 'commodity'
            }
          });
          createdCount++;
          logger.info(`Created new record for ${symbol} with margin: ${margin} and type: commodity`);
        }
      } catch (error) {
        logger.error(`Error processing symbol ${symbol}:`, error);
        // Continue with other symbols even if one fails
      }
    }
    
    logger.info(`Commodities sync completed. Created: ${createdCount}, Updated: ${updatedCount}`);
    
    res.json({
      success: true,
      message: 'Commodities synced successfully',
      stats: {
        totalFetched: commoditiesData.length,
        uniqueSymbols: symbolMargins.size,
        created: createdCount,
        updated: updatedCount
      }
    });
    
  } catch (error) {
    logger.error('Error syncing commodities:', error);
    res.status(500).json({
      error: 'Failed to sync commodities',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/symbolMargins/sync-equities - Sync equities from Kite API
router.post('/sync-equities', async (req, res) => {
  try {
    logger.info('Starting equities sync from Kite API');
    
    // Fetch equities data from Kite API
    const response = await axios.get('https://api.kite.trade/margins/equity');
    const equitiesData = response.data;
    
    logger.info(`Fetched ${equitiesData.length} equity records from Kite API`);
    
    // Group by trading symbol and find the highest mis_margin for each symbol
    const symbolMargins = new Map<string, number>();
    
    equitiesData.forEach((item: any) => {
      const symbol = item.tradingsymbol;
      const margin = item.mis_margin; // Use mis_margin for equities
      
      if (symbol && margin) {
        // If symbol already exists, take the higher margin value
        if (symbolMargins.has(symbol)) {
          const existingMargin = symbolMargins.get(symbol) || 0;
          if (margin > existingMargin) {
            symbolMargins.set(symbol, margin);
          }
        } else {
          symbolMargins.set(symbol, margin);
        }
      }
    });
    
    logger.info(`Processed ${symbolMargins.size} unique equity symbols`);
    
    let createdCount = 0;
    let updatedCount = 0;
    
    // Process each symbol margin
    for (const [symbol, margin] of symbolMargins) {
      try {
        // Check if record already exists
        const existingRecord = await prisma.symbolMargin.findFirst({
          where: {
            symbol: {
              equals: symbol,
              mode: 'insensitive'
            },
            symbolType: 'equity'
          }
        });
        
        if (existingRecord) {
          // Update existing record if margin is different
          if (existingRecord.margin !== margin) {
            await prisma.symbolMargin.update({
              where: { id: existingRecord.id },
              data: { margin }
            });
            updatedCount++;
            logger.info(`Updated margin for ${symbol}: ${existingRecord.margin} -> ${margin}`);
          }
        } else {
          // Create new record
          await prisma.symbolMargin.create({
            data: {
              symbol,
              margin,
              symbolType: 'equity'
            }
          });
          createdCount++;
          logger.info(`Created new record for ${symbol} with margin: ${margin} and type: equity`);
        }
      } catch (error) {
        logger.error(`Error processing symbol ${symbol}:`, error);
        // Continue with other symbols even if one fails
      }
    }
    
    logger.info(`Equities sync completed. Created: ${createdCount}, Updated: ${updatedCount}`);
    
    res.json({
      success: true,
      message: 'Equities synced successfully',
      stats: {
        totalFetched: equitiesData.length,
        uniqueSymbols: symbolMargins.size,
        created: createdCount,
        updated: updatedCount
      }
    });
    
  } catch (error) {
    logger.error('Error syncing equities:', error);
    res.status(500).json({
      error: 'Failed to sync equities',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
