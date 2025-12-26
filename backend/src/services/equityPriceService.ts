import axios from 'axios';

export interface CurrentEquityPrice {
  symbol: string;
  lastTrade: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  timestamp?: string;
}

/**
 * Fetch current price of an equity from Yahoo Finance API
 * @param symbol - The equity symbol (e.g., 'RELIANCE', 'TCS', 'INFY')
 * @returns Current price data or null if fetch fails
 */
export async function fetchCurrentEquityPrice(symbol: string): Promise<CurrentEquityPrice | null> {
  try {
    // Add NSE exchange suffix for Indian stocks if not already present
    const nseSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    
    // Use Yahoo Finance chart API (v8) which is more reliable than quote API
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${nseSymbol}`;
    
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400; // 24 hours ago
    
    const response = await axios.get(chartUrl, {
      params: {
        period1: oneDayAgo,
        period2: now,
        interval: '1d',
        includePrePost: false,
        events: 'div,split'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    if (!response.data || !response.data.chart || !response.data.chart.result || response.data.chart.result.length === 0) {
      console.error(`No chart data for symbol ${symbol}:`, response.data);
      return null;
    }

    const result = response.data.chart.result[0];
    const meta = result.meta;
    const indicators = result.indicators;
    
    if (!meta || !indicators || !indicators.quote || !indicators.quote[0]) {
      console.error(`Invalid chart data structure for symbol ${symbol}`);
      return null;
    }

    const quote = indicators.quote[0];
    const timestamps = result.timestamp;
    const lastIndex = timestamps ? timestamps.length - 1 : -1;
    
    // Get the latest price data
    const lastTrade = meta.regularMarketPrice || (lastIndex >= 0 && quote.close ? quote.close[lastIndex] : null);
    const previousClose = meta.previousClose || meta.chartPreviousClose || lastTrade;
    const change = lastTrade && previousClose ? lastTrade - previousClose : 0;
    const changePercent = previousClose && previousClose !== 0 ? (change / previousClose) * 100 : 0;
    const high = lastIndex >= 0 && quote.high ? quote.high[lastIndex] : (meta.regularMarketDayHigh || lastTrade);
    const low = lastIndex >= 0 && quote.low ? quote.low[lastIndex] : (meta.regularMarketDayLow || lastTrade);
    const open = lastIndex >= 0 && quote.open ? quote.open[lastIndex] : (meta.regularMarketOpen || lastTrade);
    const volume = lastIndex >= 0 && quote.volume ? quote.volume[lastIndex] : (meta.regularMarketVolume || 0);
    const timestamp = timestamps && timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1] * 1000).toISOString() : undefined;

    if (!lastTrade || isNaN(lastTrade)) {
      console.error(`Invalid price data for symbol ${symbol}. Meta:`, meta);
      return null;
    }

    return {
      symbol: symbol.toUpperCase(),
      lastTrade,
      change,
      changePercent,
      high,
      low,
      open,
      previousClose,
      volume,
      timestamp
    };
  } catch (error) {
    console.error(`Error fetching current equity price for ${symbol}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Fetch current prices for multiple equities
 * @param symbols - Array of equity symbols
 * @returns Array of current price data
 */
export async function fetchMultipleCurrentEquityPrices(symbols: string[]): Promise<CurrentEquityPrice[]> {
  try {
    // Fetch prices for all symbols in parallel using Promise.all
    // Using chart API which is more reliable than quote API
    const pricePromises = symbols.map(symbol => fetchCurrentEquityPrice(symbol));
    const prices = await Promise.all(pricePromises);
    
    // Filter out null values
    const validPrices = prices.filter((price): price is CurrentEquityPrice => price !== null);
    console.log(`Successfully fetched ${validPrices.length} equity prices out of ${symbols.length} requested`);
    return validPrices;
  } catch (error) {
    console.error('Error fetching multiple current equity prices:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

