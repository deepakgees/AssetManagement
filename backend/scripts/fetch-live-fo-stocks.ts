import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fetchLiveFOStocks() {
  console.log('Fetching live NSE F&O stocks from API...');
  
  try {
    // NSE API endpoint for F&O stocks
    const apiUrl = 'https://www.nseindia.com/api/equity-stockIndices?index=SECURITIES%20IN%20F%26O';
    
    // Set headers to mimic a browser request
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Referer': 'https://www.nseindia.com/market-data/live-equity-market'
    };

    const response = await fetch(apiUrl, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format from NSE API');
    }
    
    // Extract symbols from the response
    const foStocks = data.data.map((item: any) => item.symbol).filter((symbol: string) => symbol);
    
    console.log(`Fetched ${foStocks.length} F&O stocks from NSE API`);
    
    // Check existing stocks in database
    const existingStocks = await prisma.symbolMargin.findMany({
      where: {
        symbolType: 'equity'
      },
      select: {
        symbol: true
      }
    });
    
    const existingSymbols = new Set(existingStocks.map(stock => stock.symbol));
    const newStocks = foStocks.filter((symbol: string) => !existingSymbols.has(symbol));
    const removedStocks = Array.from(existingSymbols).filter(symbol => !foStocks.includes(symbol));
    
    console.log(`Found ${existingSymbols.size} existing stocks`);
    console.log(`${newStocks.length} new stocks to add`);
    console.log(`${removedStocks.length} stocks removed from F&O list`);
    
    // Add new stocks
    let addedCount = 0;
    for (const symbol of newStocks) {
      try {
        await prisma.symbolMargin.create({
          data: {
            symbol: symbol,
            symbolType: 'equity',
            margin: 0,
            safetyMargin: null
          }
        });
        addedCount++;
        console.log(`Added: ${symbol}`);
      } catch (error) {
        console.error(`Error adding ${symbol}:`, error);
      }
    }
    
    // Optionally remove stocks that are no longer in F&O
    if (removedStocks.length > 0) {
      console.log(`\nStocks removed from F&O list: ${removedStocks.join(', ')}`);
      console.log('Note: These stocks are not automatically deleted from your database.');
      console.log('You may want to review and manually remove them if needed.');
    }
    
    console.log(`\nSuccessfully added ${addedCount} new F&O stocks`);
    
    // Get final count
    const totalEquityStocks = await prisma.symbolMargin.count({
      where: {
        symbolType: 'equity'
      }
    });
    
    console.log(`Total equity stocks in database: ${totalEquityStocks}`);
    console.log('Live F&O stocks fetch completed successfully');
    
  } catch (error) {
    console.error('Error fetching live F&O stocks:', error);
    
    // Fallback to static list if API fails
    console.log('\nFalling back to static F&O stocks list...');
    await fetchStaticFOStocks();
  } finally {
    await prisma.$disconnect();
  }
}

async function fetchStaticFOStocks() {
  // Static list as fallback
  const staticFOStocks = [
    'ADANIENT', 'ADANIPORTS', 'ADANIPOWER', 'APOLLOHOSP', 'ASIANPAINT', 'AXISBANK', 'BAJAJ-AUTO', 'BAJFINANCE', 'BAJAJFINSV', 'BPCL',
    'BHARTIARTL', 'BRITANNIA', 'CIPLA', 'COALINDIA', 'DRREDDY', 'EICHERMOT', 'GRASIM', 'HCLTECH', 'HDFCBANK', 'HDFCLIFE',
    'HEROMOTOCO', 'HINDALCO', 'HINDUNILVR', 'ICICIBANK', 'ITC', 'INDUSINDBK', 'INFY', 'JSWSTEEL', 'KOTAKBANK', 'LT',
    'LTIM', 'MARUTI', 'NESTLEIND', 'NTPC', 'ONGC', 'POWERGRID', 'RELIANCE', 'SBILIFE', 'SBIN', 'SUNPHARMA',
    'TATACONSUM', 'TATAMOTORS', 'TATASTEEL', 'TCS', 'TECHM', 'TITAN', 'ULTRACEMCO', 'UPL', 'WIPRO', 'ZEEL'
  ];
  
  const uniqueStocks = [...new Set(staticFOStocks)];
  console.log(`Using static list with ${uniqueStocks.length} F&O stocks`);
  
  // Add stocks to database (same logic as before)
  const existingStocks = await prisma.symbolMargin.findMany({
    where: { symbolType: 'equity' },
    select: { symbol: true }
  });
  
  const existingSymbols = new Set(existingStocks.map(stock => stock.symbol));
  const newStocks = uniqueStocks.filter(symbol => !existingSymbols.has(symbol));
  
  let addedCount = 0;
  for (const symbol of newStocks) {
    try {
      await prisma.symbolMargin.create({
        data: {
          symbol: symbol,
          symbolType: 'equity',
          margin: 0,
          safetyMargin: null
        }
      });
      addedCount++;
    } catch (error) {
      console.error(`Error adding ${symbol}:`, error);
    }
  }
  
  console.log(`Added ${addedCount} new stocks from static list`);
}

// Run the function
fetchLiveFOStocks()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
