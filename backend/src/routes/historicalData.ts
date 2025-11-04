import express from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { downloadLast10YearsMCXGoldData, bulkUploadCommodityData } from '../services/mcxDataService';
import { downloadEquityData, bulkDownloadFOStocks, previewBulkDownloadFOStocks, getNSEFOStocksList, getNSEFOStocksCount } from '../services/equityDataService';

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
    
    // Return symbols from symbol_margins table instead of historical_data
    const symbols = await prisma.symbolMargin.findMany({
      where: symbolType ? { symbolType: symbolType as string } : {},
      select: { symbol: true },
      orderBy: { symbol: 'asc' }
    });

    res.json(symbols.map(item => item.symbol));
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

// Get NSE F&O equity symbols for dropdown
router.get('/equity-symbols', async (req, res) => {
  try {
    const symbols = await getNSEFOStocksList();
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

// Add new equity historical data record
router.post('/equity', async (req, res) => {
  try {
    const { symbol, year, month, closingPrice, percentChange } = req.body;

    if (!symbol || !year || !month || closingPrice === undefined) {
      return res.status(400).json({ error: 'Missing required fields: symbol, year, month, closingPrice' });
    }

    const equityData = await prisma.historicalPriceEquity.create({
      data: {
        symbol: symbol.toUpperCase(),
        year: parseInt(year),
        month: parseInt(month),
        closingPrice: parseFloat(closingPrice),
        percentChange: percentChange ? parseFloat(percentChange) : null,
      },
    });

    res.status(201).json(equityData);
  } catch (error: any) {
    console.error('Error creating equity historical data:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Record already exists for this symbol, year, and month' });
    } else {
      res.status(500).json({ error: 'Failed to create equity historical data' });
    }
  }
});

// Update equity historical data record
router.put('/equity/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { symbol, year, month, closingPrice, percentChange } = req.body;

    const equityData = await prisma.historicalPriceEquity.update({
      where: { id: parseInt(id) },
      data: {
        ...(symbol && { symbol: symbol.toUpperCase() }),
        ...(year && { year: parseInt(year) }),
        ...(month && { month: parseInt(month) }),
        ...(closingPrice !== undefined && { closingPrice: parseFloat(closingPrice) }),
        ...(percentChange !== undefined && { percentChange: percentChange ? parseFloat(percentChange) : null }),
      },
    });

    res.json(equityData);
  } catch (error: any) {
    console.error('Error updating equity historical data:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Record not found' });
    } else if (error.code === 'P2002') {
      res.status(409).json({ error: 'Record already exists for this symbol, year, and month' });
    } else {
      res.status(500).json({ error: 'Failed to update equity historical data' });
    }
  }
});

// Delete equity historical data record
router.delete('/equity/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.historicalPriceEquity.delete({
      where: { id: parseInt(id) },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting equity historical data:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Record not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete equity historical data' });
    }
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

