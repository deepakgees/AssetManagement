import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EquityData {
  date: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface MonthlyEquityData {
  year: number;
  month: number;
  closingPrice: number;
  percentChange: number | null;
}

/**
 * Fetch equity historical data from external source
 * This is a mock implementation - in production, you would integrate with real data providers
 * like Yahoo Finance, Alpha Vantage, or other financial data APIs
 */
export async function fetchEquityData(symbol: string, startDate: Date, endDate: Date): Promise<EquityData[]> {
  try {
    // For now, we'll create mock data based on realistic equity price movements
    // In production, you would integrate with a real data provider
    const mockData = generateMockEquityData(symbol, startDate, endDate);
    return mockData;
  } catch (error) {
    console.error(`Error fetching equity data for ${symbol}:`, error);
    throw new Error(`Failed to fetch equity data for ${symbol}`);
  }
}

/**
 * Generate mock equity data for demonstration
 * In production, replace this with actual API calls to data providers
 */
function generateMockEquityData(symbol: string, startDate: Date, endDate: Date): EquityData[] {
  const data: EquityData[] = [];
  const currentDate = new Date(startDate);
  
  // Base price varies by symbol (mock realistic starting prices)
  const basePrices: { [key: string]: number } = {
    'RELIANCE': 1000,
    'TCS': 3000,
    'INFY': 1500,
    'HDFC': 2500,
    'ICICIBANK': 800,
    'SBIN': 300,
    'BHARTIARTL': 600,
    'ITC': 200,
    'LT': 1800,
    'ASIANPAINT': 2500,
    'MARUTI': 8000,
    'NESTLEIND': 18000,
    'HINDUNILVR': 2500,
    'KOTAKBANK': 1800,
    'AXISBANK': 700,
    'SUNPHARMA': 800,
    'TITAN': 2500,
    'ULTRACEMCO': 6000,
    'POWERGRID': 200,
    'NTPC': 150
  };
  
  let basePrice = basePrices[symbol.toUpperCase()] || 1000; // Default to 1000 if symbol not found
  
  while (currentDate <= endDate) {
    // Generate realistic price movements with some volatility
    const randomChange = (Math.random() - 0.5) * 0.15; // ±7.5% monthly change (higher volatility than commodities)
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
export function processEquityToMonthlyData(dailyData: EquityData[]): MonthlyEquityData[] {
  const monthlyData: MonthlyEquityData[] = [];
  
  // Group data by month
  const monthlyGroups: { [key: string]: EquityData[] } = {};
  
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
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // JavaScript months are 0-based
    const closingPrice = lastDay.price;
    
    // Calculate percentage change from previous month
    let percentChange: number | null = null;
    if (monthlyData.length > 0) {
      const previousPrice = monthlyData[monthlyData.length - 1].closingPrice;
      percentChange = ((closingPrice - previousPrice) / previousPrice) * 100;
    }
    
    monthlyData.push({
      year,
      month,
      closingPrice,
      percentChange
    });
  });
  
  return monthlyData;
}

/**
 * Store monthly equity data in database
 */
export async function storeEquityData(monthlyData: MonthlyEquityData[], symbol: string): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  
  for (const data of monthlyData) {
    try {
      const existing = await prisma.historicalPriceEquity.findUnique({
        where: {
          unique_equity_symbol_year_month: {
            symbol: symbol.toUpperCase(),
            year: data.year,
            month: data.month
          }
        }
      });
      
      if (existing) {
        await prisma.historicalPriceEquity.update({
          where: {
            unique_equity_symbol_year_month: {
              symbol: symbol.toUpperCase(),
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
        await prisma.historicalPriceEquity.create({
          data: {
            symbol: symbol.toUpperCase(),
            year: data.year,
            month: data.month,
            closingPrice: data.closingPrice,
            percentChange: data.percentChange
          }
        });
        created++;
      }
    } catch (error) {
      console.error(`Error storing equity data for ${symbol} ${data.year}-${data.month}:`, error);
    }
  }
  
  return { created, updated };
}

/**
 * Download and store equity data for a specific symbol and date range
 */
export async function downloadEquityData(symbol: string, startDate: Date, endDate: Date): Promise<{ created: number; updated: number; total: number }> {
  console.log(`Downloading equity data for ${symbol} from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  
  try {
    // Fetch daily data
    const dailyData = await fetchEquityData(symbol, startDate, endDate);
    
    // Process to monthly data
    const monthlyData = processEquityToMonthlyData(dailyData);
    
    // Store in database
    const result = await storeEquityData(monthlyData, symbol);
    
    return {
      ...result,
      total: monthlyData.length
    };
  } catch (error) {
    console.error(`Error downloading equity data for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Get popular Indian equity symbols for dropdown
 */
export function getPopularEquitySymbols(): string[] {
  return [
    'RELIANCE',
    'TCS',
    'INFY',
    'HDFC',
    'ICICIBANK',
    'SBIN',
    'BHARTIARTL',
    'ITC',
    'LT',
    'ASIANPAINT',
    'MARUTI',
    'NESTLEIND',
    'HINDUNILVR',
    'KOTAKBANK',
    'AXISBANK',
    'SUNPHARMA',
    'TITAN',
    'ULTRACEMCO',
    'POWERGRID',
    'NTPC'
  ];
}
