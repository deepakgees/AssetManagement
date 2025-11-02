import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// FNO symbols list from the image
const FNO_SYMBOLS = [
  '360ONE', 'ABB', 'APLAPOLLO', 'AUBANK', 'ADANIENSOL', 'ADANIENT', 'ADANIGREEN', 'ADANIPORTS', 
  'ABCAPITAL', 'ALKEM', 'AMBER', 'AMBUJACEM', 'ANGELONE', 'APOLLOHOSP', 'ASHOKLEY', 'ASIANPAINT', 
  'ASTRAL', 'AUROPHARMA', 'DMART', 'AXISBANK', 'BSE', 'BAJAJ-AUTO', 'BAJFINANCE', 'BAJAJFINSV', 
  'BANDHANBNK', 'BANKBARODA', 'BANKINDIA', 'BOL', 'BEL', 'BHARATFORG', 'BHEL', 'BPCL', 'BHARTIARTL', 
  'BIOCON', 'BLUESTARCO', 'BOSCHLTD', 'BRITANNIA', 'CGPOWER', 'CANBK', 'CDSL', 'CHOLAFIN', 'CIPLA', 
  'COALINDIA', 'COFORGE', 'COLPAL', 'CAMS', 'CONCOR', 'CROMPTON', 'CUMMINSIND', 'CYIENT', 'DLF', 
  'DABUR', 'DALBHARAT', 'DELHIVERY', 'DIVISLAB', 'DIXON', 'DRREDDY', 'ETERNAL', 'EICHERMOT', 
  'EXIDEIND', 'NYKAA', 'FORTIS', 'GAIL', 'GMRAIRPORT', 'GLENMARK', 'GODREJCP', 'GODREJPROP', 
  'GRASIM', 'HCLTECH', 'HDFCAMC', 'HDFCBANK', 'HDFCLIFE', 'HFCL', 'HAVELLS', 'HEROMOTOCO', 
  'HINDALCO', 'HAL', 'HINDPETRO', 'HINDUNILVR', 'HINDZINC', 'POWERINDIA', 'HUDCO', 'ICICIBANK', 
  'ICICIGI', 'ICICIPRULI', 'IDFCFIRSTB', 'IFL', 'ITC', 'INDIANB', 'IEX', 'IOC', 'IRCTC', 'IRFC', 
  'IREDA', 'IGL', 'INDUSTOWER', 'INDUSINDBK', 'NAUKRI', 'INFY', 'INOXWIND', 'INDIGO', 'JINDALSTEL', 
  'JSWENERGY', 'JSWSTEEL', 'JIOFIN', 'JUBLFOOD', 'KEL', 'KPITTECH', 'KALYANKJIL', 'KAYNES', 
  'KFINTECH', 'KOTAKBANK', 'LTF', 'LICHSGFIN', 'LTIM', 'LT', 'LAURUSLABS', 'LICI', 'LODHA', 
  'LUPIN', 'M&M', 'MANAPPURAM', 'MANKIND', 'MARICO', 'MARUTI', 'MFSL', 'MAXHEALTH', 'MAZDOCK', 
  'MPHASIS', 'MCX', 'MUTHOOTFIN', 'NBCC', 'NCC', 'NHPC', 'NMDC', 'NTPC', 'NATIONALUM', 'NESTLEIND', 
  'NUVAMA', 'OBEROIRLTY', 'ONGC', 'OIL', 'PAYTM', 'OFSS', 'POLICYBZR', 'PGEL', 'PIND', 'PNBHOUSING', 
  'PAGEIND', 'PATANJALI', 'PERSISTENT', 'PETRONET', 'PIDILITIND', 'PPLPHARMA', 'POLYCAB', 'PFC', 
  'POWERGRID', 'PRESTIGE', 'PNB', 'RBLBANK', 'RECLTD', 'RVNL', 'RELIANCE', 'SBICARD', 'SBILIFE', 
  'SHREECEM', 'SRF', 'SAMMAANCAP', 'MOTHERSON', 'SHRIRAMFIN', 'SIEMENS', 'SOLARINDS', 'SONACOMS', 
  'SBIN', 'SAIL', 'SUNPHARMA', 'SUPREMEIND', 'SUZLON', 'SYNGENE', 'TATACONSUM', 'TITAGARH', 
  'TVSMOTOR', 'TCS', 'TATAELXSI', 'TMPV', 'TATAPOWER', 'TATASTEEL', 'TATATECH', 'TECHM', 
  'FEDERALBNK', 'INDHOTEL', 'PHOENIXLTD', 'TITAN', 'TORNTPHARM', 'TORNTPOWER', 'TRENT', 'TIINDIA', 
  'UNOMINDA', 'UPL', 'ULTRACEMCO', 'UNIONBANK', 'UNITDSPR', 'VBL', 'VEDL', 'IDEA', 'VOLTAS', 
  'WIPRO', 'YESBANK', 'ZYDUSLIFE'
];

