import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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