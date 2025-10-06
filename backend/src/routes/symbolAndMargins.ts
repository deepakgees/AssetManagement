import express from 'express';
import { body, param, validationResult } from 'express-validator';
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

// GET /api/symbolAndMargins - Get all symbol and margin records
router.get('/', async (req, res) => {
  try {
    logger.info('Fetching all symbol and margin records');
    
    const records = await prisma.symbolAndMargin.findMany({
      orderBy: {
        symbolPrefix: 'asc'
      }
    });

    logger.info(`Found ${records.length} symbol and margin records`);
    res.json(records);
  } catch (error) {
    logger.error('Error fetching symbol and margin records', { error });
    res.status(500).json({ 
      error: 'Failed to fetch symbol and margin records',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/symbolAndMargins/:id - Get a specific symbol and margin record
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer')
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Fetching symbol and margin record with ID: ${id}`);
    
    const record = await prisma.symbolAndMargin.findUnique({
      where: { id: parseInt(id) }
    });

    if (!record) {
      logger.warn(`Symbol and margin record not found with ID: ${id}`);
      return res.status(404).json({ error: 'Symbol and margin record not found' });
    }

    logger.info(`Found symbol and margin record: ${record.symbolPrefix}`);
    res.json(record);
  } catch (error) {
    logger.error('Error fetching symbol and margin record', { error, id: req.params.id });
    res.status(500).json({ 
      error: 'Failed to fetch symbol and margin record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/symbolAndMargins - Create a new symbol and margin record
router.post('/', [
  body('symbolPrefix')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Symbol prefix must be a string between 1 and 50 characters'),
  body('margin')
    .isFloat({ min: 0 })
    .withMessage('Margin must be a positive number'),
  body('symbolType')
    .isString()
    .isIn(['equity', 'commodity', 'currency', 'debt'])
    .withMessage('Symbol type must be one of: equity, commodity, currency, debt')
], validateRequest, async (req, res) => {
  try {
    const { symbolPrefix, margin, symbolType } = req.body;
    logger.info(`Creating new symbol and margin record: ${symbolPrefix} with margin: ${margin} and type: ${symbolType}`);
    
    const record = await prisma.symbolAndMargin.create({
      data: {
        symbolPrefix,
        margin: parseFloat(margin),
        symbolType: symbolType || 'equity'
      }
    });

    logger.info(`Created symbol and margin record with ID: ${record.id}`);
    res.status(201).json(record);
  } catch (error) {
    logger.error('Error creating symbol and margin record', { error, body: req.body });
    
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return res.status(409).json({ 
        error: 'Symbol prefix already exists',
        message: 'A record with this symbol prefix already exists'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create symbol and margin record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/symbolAndMargins/:id - Update a symbol and margin record
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  body('symbolPrefix')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Symbol prefix must be a string between 1 and 50 characters'),
  body('margin')
    .isFloat({ min: 0 })
    .withMessage('Margin must be a positive number'),
  body('symbolType')
    .isString()
    .isIn(['equity', 'commodity', 'currency', 'debt'])
    .withMessage('Symbol type must be one of: equity, commodity, currency, debt')
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const { symbolPrefix, margin, symbolType } = req.body;
    logger.info(`Updating symbol and margin record ID: ${id} with prefix: ${symbolPrefix}, margin: ${margin}, and type: ${symbolType}`);
    
    // Check if record exists
    const existingRecord = await prisma.symbolAndMargin.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingRecord) {
      logger.warn(`Symbol and margin record not found with ID: ${id}`);
      return res.status(404).json({ error: 'Symbol and margin record not found' });
    }

    const record = await prisma.symbolAndMargin.update({
      where: { id: parseInt(id) },
      data: {
        symbolPrefix,
        margin: parseFloat(margin),
        symbolType: symbolType || 'equity'
      }
    });

    logger.info(`Updated symbol and margin record with ID: ${record.id}`);
    res.json(record);
  } catch (error) {
    logger.error('Error updating symbol and margin record', { error, id: req.params.id, body: req.body });
    
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return res.status(409).json({ 
        error: 'Symbol prefix already exists',
        message: 'A record with this symbol prefix already exists'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update symbol and margin record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/symbolAndMargins/:id - Delete a symbol and margin record
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer')
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Deleting symbol and margin record with ID: ${id}`);
    
    // Check if record exists
    const existingRecord = await prisma.symbolAndMargin.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingRecord) {
      logger.warn(`Symbol and margin record not found with ID: ${id}`);
      return res.status(404).json({ error: 'Symbol and margin record not found' });
    }

    await prisma.symbolAndMargin.delete({
      where: { id: parseInt(id) }
    });

    logger.info(`Deleted symbol and margin record with ID: ${id}`);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting symbol and margin record', { error, id: req.params.id });
    res.status(500).json({ 
      error: 'Failed to delete symbol and margin record',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/symbolAndMargins/sync-commodities - Sync commodities from Kite API
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
        const existingRecord = await prisma.symbolAndMargin.findFirst({
          where: {
            symbolPrefix: {
              equals: symbol,
              mode: 'insensitive'
            }
          }
        });
        
        if (existingRecord) {
          // Update existing record if margin is different or symbolType is not commodity
          if (existingRecord.margin !== margin || existingRecord.symbolType !== 'commodity') {
            await prisma.symbolAndMargin.update({
              where: { id: existingRecord.id },
              data: { 
                margin,
                symbolType: 'commodity'
              }
            });
            updatedCount++;
            logger.info(`Updated margin and symbolType for ${symbol}: ${existingRecord.margin} -> ${margin}, type -> commodity`);
          }
        } else {
          // Create new record
          await prisma.symbolAndMargin.create({
            data: {
              symbolPrefix: symbol,
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

// POST /api/symbolAndMargins/sync-equities - Sync equities from Kite API
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
        const existingRecord = await prisma.symbolAndMargin.findFirst({
          where: {
            symbolPrefix: {
              equals: symbol,
              mode: 'insensitive'
            }
          }
        });
        
        if (existingRecord) {
          // Update existing record if margin is different or symbolType is not equity
          if (existingRecord.margin !== margin || existingRecord.symbolType !== 'equity') {
            await prisma.symbolAndMargin.update({
              where: { id: existingRecord.id },
              data: { 
                margin,
                symbolType: 'equity'
              }
            });
            updatedCount++;
            logger.info(`Updated margin and symbolType for ${symbol}: ${existingRecord.margin} -> ${margin}, type -> equity`);
          }
        } else {
          // Create new record
          await prisma.symbolAndMargin.create({
            data: {
              symbolPrefix: symbol,
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