// Get NSE F&O stocks list
router.get('/fo-stocks', async (req, res) => {
  try {
    const stocks = await getNSEFOStocksList();
    const count = await getNSEFOStocksCount();
    
    res.json({
      success: true,
      data: {
        stocks,
        count
      }
    });
  } catch (error) {
    console.error('Error getting F&O stocks list:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get F&O stocks list',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Preview bulk download equity data for all NSE F&O stocks (without storing)
router.post('/preview-bulk-download-fo', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false,
        error: 'Start date and end date are required' 
      });
    }

    console.log(`Starting preview for NSE F&O stocks from ${startDate} to ${endDate}...`);
    
    const result = await previewBulkDownloadFOStocks(new Date(startDate), new Date(endDate));
    
    res.json({
      success: true,
      message: `Preview completed! Total: ${result.total}, Success: ${result.success}, Failed: ${result.failed}`,
      data: result
    });
  } catch (error) {
    console.error('Error in preview bulk download:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to preview bulk download',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Bulk download equity data for all NSE F&O stocks
router.post('/bulk-download-fo', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false,
        error: 'Start date and end date are required' 
      });
    }

    console.log(`Starting bulk download for NSE F&O stocks from ${startDate} to ${endDate}...`);
    
    const result = await bulkDownloadFOStocks(new Date(startDate), new Date(endDate));
    
    res.json({
      success: true,
      message: `Bulk download completed! Total: ${result.total}, Success: ${result.success}, Failed: ${result.failed}`,
      data: result
    });
  } catch (error) {
    console.error('Error in bulk download:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to perform bulk download',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get equity chart data
router.get('/equity-chart-data', async (req, res) => {
  try {
    const { symbols } = req.query;
    
    if (!symbols) {
      return res.status(400).json({ 
        success: false,
        error: 'Symbols parameter is required' 
      });
    }

    const symbolList = (symbols as string).split(',');
    
    // For now, return mock data structure
    // In production, this would fetch actual chart data from the database
    const chartData = symbolList.map(symbol => ({
      symbol,
      data: [] // This would contain actual price data
    }));
    
    res.json(chartData);
  } catch (error) {
    console.error('Error getting equity chart data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get equity chart data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get equity seasonal data
router.get('/equity-seasonal-data/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ 
        success: false,
        error: 'Symbol parameter is required' 
      });
    }

    const currentYear = new Date().getFullYear();
    const tenYearsAgo = currentYear - 10;
    
    // Get all records for the specified equity symbol in the last 10 years
    const records = await prisma.historicalPriceEquity.findMany({
      where: { 
        symbol: symbol.toUpperCase(),
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
    console.error('Error getting equity seasonal data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get equity seasonal data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get equity statistics for selected stocks
router.get('/equity-stats', async (req, res) => {
  try {
    const { symbols } = req.query;
    
    if (!symbols) {
      return res.status(400).json({ 
        success: false,
        error: 'Symbols parameter is required' 
      });
    }

    const symbolList = (symbols as string).split(',');
    const stats = [];

    for (const symbol of symbolList) {
      try {
        // Get latest price data for the symbol
        const latestData = await prisma.historicalPriceEquity.findFirst({
          where: { symbol },
          orderBy: [
            { year: 'desc' },
            { month: 'desc' }
          ],
        });

        // Get historical data for the last 5 years
        const currentYear = new Date().getFullYear();
        const fiveYearsAgo = currentYear - 5;

        const historicalData = await prisma.historicalPriceEquity.findMany({
          where: {
            symbol,
            year: {
              gte: fiveYearsAgo
            }
          },
          orderBy: [
            { year: 'asc' },
            { month: 'asc' }
          ],
        });

        // Calculate top falls
        const topFalls = [];
        if (historicalData.length > 0) {
          // Calculate monthly changes between consecutive months
          const monthlyChanges = [];
          
          for (let i = 1; i < historicalData.length; i++) {
            const prevRecord = historicalData[i - 1];
            const currentRecord = historicalData[i];
            
            const percentChange = ((currentRecord.closingPrice - prevRecord.closingPrice) / prevRecord.closingPrice) * 100;
            
            monthlyChanges.push({
              year: currentRecord.year,
              month: currentRecord.month,
              percentChange,
              closingPrice: currentRecord.closingPrice
            });
          }

          // Get top 5 falls
          topFalls.push(...monthlyChanges
            .filter(change => change.percentChange < 0)
            .sort((a, b) => a.percentChange - b.percentChange)
            .slice(0, 5)
          );
        }

        // Get time range
        const firstRecord = await prisma.historicalPriceEquity.findFirst({
          where: { symbol },
          orderBy: [
            { year: 'asc' },
            { month: 'asc' }
          ],
        });

        const timeRange = firstRecord && latestData 
          ? `${new Date(firstRecord.year, firstRecord.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${new Date(latestData.year, latestData.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
          : 'No data';

        // Get latest month data
        const latestMonth = latestData ? {
          year: latestData.year,
          month: latestData.month,
          closingPrice: latestData.closingPrice
        } : null;

        // Calculate previous month return
        let previousMonthReturn = null;
        if (latestData && historicalData.length > 1) {
          // Find the previous month's data
          const previousMonthData = historicalData.find(record => 
            (record.year === latestData.year && record.month === latestData.month - 1) ||
            (record.year === latestData.year - 1 && latestData.month === 1 && record.month === 12)
          );
          
          if (previousMonthData) {
            const percentChange = ((latestData.closingPrice - previousMonthData.closingPrice) / previousMonthData.closingPrice) * 100;
            previousMonthReturn = {
              percentChange,
              previousPrice: previousMonthData.closingPrice,
              currentPrice: latestData.closingPrice
            };
          }
        }

        stats.push({
          symbol,
          totalRecords: historicalData.length,
          topFalls,
          timeRange,
          latestMonth,
          previousMonthReturn
        });

      } catch (symbolError) {
        console.error(`Error processing symbol ${symbol}:`, symbolError);
        // Add empty stats for failed symbols
        stats.push({
          symbol,
          totalRecords: 0,
          topFalls: [],
          timeRange: 'No data',
          latestMonth: null
        });
      }
    }

    res.json(stats);
  } catch (error) {
    console.error('Error getting equity stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get equity stats',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get option chain data from NSE and find premium for selling put option near safe PE Price
router.get('/option-chain/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { safePEPrice } = req.query; // Safe PE Price as query parameter
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // NSE API endpoint
    const nseUrl = `https://www.nseindia.com/api/option-chain-equities?symbol=${encodeURIComponent(symbol)}`;
    
    try {
      // Fetch option chain data from NSE
      // Note: NSE API may require specific headers or cookies
      const response = await axios.get(nseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.nseindia.com/',
        },
        timeout: 10000,
      });

      const optionChainData = response.data;
      
      // Find the put option closest to the safe PE Price
      let closestPutPremium = null;
      let closestStrike = null;
      let minDifference = Infinity;

      if (optionChainData && optionChainData.records && optionChainData.records.data) {
        const records = optionChainData.records.data;
        const safePE = safePEPrice ? parseFloat(safePEPrice as string) : null;

        for (const record of records) {
          if (record.PE && record.strikePrice) {
            const strikePrice = record.strikePrice;
            const lastPrice = record.PE.lastPrice || record.PE.askPrice || record.PE.bidPrice || 0;
            
            if (lastPrice > 0) {
              // Calculate difference from safe PE Price
              const difference = safePE ? Math.abs(strikePrice - safePE) : strikePrice;
              
              // If we have a safe PE Price, find the closest strike
              // Otherwise, find the lowest strike with a premium
              if (safePE) {
                if (difference < minDifference) {
                  minDifference = difference;
                  closestPutPremium = lastPrice;
                  closestStrike = strikePrice;
                }
              } else {
                // If no safe PE Price provided, find the lowest strike with premium
                if (strikePrice < (closestStrike || Infinity)) {
                  closestPutPremium = lastPrice;
                  closestStrike = strikePrice;
                }
              }
            }
          }
        }
      }

      res.json({
        symbol,
        safePEPrice: safePEPrice ? parseFloat(safePEPrice as string) : null,
        premium: closestPutPremium,
        strikePrice: closestStrike,
        found: closestPutPremium !== null,
      });
    } catch (nseError: any) {
      console.error(`Error fetching option chain for ${symbol}:`, nseError.message);
      res.status(500).json({
        error: 'Failed to fetch option chain data from NSE',
        message: nseError.response?.data?.message || nseError.message,
        symbol,
        premium: null,
        strikePrice: null,
        found: false,
      });
    }
  } catch (error) {
    console.error('Error in option chain endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch option chain data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;
