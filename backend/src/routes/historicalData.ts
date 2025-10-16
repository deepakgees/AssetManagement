import express from 'express';
import { PrismaClient } from '@prisma/client';
import { downloadLast10YearsMCXGoldData, bulkUploadCommodityData } from '../services/mcxDataService';
import { downloadEquityData, getPopularEquitySymbols } from '../services/equityDataService';

const router = express.Router();
const prisma = new PrismaClient();

// Get historical data with optional filters
router.get('/', async (req, res) => {
  try {
    const { symbol, startDate, endDate, limit = 100, symbolType } = req.query;

    const where: any = {};
    
    if (symbol) {
      where.symbol = symbol as string;
    }
    
    if (symbolType) {
      // Join with symbol_and_margins table to filter by symbol type
      where.symbol = {
        in: await prisma.symbolAndMargin.findMany({
          where: { symbolType: symbolType as string },
          select: { symbolPrefix: true }
        }).then(results => results.map(r => r.symbolPrefix))
      };
    }
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.date.lte = new Date(endDate as string);
      }
    }

    const historicalData = await prisma.historicalData.findMany({
      where,
      orderBy: {
        date: 'desc',
      },
      take: parseInt(limit as string),
    });

    res.json(historicalData);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

// Get unique symbols for dropdown
router.get('/symbols', async (req, res) => {
  try {
    const { symbolType } = req.query;
    
    let symbols;
    
    if (symbolType) {
      // Get symbols that match the symbol type from symbol_and_margins table
      const symbolPrefixes = await prisma.symbolAndMargin.findMany({
        where: { symbolType: symbolType as string },
        select: { symbolPrefix: true }
      });
      
      const prefixList = symbolPrefixes.map(s => s.symbolPrefix);
      
      symbols = await prisma.historicalData.findMany({
        where: {
          symbol: {
            in: prefixList
          }
        },
        select: {
          symbol: true,
        },
        distinct: ['symbol'],
        orderBy: {
          symbol: 'asc',
        },
      });
    } else {
      symbols = await prisma.historicalData.findMany({
        select: {
          symbol: true,
        },
        distinct: ['symbol'],
        orderBy: {
          symbol: 'asc',
        },
      });
    }

    res.json(symbols.map(item => item.symbol));
  } catch (error) {
    console.error('Error fetching symbols:', error);
    res.status(500).json({ error: 'Failed to fetch symbols' });
  }
});

// Get historical data statistics
router.get('/stats', async (req, res) => {
  try {
    const { symbol, symbolType } = req.query;

    const where: any = {};
    if (symbol) {
      where.symbol = symbol as string;
    }
    
    if (symbolType) {
      // Join with symbol_and_margins table to filter by symbol type
      where.symbol = {
        in: await prisma.symbolAndMargin.findMany({
          where: { symbolType: symbolType as string },
          select: { symbolPrefix: true }
        }).then(results => results.map(r => r.symbolPrefix))
      };
    }

    const stats = await prisma.historicalData.aggregate({
      where,
      _count: {
        id: true,
      },
      _min: {
        date: true,
      },
      _max: {
        date: true,
      },
    });

    res.json({
      totalRecords: stats._count.id,
      earliestDate: stats._min.date,
      latestDate: stats._max.date,
    });
  } catch (error) {
    console.error('Error fetching historical data stats:', error);
    res.status(500).json({ error: 'Failed to fetch historical data statistics' });
  }
});

// Add new historical data record
router.post('/', async (req, res) => {
  try {
    const { symbol, date, open, high, low, close, volume } = req.body;

    if (!symbol || !date || open === undefined || high === undefined || low === undefined || close === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const historicalData = await prisma.historicalData.create({
      data: {
        symbol,
        date: new Date(date),
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close),
        volume: volume ? parseInt(volume) : null,
      },
    });

    res.status(201).json(historicalData);
  } catch (error) {
    console.error('Error creating historical data:', error);
    res.status(500).json({ error: 'Failed to create historical data' });
  }
});

// Update historical data record
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { symbol, date, open, high, low, close, volume } = req.body;

    const historicalData = await prisma.historicalData.update({
      where: { id: parseInt(id) },
      data: {
        ...(symbol && { symbol }),
        ...(date && { date: new Date(date) }),
        ...(open !== undefined && { open: parseFloat(open) }),
        ...(high !== undefined && { high: parseFloat(high) }),
        ...(low !== undefined && { low: parseFloat(low) }),
        ...(close !== undefined && { close: parseFloat(close) }),
        ...(volume !== undefined && { volume: volume ? parseInt(volume) : null }),
      },
    });

    res.json(historicalData);
  } catch (error) {
    console.error('Error updating historical data:', error);
    res.status(500).json({ error: 'Failed to update historical data' });
  }
});

// Delete historical data record
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.historicalData.delete({
      where: { id: parseInt(id) },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting historical data:', error);
    res.status(500).json({ error: 'Failed to delete historical data' });
  }
});

