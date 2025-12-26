import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CurrentMCXPrice {
  symbol: string;
  lastTrade: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  timestamp: string;
  lastTradeTime?: string;
}

export interface MCXGoldData {
  date: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface MonthlyMCXData {
  year: number;
  month: number;
  closingPrice: number;
  percentChange: number | null;
}

/**
 * Fetch MCX GOLD historical data from Investing.com
 * This is a mock implementation since we can't directly scrape Investing.com
 * In a real implementation, you would need to use their API or web scraping
 */
export async function fetchMCXGoldData(startDate: Date, endDate: Date): Promise<MCXGoldData[]> {
  try {
    // For now, we'll create mock data based on known MCX GOLD trends
    // In production, you would integrate with a real data provider
    const mockData = generateMockMCXGoldData(startDate, endDate);
    return mockData;
  } catch (error) {
    console.error('Error fetching MCX GOLD data:', error);
    throw new Error('Failed to fetch MCX GOLD data');
  }
}

/**
 * Generate mock MCX GOLD data for demonstration
 * In production, replace this with actual API calls to data providers
 */
function generateMockMCXGoldData(startDate: Date, endDate: Date): MCXGoldData[] {
  const data: MCXGoldData[] = [];
  const currentDate = new Date(startDate);
  
  // Base price for MCX GOLD in 2014 (around ₹28,000 per 10 grams)
  let basePrice = 28000;
  
  while (currentDate <= endDate) {
    // Generate realistic price movements with some volatility
    const randomChange = (Math.random() - 0.5) * 0.1; // ±5% monthly change
    const priceChange = basePrice * randomChange;
    const newPrice = basePrice + priceChange;
    
    data.push({
      date: currentDate.toISOString().split('T')[0],
      price: Math.round(newPrice * 100) / 100,
      change: Math.round(priceChange * 100) / 100,
      changePercent: Math.round(randomChange * 10000) / 100
    });
    
    basePrice = newPrice;
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return data;
}

/**
 * Process daily data to get monthly closing prices and calculate percentage changes
 */
export function processToMonthlyData(dailyData: MCXGoldData[]): MonthlyMCXData[] {
  const monthlyData: MonthlyMCXData[] = [];
  
  // Group data by month
  const monthlyGroups: { [key: string]: MCXGoldData[] } = {};
  
  dailyData.forEach(day => {
    const date = new Date(day.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyGroups[monthKey]) {
      monthlyGroups[monthKey] = [];
    }
    monthlyGroups[monthKey].push(day);
  });
  
  // Process each month
  Object.keys(monthlyGroups).sort().forEach(monthKey => {
    const monthData = monthlyGroups[monthKey];
    // Get the last trading day of the month (highest date)
    const lastDay = monthData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    
    const date = new Date(lastDay.date);
    const closingPrice = lastDay.price;
    
    // Calculate percentage change from previous month
    let percentChange: number | null = null;
    if (monthlyData.length > 0) {
      const previousPrice = monthlyData[monthlyData.length - 1].closingPrice;
      percentChange = ((closingPrice - previousPrice) / previousPrice) * 100;
    }
    
    monthlyData.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1, // JavaScript months are 0-based, database expects 1-based
      closingPrice,
      percentChange
    });
  });
  
  return monthlyData;
}

/**
 * Store monthly MCX GOLD data in database
 */
export async function storeMCXGoldData(monthlyData: MonthlyMCXData[], symbol: string = 'MCX_GOLD'): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  
  for (const data of monthlyData) {
    try {
      const existing = await prisma.historicalPriceCommodities.findUnique({
        where: {
          unique_commodity_symbol_year_month: {
            symbol,
            year: data.year,
            month: data.month
          }
        }
      });
      
      if (existing) {
        await prisma.historicalPriceCommodities.update({
          where: {
            unique_commodity_symbol_year_month: {
              symbol,
              year: data.year,
              month: data.month
            }
          },
          data: {
            closingPrice: data.closingPrice,
            percentChange: data.percentChange
          }
        });
        updated++;
      } else {
        await prisma.historicalPriceCommodities.create({
          data: {
            symbol,
            year: data.year,
            month: data.month,
            closingPrice: data.closingPrice,
            percentChange: data.percentChange
          }
        });
        created++;
      }
    } catch (error) {
      console.error(`Error storing data for ${data.year}-${data.month}:`, error);
    }
  }
  
  return { created, updated };
}

/**
 * Download and store MCX GOLD data for the last 10 years
 */
