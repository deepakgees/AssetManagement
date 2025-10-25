import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// NSE F&O stocks list (as of latest update)
const NSE_FO_STOCKS = [
  'ADANIENT', 'ADANIPORTS', 'ADANIPOWER', 'APOLLOHOSP', 'ASIANPAINT', 'AXISBANK', 'BAJAJ-AUTO', 'BAJFINANCE', 'BAJAJFINSV', 'BPCL',
  'BHARTIARTL', 'BRITANNIA', 'CIPLA', 'COALINDIA', 'DRREDDY', 'EICHERMOT', 'GRASIM', 'HCLTECH', 'HDFCBANK', 'HDFCLIFE',
  'HEROMOTOCO', 'HINDALCO', 'HINDUNILVR', 'ICICIBANK', 'ITC', 'INDUSINDBK', 'INFY', 'JSWSTEEL', 'KOTAKBANK', 'LT',
  'LTIM', 'MARUTI', 'NESTLEIND', 'NTPC', 'ONGC', 'POWERGRID', 'RELIANCE', 'SBILIFE', 'SBIN', 'SUNPHARMA',
  'TATACONSUM', 'TATAMOTORS', 'TATASTEEL', 'TCS', 'TECHM', 'TITAN', 'ULTRACEMCO', 'UPL', 'WIPRO', 'ZEEL',
  'ABB', 'ACC', 'AUBANK', 'BANDHANBNK', 'BANKBARODA', 'BEL', 'BHEL', 'BIOCON', 'BOSCHLTD', 'CADILAHC',
  'CHOLAFIN', 'CROMPTON', 'DABUR', 'DIVISLAB', 'DLF', 'DMART', 'FEDERALBNK', 'GAIL', 'GODREJCP', 'GODREJPROP',
  'HAL', 'HAVELLS', 'HDFCAMC', 'HINDCOPPER', 'HINDPETRO', 'IBULHSGFIN', 'ICICIGI', 'ICICIPRULI', 'IDBI', 'IDFCFIRSTB',
  'IGL', 'INDIGO', 'JINDALSTEL', 'JUBLFOOD', 'LALPATHLAB', 'LICHSGFIN', 'LUPIN', 'M&M', 'MCDOWELL-N', 'MFSL',
  'MINDTREE', 'MOTHERSON', 'MPHASIS', 'MRF', 'MUTHOOTFIN', 'NAUKRI', 'NMDC', 'PAGEIND', 'PEL', 'PETRONET',
  'PIDILITIND', 'PNB', 'POLYCAB', 'PVR', 'RBLBANK', 'SAIL', 'SHREECEM', 'SIEMENS', 'SRF', 'STAR',
  'TATACHEM', 'TATAPOWER', 'TORNTPHARM', 'TRENT', 'TVSMOTORS', 'UBL', 'VEDL', 'VOLTAS', 'WHIRLPOOL', 'YESBANK',
  'ZYDUSLIFE', '3MINDIA', 'ABBOTINDIA', 'ADANIGREEN', 'ADANITRANS', 'ALKEM', 'AMBUJACEMENT', 'APLLTD', 'ASHOKLEY', 'ASTRAL',
  'ATUL', 'AUBANK', 'AUROPHARMA', 'BALRAMCHIN', 'BANDHANBNK', 'BATAINDIA', 'BERGEPAINT', 'BHARATFORG', 'BIOCON', 'BOSCHLTD',
  'CADILAHC', 'CHOLAFIN', 'CIPLA', 'COLPAL', 'CONCOR', 'CROMPTON', 'CUMMINSIND', 'DABUR', 'DIVISLAB', 'DLF',
  'DMART', 'DRREDDY', 'EICHERMOT', 'ESCORTS', 'EXIDEIND', 'FEDERALBNK', 'GAIL', 'GLENMARK', 'GODREJCP', 'GODREJPROP',
  'GRASIM', 'HAL', 'HAVELLS', 'HCLTECH', 'HDFCAMC', 'HDFCBANK', 'HDFCLIFE', 'HINDALCO', 'HINDCOPPER', 'HINDPETRO',
  'HINDUNILVR', 'IBULHSGFIN', 'ICICIBANK', 'ICICIGI', 'ICICIPRULI', 'IDBI', 'IDFCFIRSTB', 'IGL', 'INDIGO', 'INDUSINDBK',
  'INFY', 'ITC', 'JINDALSTEL', 'JUBLFOOD', 'JSWSTEEL', 'KOTAKBANK', 'LALPATHLAB', 'LICHSGFIN', 'LUPIN', 'LT',
  'LTIM', 'M&M', 'MARUTI', 'MCDOWELL-N', 'MFSL', 'MINDTREE', 'MOTHERSON', 'MPHASIS', 'MRF', 'MUTHOOTFIN',
  'NAUKRI', 'NESTLEIND', 'NMDC', 'NTPC', 'ONGC', 'PAGEIND', 'PEL', 'PETRONET', 'PIDILITIND', 'PNB',
  'POLYCAB', 'POWERGRID', 'PVR', 'RBLBANK', 'RELIANCE', 'SAIL', 'SBILIFE', 'SBIN', 'SHREECEM', 'SIEMENS',
  'SRF', 'STAR', 'SUNPHARMA', 'TATACONSUM', 'TATACHEM', 'TATAMOTORS', 'TATAPOWER', 'TATASTEEL', 'TCS', 'TECHM',
  'TITAN', 'TORNTPHARM', 'TRENT', 'TVSMOTORS', 'UBL', 'ULTRACEMCO', 'UPL', 'VEDL', 'VOLTAS', 'WHIRLPOOL',
  'WIPRO', 'YESBANK', 'ZEEL', 'ZYDUSLIFE'
];

async function fetchAndPopulateFOStocks() {
  console.log('Starting NSE F&O stocks population...');
  
  try {
    // Get unique stocks
    const uniqueStocks = [...new Set(NSE_FO_STOCKS)];
    console.log(`Found ${uniqueStocks.length} unique NSE F&O stocks`);

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
    const newStocks = uniqueStocks.filter(symbol => !existingSymbols.has(symbol));
    
    console.log(`Found ${existingSymbols.size} existing stocks, ${newStocks.length} new stocks to add`);

    if (newStocks.length === 0) {
      console.log('All NSE F&O stocks already exist in database');
      return;
    }

    // Add new stocks to database
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

    console.log(`Successfully added ${addedCount} new NSE F&O stocks`);

    // Get final count
    const totalEquityStocks = await prisma.symbolMargin.count({
      where: {
        symbolType: 'equity'
      }
    });
    
    console.log(`Total equity stocks in database: ${totalEquityStocks}`);
    console.log('NSE F&O stocks population completed successfully');

  } catch (error) {
    console.error('Error populating NSE F&O stocks:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
fetchAndPopulateFOStocks()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
