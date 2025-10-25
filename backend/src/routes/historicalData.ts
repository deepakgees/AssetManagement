import express from 'express';
import { PrismaClient } from '@prisma/client';
import { downloadLast10YearsMCXGoldData, bulkUploadCommodityData } from '../services/mcxDataService';
import { downloadEquityData, getPopularEquitySymbols } from '../services/equityDataService';

const router = express.Router();
const prisma = new PrismaClient();

// Get historical data with optional filters
router.get('/', async (req, res) => {
  try {
    const { symbolType } = req.query;

    // For now, return empty array since historical_data table is removed
    // This endpoint can be used to return data from other historical tables if needed
    res.json([]);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

// Get unique symbols for dropdown
router.get('/symbols', async (req, res) => {
  try {
    const { symbolType } = req.query;
    
    // Return symbols from symbol_and_margins table instead of historical_data
    const symbolPrefixes = await prisma.symbolAndMargin.findMany({
      where: symbolType ? { symbolType: symbolType as string } : {},
      select: { symbolPrefix: true },
      orderBy: { symbolPrefix: 'asc' }
    });

    res.json(symbolPrefixes.map(item => item.symbolPrefix));
  } catch (error) {
    console.error('Error fetching symbols:', error);
    res.status(500).json({ error: 'Failed to fetch symbols' });
  }
});

// Get historical data statistics
router.get('/stats', async (req, res) => {
  try {
    // Return empty stats since historical_data table is removed
    res.json({
      totalRecords: 0,
      earliestDate: null,
      latestDate: null,
    });
  } catch (error) {
    console.error('Error fetching historical data stats:', error);
    res.status(500).json({ error: 'Failed to fetch historical data statistics' });
  }
});

// Get commodity statistics with top gains and falls
router.get('/commodities/stats', async (req, res) => {
  try {
    // Get all unique commodity symbols
    const symbols = await prisma.historicalPriceCommodities.findMany({
      select: { symbol: true },
      distinct: ['symbol'],
      orderBy: { symbol: 'asc' }
    });

    const commodityStats = [];

    for (const { symbol } of symbols) {
      // Get all records for this symbol
      const records = await prisma.historicalPriceCommodities.findMany({
        where: { symbol },
        orderBy: [
          { year: 'desc' },
          { month: 'desc' }
        ]
      });

      // Calculate top 3 falls
      const recordsWithPercentChange = records.filter(record => record.percentChange !== null);
      
      const topFalls = recordsWithPercentChange
        .sort((a, b) => (a.percentChange || 0) - (b.percentChange || 0))
        .slice(0, 3)
        .map(record => ({
          year: record.year,
          month: record.month,
          percentChange: record.percentChange,
          closingPrice: record.closingPrice
        }));

      // Calculate time range for all data (not just top 3 falls)
      let timeRange = "No data";
      if (records.length > 0) {
        const years = records.map(record => record.year);
        const months = records.map(record => record.month);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        const minMonth = Math.min(...months.filter((_, index) => years[index] === minYear));
        const maxMonth = Math.max(...months.filter((_, index) => years[index] === maxYear));
        
        if (minYear === maxYear) {
          // Same year, show month range
          const minMonthName = new Date(minYear, minMonth - 1).toLocaleDateString('en-US', { month: 'short' });
          const maxMonthName = new Date(maxYear, maxMonth - 1).toLocaleDateString('en-US', { month: 'short' });
          timeRange = minMonth === maxMonth ? `${minMonthName} ${minYear}` : `${minMonthName} - ${maxMonthName} ${minYear}`;
        } else {
          // Different years, show full range
          const minMonthName = new Date(minYear, minMonth - 1).toLocaleDateString('en-US', { month: 'short' });
          const maxMonthName = new Date(maxYear, maxMonth - 1).toLocaleDateString('en-US', { month: 'short' });
          timeRange = `${minMonthName} ${minYear} - ${maxMonthName} ${maxYear}`;
        }
      }

      // Get the latest month's data (first record since we ordered by year desc, month desc)
      const latestMonth = records.length > 0 ? records[0] : null;

      commodityStats.push({
        symbol,
        totalRecords: records.length,
        topFalls,
        timeRange,
        latestMonth: latestMonth ? {
          year: latestMonth.year,
          month: latestMonth.month,
          closingPrice: latestMonth.closingPrice
        } : null
      });
    }

    // Sort commodities in specific order: Gold, Silver, Copper, Crudeoil, NaturalGas
    const commodityOrder = ['GOLD', 'SILVER', 'COPPER', 'CRUDEOIL', 'NATURALGAS'];
    commodityStats.sort((a, b) => {
      const aIndex = commodityOrder.indexOf(a.symbol.toUpperCase());
      const bIndex = commodityOrder.indexOf(b.symbol.toUpperCase());
      
      // If both symbols are in the predefined order, sort by that order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // If only one symbol is in the predefined order, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      // If neither symbol is in the predefined order, sort alphabetically
      return a.symbol.localeCompare(b.symbol);
    });

    res.json(commodityStats);
  } catch (error) {
    console.error('Error fetching commodity statistics:', error);
    res.status(500).json({ error: 'Failed to fetch commodity statistics' });
  }
});

// Get commodity price data for chart (last 5 years)
router.get('/commodities/chart-data', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const fiveYearsAgo = currentYear - 5;
    
    // Get all unique commodity symbols
    const symbols = await prisma.historicalPriceCommodities.findMany({
      select: { symbol: true },
      distinct: ['symbol'],
      orderBy: { symbol: 'asc' }
    });

    const chartData = [];

    for (const { symbol } of symbols) {
      // Get price data for the last 5 years
      const records = await prisma.historicalPriceCommodities.findMany({
        where: { 
          symbol,
          year: { gte: fiveYearsAgo }
        },
        orderBy: [
          { year: 'asc' },
          { month: 'asc' }
        ]
      });

      // Transform data for chart
      const priceData = records.map(record => ({
        date: new Date(record.year, record.month - 1, 1).toISOString().split('T')[0],
        price: record.closingPrice,
        year: record.year,
        month: record.month
      }));

      chartData.push({
        symbol,
        data: priceData
      });
    }

    res.json(chartData);
  } catch (error) {
    console.error('Error fetching commodity chart data:', error);
    res.status(500).json({ error: 'Failed to fetch commodity chart data' });
  }
});

// Get seasonal data for a specific commodity (last 10 years)
router.get('/commodities/seasonal/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const currentYear = new Date().getFullYear();
    const tenYearsAgo = currentYear - 10;
    
    // Get all records for the specified commodity in the last 10 years
    const records = await prisma.historicalPriceCommodities.findMany({
      where: { 
        symbol,
        year: { gte: tenYearsAgo }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    // Transform data for seasonal chart
    const seasonalData = records.map(record => ({
      year: record.year,
      month: record.month,
      closingPrice: record.closingPrice,
      percentChange: record.percentChange
    }));

    res.json(seasonalData);
  } catch (error) {
    console.error('Error fetching commodity seasonal data:', error);
    res.status(500).json({ error: 'Failed to fetch commodity seasonal data' });
  }
});

// Get seasonal data for all commodities (last 10 years)
router.get('/commodities/seasonal-all', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const tenYearsAgo = currentYear - 10;
    
    // Get all records for all commodities in the last 10 years
    const records = await prisma.historicalPriceCommodities.findMany({
      where: { 
        year: { gte: tenYearsAgo }
      },
      orderBy: [
        { symbol: 'asc' },
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    // Group by symbol
    const seasonalDataBySymbol = records.reduce((acc, record) => {
      if (!acc[record.symbol]) {
        acc[record.symbol] = [];
      }
      acc[record.symbol].push({
        year: record.year,
        month: record.month,
        closingPrice: record.closingPrice,
        percentChange: record.percentChange
      });
      return acc;
    }, {} as Record<string, any[]>);

    res.json(seasonalDataBySymbol);
  } catch (error) {
    console.error('Error fetching all commodities seasonal data:', error);
    res.status(500).json({ error: 'Failed to fetch all commodities seasonal data' });
  }
});

// Add new historical data record - DISABLED (historical_data table removed)
router.post('/', async (req, res) => {
  res.status(410).json({ error: 'Historical data table has been removed. Use commodities or equity endpoints instead.' });
});

// Update historical data record - DISABLED (historical_data table removed)
router.put('/:id', async (req, res) => {
  res.status(410).json({ error: 'Historical data table has been removed. Use commodities or equity endpoints instead.' });
});

// Delete historical data record - DISABLED (historical_data table removed)
router.delete('/:id', async (req, res) => {
  res.status(410).json({ error: 'Historical data table has been removed. Use commodities or equity endpoints instead.' });
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
    const { symbol, startYear, endYear, startMonth, endMonth, limit = 100, offset = 0 } = req.query;

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

    // Get total count for pagination
    const totalCount = await prisma.historicalPriceCommodities.count({ where });

    const data = await prisma.historicalPriceCommodities.findMany({
      where,
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ],
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json({
      data,
      totalCount,
      currentPage: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
      totalPages: Math.ceil(totalCount / parseInt(limit as string)),
      hasNextPage: parseInt(offset as string) + parseInt(limit as string) < totalCount,
      hasPreviousPage: parseInt(offset as string) > 0
    });
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