export async function downloadLast10YearsMCXGoldData(): Promise<{ created: number; updated: number; total: number }> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(endDate.getFullYear() - 10);
  
  console.log(`Downloading MCX GOLD data from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  
  try {
    // Fetch daily data
    const dailyData = await fetchMCXGoldData(startDate, endDate);
    
    // Process to monthly data
    const monthlyData = processToMonthlyData(dailyData);
    
    // Store in database
    const result = await storeMCXGoldData(monthlyData);
    
    return {
      ...result,
      total: monthlyData.length
    };
  } catch (error) {
    console.error('Error downloading MCX GOLD data:', error);
    throw error;
  }
}

/**
 * Bulk upload commodity historical data from CSV data
 */
export async function bulkUploadCommodityData(
  symbol: string, 
  data: Array<{ year: number; month: number; price: number; percentChange?: number | null }>
): Promise<{ created: number; updated: number; total: number; errors: string[] }> {
  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  
  // Sort data by year and month to ensure proper percentage calculation
  const sortedData = data.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
  
  // Recalculate percentage changes based on sorted data
  const dataWithPercentChange = sortedData.map((item, index) => {
    let percentChange = item.percentChange;
    
    // If percentChange is not provided or is null, calculate it
    if (percentChange === undefined || percentChange === null) {
      if (index > 0) {
        const previousPrice = sortedData[index - 1].price;
        percentChange = ((item.price - previousPrice) / previousPrice) * 100;
      } else {
        percentChange = null;
      }
    }
    
    return {
      ...item,
      percentChange: percentChange ? parseFloat(percentChange.toFixed(2)) : null
    };
  });
  
  for (const item of dataWithPercentChange) {
    try {
      // Validate data
      if (!item.year || !item.month || !item.price) {
        errors.push(`Invalid data for ${item.year}-${item.month}: missing required fields`);
        continue;
      }
      
      if (item.year < 1900 || item.year > 2100) {
        errors.push(`Invalid year ${item.year} for ${item.year}-${item.month}`);
        continue;
      }
      
      if (item.month < 1 || item.month > 12) {
        errors.push(`Invalid month ${item.month} for ${item.year}-${item.month}`);
        continue;
      }
      
      if (item.price <= 0) {
        errors.push(`Invalid price ${item.price} for ${item.year}-${item.month}`);
        continue;
      }
      
      const existing = await prisma.historicalPriceCommodities.findUnique({
        where: {
          unique_commodity_symbol_year_month: {
            symbol,
            year: item.year,
            month: item.month
          }
        }
      });
      
      if (existing) {
        await prisma.historicalPriceCommodities.update({
          where: {
            unique_commodity_symbol_year_month: {
              symbol,
              year: item.year,
              month: item.month
            }
          },
          data: {
            closingPrice: item.price,
            percentChange: item.percentChange
          }
        });
        updated++;
      } else {
        await prisma.historicalPriceCommodities.create({
          data: {
            symbol,
            year: item.year,
            month: item.month,
            closingPrice: item.price,
            percentChange: item.percentChange
          }
        });
        created++;
      }
    } catch (error) {
      console.error(`Error storing data for ${item.year}-${item.month}:`, error);
      errors.push(`Failed to store data for ${item.year}-${item.month}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return {
    created,
    updated,
    total: dataWithPercentChange.length,
    errors
  };
}

/**
 * Fetch current price of a commodity from MCX Live website
 * @param url - The MCX Live URL for the commodity (e.g., 'https://mcxlive.org/gold/')
 * @param symbol - The commodity symbol (e.g., 'GOLD', 'SILVER', 'COPPER')
 * @returns Current price data or null if fetch fails
 */