// Download MCX GOLD data for last 10 years
router.post('/download-mcx-gold', async (req, res) => {
  try {
    console.log('Starting MCX GOLD data download...');
    
    const result = await downloadLast10YearsMCXGoldData();
    
    res.json({
      success: true,
      message: `MCX GOLD data downloaded successfully! Created: ${result.created}, Updated: ${result.updated}, Total: ${result.total}`,
      data: result
    });
  } catch (error) {
    console.error('Error downloading MCX GOLD data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to download MCX GOLD data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get historical price commodities data
router.get('/commodities', async (req, res) => {
  try {
    const { symbol, startYear, endYear, startMonth, endMonth, limit = 100 } = req.query;

    const where: any = {};
    
    if (symbol) {
      where.symbol = symbol as string;
    }
    
    if (startYear || endYear) {
      where.year = {};
      if (startYear) {
        where.year.gte = parseInt(startYear as string);
      }
      if (endYear) {
        where.year.lte = parseInt(endYear as string);
      }
    }
    
    if (startMonth || endMonth) {
      where.month = {};
      if (startMonth) {
        where.month.gte = parseInt(startMonth as string);
      }
      if (endMonth) {
        where.month.lte = parseInt(endMonth as string);
      }
    }

    const data = await prisma.historicalPriceCommodities.findMany({
      where,
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ],
      take: parseInt(limit as string),
    });

    res.json(data);
  } catch (error) {
    console.error('Error fetching historical price commodities:', error);
    res.status(500).json({ error: 'Failed to fetch historical price commodities' });
  }
});

// Add new commodity historical data record
router.post('/commodities', async (req, res) => {
  try {
    const { symbol, year, month, closingPrice, percentChange } = req.body;

    if (!symbol || !year || !month || closingPrice === undefined) {
      return res.status(400).json({ error: 'Missing required fields: symbol, year, month, closingPrice' });
    }

    const commodityData = await prisma.historicalPriceCommodities.create({
      data: {
        symbol,
        year: parseInt(year),
        month: parseInt(month),
        closingPrice: parseFloat(closingPrice),
        percentChange: percentChange ? parseFloat(percentChange) : null,
      },
    });

    res.status(201).json(commodityData);
  } catch (error) {
    console.error('Error creating commodity historical data:', error);
    res.status(500).json({ error: 'Failed to create commodity historical data' });
  }
});

// Update commodity historical data record
router.put('/commodities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { symbol, year, month, closingPrice, percentChange } = req.body;

    const commodityData = await prisma.historicalPriceCommodities.update({
      where: { id: parseInt(id) },
      data: {
        ...(symbol && { symbol }),
        ...(year && { year: parseInt(year) }),
        ...(month && { month: parseInt(month) }),
        ...(closingPrice !== undefined && { closingPrice: parseFloat(closingPrice) }),
        ...(percentChange !== undefined && { percentChange: percentChange ? parseFloat(percentChange) : null }),
      },
    });

    res.json(commodityData);
  } catch (error) {
    console.error('Error updating commodity historical data:', error);
    res.status(500).json({ error: 'Failed to update commodity historical data' });
  }
});

// Delete commodity historical data record
router.delete('/commodities/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.historicalPriceCommodities.delete({
      where: { id: parseInt(id) },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting commodity historical data:', error);
    res.status(500).json({ error: 'Failed to delete commodity historical data' });
  }
});

// Download equity data for a specific symbol and date range
router.post('/download-equity', async (req, res) => {
  try {
    const { symbol, startDate, endDate } = req.body;

    if (!symbol) {
      return res.status(400).json({ 
        success: false,
        error: 'Symbol is required' 
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false,
        error: 'Start date and end date are required' 
      });
    }

    console.log(`Starting equity data download for ${symbol}...`);
    
    const result = await downloadEquityData(symbol, new Date(startDate), new Date(endDate));
    
    res.json({
      success: true,
      message: `Equity data for ${symbol} downloaded successfully! Created: ${result.created}, Updated: ${result.updated}, Total: ${result.total}`,
      data: result
    });
  } catch (error) {
    console.error('Error downloading equity data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to download equity data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get popular equity symbols
router.get('/equity-symbols', async (req, res) => {
  try {
    const symbols = getPopularEquitySymbols();
    res.json(symbols);
  } catch (error) {
    console.error('Error fetching equity symbols:', error);
    res.status(500).json({ error: 'Failed to fetch equity symbols' });
  }
});

// Get historical price equity data
router.get('/equity', async (req, res) => {
  try {
    const { symbol, startYear, endYear, limit = 100 } = req.query;

    const where: any = {};
    
    if (symbol) {
      where.symbol = symbol as string;
    }
    
    if (startYear || endYear) {
      where.year = {};
      if (startYear) {
        where.year.gte = parseInt(startYear as string);
      }
      if (endYear) {
        where.year.lte = parseInt(endYear as string);
      }
    }

    const data = await prisma.historicalPriceEquity.findMany({
      where,
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ],
      take: parseInt(limit as string),
    });

    res.json(data);
  } catch (error) {
    console.error('Error fetching historical price equity:', error);
    res.status(500).json({ error: 'Failed to fetch historical price equity' });
  }
});

// Bulk upload commodity historical data
router.post('/commodities/bulk-upload', async (req, res) => {
  try {
    const { symbol, data } = req.body;

    if (!symbol) {
      return res.status(400).json({ 
        success: false,
        error: 'Symbol is required' 
      });
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Data array is required and must not be empty' 
      });
    }

    console.log(`Starting bulk upload for ${symbol} with ${data.length} records...`);
    
    const result = await bulkUploadCommodityData(symbol, data);
    
    res.json({
      success: true,
      message: `Bulk upload for ${symbol} completed! Created: ${result.created}, Updated: ${result.updated}, Total: ${result.total}, Errors: ${result.errors.length}`,
      data: result
    });
  } catch (error) {
    console.error('Error bulk uploading commodity data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to bulk upload commodity data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;
