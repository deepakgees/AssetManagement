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

async function syncFNOSymbols() {
  try {
    console.log('🔄 Starting FNO symbols synchronization...\n');

    // Get current equity symbols from the table
    const currentEquitySymbols = await prisma.symbolMargin.findMany({
      where: {
        symbolType: 'equity'
      },
      select: {
        id: true,
        symbol: true,
        margin: true,
        safetyMargin: true
      }
    });

    const currentSymbolNames = currentEquitySymbols.map(record => record.symbol);
    
    // Find missing FNO symbols (in FNO list but not in table)
    const missingFNOSymbols = FNO_SYMBOLS.filter(fnoSymbol => 
      !currentSymbolNames.includes(fnoSymbol)
    );

    // Find non-FNO symbols (in table but not in FNO list)
    const nonFNOSymbols = currentEquitySymbols.filter(record => 
      !FNO_SYMBOLS.includes(record.symbol)
    );

    console.log(`📊 Current equity symbols in table: ${currentEquitySymbols.length}`);
    console.log(`📊 Total FNO symbols: ${FNO_SYMBOLS.length}`);
    console.log(`➕ Missing FNO symbols to add: ${missingFNOSymbols.length}`);
    console.log(`➖ Non-FNO symbols to remove: ${nonFNOSymbols.length}\n`);

    // Step 1: Remove non-FNO symbols
    if (nonFNOSymbols.length > 0) {
      console.log('🗑️  Removing non-FNO symbols...');
      console.log('-'.repeat(50));
      
      for (const record of nonFNOSymbols) {
        console.log(`Removing: ${record.symbol} (ID: ${record.id})`);
        await prisma.symbolMargin.delete({
          where: { id: record.id }
        });
      }
      
      console.log(`✅ Removed ${nonFNOSymbols.length} non-FNO symbols\n`);
    } else {
      console.log('✅ No non-FNO symbols to remove\n');
    }

    // Step 2: Add missing FNO symbols
    if (missingFNOSymbols.length > 0) {
      console.log('➕ Adding missing FNO symbols...');
      console.log('-'.repeat(50));
      
      let addedCount = 0;
      let skippedCount = 0;
      
      for (const symbol of missingFNOSymbols) {
        try {
          await prisma.symbolMargin.create({
            data: {
              symbol: symbol,
              margin: 0, // Default margin value
              symbolType: 'equity'
            }
          });
          console.log(`Added: ${symbol}`);
          addedCount++;
        } catch (error: any) {
          if (error.code === 'P2002') {
            console.log(`Skipped: ${symbol} (already exists)`);
            skippedCount++;
          } else {
            console.error(`Error adding ${symbol}:`, error.message);
          }
        }
      }
      
      console.log(`✅ Added ${addedCount} new FNO symbols`);
      if (skippedCount > 0) {
        console.log(`⏭️  Skipped ${skippedCount} symbols (already existed)`);
      }
      console.log('');
    } else {
      console.log('✅ No missing FNO symbols to add\n');
    }

    // Step 3: Verify final state
    console.log('🔍 Verifying final state...');
    const finalEquitySymbols = await prisma.symbolMargin.findMany({
      where: {
        symbolType: 'equity'
      },
      select: {
        symbol: true
      },
      orderBy: {
        symbol: 'asc'
      }
    });

    const finalSymbolNames = finalEquitySymbols.map(record => record.symbol);
    
    // Check for any remaining discrepancies
    const stillMissing = FNO_SYMBOLS.filter(fnoSymbol => 
      !finalSymbolNames.includes(fnoSymbol)
    );
    
    const stillNonFNO = finalSymbolNames.filter(symbol => 
      !FNO_SYMBOLS.includes(symbol)
    );

    console.log('='.repeat(60));
    console.log('📋 FINAL VERIFICATION');
    console.log('='.repeat(60));
    console.log(`📊 Total equity symbols in table: ${finalSymbolNames.length}`);
    console.log(`📊 Total FNO symbols: ${FNO_SYMBOLS.length}`);
    console.log(`✅ FNO symbols in table: ${FNO_SYMBOLS.length - stillMissing.length}`);
    console.log(`❌ Still missing FNO symbols: ${stillMissing.length}`);
    console.log(`⚠️  Still non-FNO symbols: ${stillNonFNO.length}`);

    if (stillMissing.length > 0) {
      console.log('\n🚨 Still missing FNO symbols:');
      stillMissing.forEach(symbol => console.log(`  - ${symbol}`));
    }

    if (stillNonFNO.length > 0) {
      console.log('\n⚠️  Still non-FNO symbols:');
      stillNonFNO.forEach(symbol => console.log(`  - ${symbol}`));
    }

    if (stillMissing.length === 0 && stillNonFNO.length === 0) {
      console.log('\n🎉 SUCCESS! All FNO symbols are now in the table and no non-FNO symbols remain!');
    } else {
      console.log('\n⚠️  Some discrepancies remain. Please review the output above.');
    }

    // Generate final report
    const finalReport = {
      timestamp: new Date().toISOString(),
      operations: {
        removed_non_fno: nonFNOSymbols.length,
        added_missing_fno: missingFNOSymbols.length,
        final_equity_count: finalSymbolNames.length,
        total_fno_symbols: FNO_SYMBOLS.length
      },
      discrepancies: {
        still_missing: stillMissing,
        still_non_fno: stillNonFNO
      }
    };

    require('fs').writeFileSync('fno_sync_report.json', JSON.stringify(finalReport, null, 2));
    console.log('\n📁 Generated: fno_sync_report.json');

  } catch (error) {
    console.error('❌ Error during FNO symbols synchronization:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the synchronization
syncFNOSymbols();