export async function fetchCurrentMCXPrice(url: string, symbol: string): Promise<CurrentMCXPrice | null> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000,
    });

    const html = response.data;

    // Helper function to extract number from table cell
    const extractNumber = (label: string, html: string): number | null => {
      // Try multiple patterns to find the value
      const patterns = [
        new RegExp(`${label}[\\s\\S]*?<td[^>]*>([\\d,]+(?:\\.[\\d]+)?)<\\/td>`, 'i'),
        new RegExp(`${label}[\\s\\S]*?<td[^>]*>([\\d,]+(?:\\.[\\d]+)?)`, 'i'),
        new RegExp(`<td[^>]*>${label}<\\/td>[\\s\\S]*?<td[^>]*>([\\d,]+(?:\\.[\\d]+)?)<\\/td>`, 'i'),
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          const value = match[1].replace(/,/g, '').trim();
          const num = parseFloat(value);
          if (!isNaN(num)) {
            return num;
          }
        }
      }
      return null;
    };

    // Parse Last Trade price - specifically target the "Last Trade" value from the table
    // HTML structure:
    // <table class="main-table bold">
    //   <thead><tr><td>Last Trade</td><td>Change</td><td>Change in %</td></tr></thead>
    //   <tbody><tr><td class="main-change positive"><i class="fa fa-caret-up"></i> 138,179</td>...</tr></tbody>
    // </table>
    let lastTrade: number | null = null;
    
    // Pattern 1: Look for the specific table structure with "main-table bold" class
    // Find the table, then find "Last Trade" in thead, then get the first td value from tbody
    const tableMatch = html.match(/<table[^>]*class="main-table bold"[^>]*>[\s\S]*?Last Trade[\s\S]*?<tbody>[\s\S]*?<td[^>]*class="main-change[^"]*"[^>]*>[\s\S]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i);
    if (tableMatch && tableMatch[1]) {
      const value = tableMatch[1].replace(/,/g, '').trim();
      const num = parseFloat(value);
      if (!isNaN(num) && num > 0) {
        lastTrade = num;
      }
    }
    
    // Pattern 2: More specific - find "Last Trade" in thead, then get the first number in tbody row
    if (!lastTrade) {
      const lastTradeHeaderMatch = html.match(/<td[^>]*>Last Trade<\/td>/i);
      if (lastTradeHeaderMatch) {
        const headerIndex = html.indexOf(lastTradeHeaderMatch[0]);
        // Look for tbody after the header
        const tbodySection = html.substring(headerIndex);
        const tbodyMatch = tbodySection.match(/<tbody>[\s\S]*?<td[^>]*class="main-change[^"]*"[^>]*>[\s\S]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i);
        if (tbodyMatch && tbodyMatch[1]) {
          const value = tbodyMatch[1].replace(/,/g, '').trim();
          const num = parseFloat(value);
          if (!isNaN(num) && num > 0) {
            lastTrade = num;
          }
        }
      }
    }
    
    // Pattern 3: Fallback - find "Last Trade" and get the first number in a td with "main-change" class
    if (!lastTrade) {
      const lastTradeIndex = html.indexOf('Last Trade');
      if (lastTradeIndex !== -1) {
        const sectionAfter = html.substring(lastTradeIndex, lastTradeIndex + 3000);
        const mainChangeMatch = sectionAfter.match(/<td[^>]*class="main-change[^"]*"[^>]*>[\s\S]*?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i);
        if (mainChangeMatch && mainChangeMatch[1]) {
          const value = mainChangeMatch[1].replace(/,/g, '').trim();
          const num = parseFloat(value);
          if (!isNaN(num) && num > 0 && num < 2000000) {
            lastTrade = num;
          }
        }
      }
    }

    // Parse Change (with +/- sign)
    const changeMatch = html.match(/Change[\s\S]*?<td[^>]*>([+\-]?[\d,]+(?:\.\d+)?)<\/td>/i);
    let change: number | null = null;
    if (changeMatch && changeMatch[1]) {
      const value = changeMatch[1].replace(/,/g, '').replace(/\+/, '').trim();
      change = parseFloat(value);
      if (isNaN(change)) change = null;
    }

    // Parse Change in %
    const changePercentMatch = html.match(/Change in %[\s\S]*?<td[^>]*>([+\-]?[\d.]+)%<\/td>/i);
    let changePercent: number | null = null;
    if (changePercentMatch && changePercentMatch[1]) {
      const value = changePercentMatch[1].replace(/\+/, '').trim();
      changePercent = parseFloat(value);
      if (isNaN(changePercent)) changePercent = null;
    }

    // Parse High, Low, Open using helper
    const high = extractNumber('High', html);
    const low = extractNumber('Low', html);
    const open = extractNumber('Open', html);

    // Parse Last Trade Time
    const lastTradeTimeMatch = html.match(/Last Trade on ([\d\s]+(?:AM|PM)[\s\S]*?Market Close)/i);
    const lastTradeTime = lastTradeTimeMatch ? lastTradeTimeMatch[1].trim() : undefined;

    // Parse timestamp
    const timestampMatch = html.match(/As on[^<]*?([\d\s]+(?:AM|PM)[^<]*?India Time)/i);
    const timestamp = timestampMatch ? timestampMatch[1].trim() : new Date().toISOString();

    if (lastTrade === null) {
      console.error(`Failed to parse price data for ${symbol} from ${url}`);
      return null;
    }

    return {
      symbol,
      lastTrade,
      change: change || 0,
      changePercent: changePercent || 0,
      high: high || 0,
      low: low || 0,
      open: open || 0,
      timestamp,
      lastTradeTime,
    };
  } catch (error) {
    console.error(`Error fetching current price for ${symbol} from ${url}:`, error);
    return null;
  }
}

/**
 * Fetch current prices for multiple commodities
 * @param commodityUrls - Map of symbol to URL (e.g., { 'GOLD': 'https://mcxlive.org/gold/' })
 * @returns Map of symbol to current price data
 */
export async function fetchMultipleCurrentMCXPrices(
  commodityUrls: Record<string, string>
): Promise<Record<string, CurrentMCXPrice | null>> {
  const results: Record<string, CurrentMCXPrice | null> = {};

  // Fetch all prices in parallel
  const promises = Object.entries(commodityUrls).map(async ([symbol, url]) => {
    const price = await fetchCurrentMCXPrice(url, symbol);
    return { symbol, price };
  });

  const fetchedPrices = await Promise.all(promises);

  fetchedPrices.forEach(({ symbol, price }) => {
    results[symbol] = price;
  });

  return results;
}