async function analyzeFNOSymbols() {
  try {
    console.log('🔍 Analyzing FNO symbols vs symbols_margins table...\n');

    // Get all equity symbols from symbols_margins table
    const equitySymbols = await prisma.symbolMargin.findMany({
      where: {
        symbolType: 'equity'
      },
      select: {
        symbol: true,
        margin: true,
        safetyMargin: true,
        createdAt: true
      },
      orderBy: {
        symbol: 'asc'
      }
    });

    console.log(`📊 Found ${equitySymbols.length} equity symbols in symbols_margins table`);
    console.log(`📊 Total FNO symbols: ${FNO_SYMBOLS.length}\n`);

    // Extract just the symbol names
    const equitySymbolNames = equitySymbols.map(record => record.symbol);
    
    // Find missing FNO symbols (in FNO list but not in symbols_margins table)
    const missingFNOSymbols = FNO_SYMBOLS.filter(fnoSymbol => 
      !equitySymbolNames.includes(fnoSymbol)
    );

    // Find non-FNO symbols (in symbols_margins table but not in FNO list)
    const nonFNOSymbols = equitySymbolNames.filter(equitySymbol => 
      !FNO_SYMBOLS.includes(equitySymbol)
    );

    // Find common symbols (both in FNO list and symbols_margins table)
    const commonSymbols = FNO_SYMBOLS.filter(fnoSymbol => 
      equitySymbolNames.includes(fnoSymbol)
    );

    // Generate detailed reports
    console.log('='.repeat(80));
    console.log('📋 ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Common symbols (FNO + symbols_margins): ${commonSymbols.length}`);
    console.log(`❌ Missing FNO symbols: ${missingFNOSymbols.length}`);
    console.log(`⚠️  Non-FNO symbols in table: ${nonFNOSymbols.length}`);
    console.log('='.repeat(80));

    // Report 1: Missing FNO symbols
    if (missingFNOSymbols.length > 0) {
      console.log('\n🚨 MISSING FNO SYMBOLS (Should be added to symbols_margins table):');
      console.log('-'.repeat(60));
      missingFNOSymbols.forEach((symbol, index) => {
        console.log(`${(index + 1).toString().padStart(3)}. ${symbol}`);
      });
      console.log(`\nTotal missing: ${missingFNOSymbols.length} symbols`);
    } else {
      console.log('\n✅ All FNO symbols are present in symbols_margins table!');
    }

    // Get detailed info for non-FNO symbols
    const nonFNODetails = equitySymbols.filter(record => 
      nonFNOSymbols.includes(record.symbol)
    );

    // Report 2: Non-FNO symbols
    if (nonFNOSymbols.length > 0) {
      console.log('\n⚠️  NON-FNO SYMBOLS (In symbols_margins table but not in FNO list):');
      console.log('-'.repeat(60));

      nonFNODetails.forEach((record, index) => {
        const safetyMarginInfo = record.safetyMargin ? ` (Safety: ${record.safetyMargin}%)` : '';
        console.log(`${(index + 1).toString().padStart(3)}. ${record.symbol} - Margin: ${record.margin}${safetyMarginInfo}`);
      });
      console.log(`\nTotal non-FNO: ${nonFNOSymbols.length} symbols`);
    } else {
      console.log('\n✅ All equity symbols in table are FNO symbols!');
    }

    // Report 3: Common symbols with details
    console.log('\n📊 COMMON SYMBOLS (FNO + symbols_margins) - Sample (first 20):');
    console.log('-'.repeat(60));
    const commonDetails = equitySymbols.filter(record => 
      commonSymbols.includes(record.symbol)
    ).slice(0, 20);

    commonDetails.forEach((record, index) => {
      const safetyMarginInfo = record.safetyMargin ? ` (Safety: ${record.safetyMargin}%)` : '';
      console.log(`${(index + 1).toString().padStart(3)}. ${record.symbol} - Margin: ${record.margin}${safetyMarginInfo}`);
    });

    if (commonSymbols.length > 20) {
      console.log(`... and ${commonSymbols.length - 20} more symbols`);
    }

    // Generate CSV files for easy import/export
    console.log('\n📁 Generating CSV files for analysis...');
    
    // Missing FNO symbols CSV
    const missingCSV = 'symbol,action\n' + missingFNOSymbols.map(symbol => `${symbol},ADD`).join('\n');
    require('fs').writeFileSync('missing_fno_symbols.csv', missingCSV);
    console.log('✅ Created: missing_fno_symbols.csv');

    // Non-FNO symbols CSV
    const nonFNOCSV = 'symbol,margin,safety_margin,action\n' + 
      nonFNODetails.map(record => 
        `${record.symbol},${record.margin},${record.safetyMargin || ''},REVIEW`
      ).join('\n');
    require('fs').writeFileSync('non_fno_symbols.csv', nonFNOCSV);
    console.log('✅ Created: non_fno_symbols.csv');

    // All equity symbols CSV
    const allEquityCSV = 'symbol,margin,safety_margin,is_fno,created_at\n' + 
      equitySymbols.map(record => 
        `${record.symbol},${record.margin},${record.safetyMargin || ''},${FNO_SYMBOLS.includes(record.symbol) ? 'YES' : 'NO'},${record.createdAt.toISOString()}`
      ).join('\n');
    require('fs').writeFileSync('all_equity_symbols.csv', allEquityCSV);
    console.log('✅ Created: all_equity_symbols.csv');

    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('1. Add missing FNO symbols to symbols_margins table');
    console.log('2. Review non-FNO symbols - consider removing or flagging them');
    console.log('3. Use the generated CSV files for bulk operations');
    console.log('4. Consider adding a "is_fno" flag to the table for better tracking');

  } catch (error) {
    console.error('❌ Error analyzing FNO symbols:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the analysis
analyzeFNOSymbols();
