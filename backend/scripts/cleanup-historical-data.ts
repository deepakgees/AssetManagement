import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupHistoricalData() {
  try {
    console.log('🔍 Analyzing historical_price_equity table...\n');

    // Step 1: Get all unique symbols from historical_price_equity table
    const historicalSymbols = await prisma.historicalPriceEquity.findMany({
      select: {
        symbol: true
      },
      distinct: ['symbol'],
      orderBy: {
        symbol: 'asc'
      }
    });

    const historicalSymbolNames = historicalSymbols.map(record => record.symbol);
    console.log(`📊 Found ${historicalSymbolNames.length} unique symbols in historical_price_equity table`);

    // Step 2: Get all FNO symbols from symbols_margins table
    const fnoSymbols = await prisma.symbolMargin.findMany({
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

    const fnoSymbolNames = fnoSymbols.map(record => record.symbol);
    console.log(`📊 Found ${fnoSymbolNames.length} FNO symbols in symbols_margins table`);

    // Step 3: Find symbols that have historical data but are not FNO
    const nonFNOHistoricalSymbols = historicalSymbolNames.filter(symbol => 
      !fnoSymbolNames.includes(symbol)
    );

    // Step 4: Find FNO symbols that don't have historical data
    const fnoSymbolsWithoutHistorical = fnoSymbolNames.filter(symbol => 
      !historicalSymbolNames.includes(symbol)
    );

    console.log('\n' + '='.repeat(80));
    console.log('📋 ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    console.log(`📊 Total symbols with historical data: ${historicalSymbolNames.length}`);
    console.log(`📊 Total FNO symbols: ${fnoSymbolNames.length}`);
    console.log(`❌ Non-FNO symbols with historical data: ${nonFNOHistoricalSymbols.length}`);
    console.log(`⚠️  FNO symbols without historical data: ${fnoSymbolsWithoutHistorical.length}`);
    console.log('='.repeat(80));

    if (nonFNOHistoricalSymbols.length > 0) {
      console.log('\n🚨 NON-FNO SYMBOLS WITH HISTORICAL DATA (Will be removed):');
      console.log('-'.repeat(60));
      
      // Get detailed info about records to be deleted
      const deletionStats = [];
      for (const symbol of nonFNOHistoricalSymbols) {
        const recordCount = await prisma.historicalPriceEquity.count({
          where: { symbol }
        });
        deletionStats.push({ symbol, recordCount });
        console.log(`${symbol.padEnd(15)} - ${recordCount.toString().padStart(4)} records`);
      }
      
      const totalRecordsToDelete = deletionStats.reduce((sum, stat) => sum + stat.recordCount, 0);
      console.log(`\nTotal records to delete: ${totalRecordsToDelete}`);

      // Create backup before deletion
      console.log('\n💾 Creating backup of data to be deleted...');
      const backupData = [];
      for (const stat of deletionStats) {
        const records = await prisma.historicalPriceEquity.findMany({
          where: { symbol: stat.symbol },
          orderBy: [
            { year: 'desc' },
            { month: 'desc' }
          ]
        });
        backupData.push(...records);
      }

      // Write backup to file
      const backupFileName = `historical_data_backup_${new Date().toISOString().split('T')[0]}.json`;
      require('fs').writeFileSync(backupFileName, JSON.stringify(backupData, null, 2));
      console.log(`✅ Backup created: ${backupFileName}`);

      // Confirm deletion
      console.log('\n⚠️  WARNING: This will permanently delete historical data for non-FNO symbols!');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
      
      // Wait 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Perform deletion
      console.log('\n🗑️  Deleting historical data for non-FNO symbols...');
      let deletedCount = 0;
      
      for (const symbol of nonFNOHistoricalSymbols) {
        const deleteResult = await prisma.historicalPriceEquity.deleteMany({
          where: { symbol }
        });
        deletedCount += deleteResult.count;
        console.log(`Deleted ${deleteResult.count} records for ${symbol}`);
      }
      
      console.log(`✅ Deleted ${deletedCount} total records`);
    } else {
      console.log('\n✅ No non-FNO symbols found in historical data!');
    }

    if (fnoSymbolsWithoutHistorical.length > 0) {
      console.log('\n⚠️  FNO SYMBOLS WITHOUT HISTORICAL DATA:');
      console.log('-'.repeat(60));
      fnoSymbolsWithoutHistorical.forEach((symbol, index) => {
        console.log(`${(index + 1).toString().padStart(3)}. ${symbol}`);
      });
      console.log(`\nTotal FNO symbols without historical data: ${fnoSymbolsWithoutHistorical.length}`);
      console.log('💡 Consider fetching historical data for these symbols if needed.');
    } else {
      console.log('\n✅ All FNO symbols have historical data!');
    }

    // Step 5: Final verification
    console.log('\n🔍 Final verification...');
    const finalHistoricalSymbols = await prisma.historicalPriceEquity.findMany({
      select: {
        symbol: true
      },
      distinct: ['symbol'],
      orderBy: {
        symbol: 'asc'
      }
    });

    const finalHistoricalSymbolNames = finalHistoricalSymbols.map(record => record.symbol);
    
    // Check if all remaining historical symbols are FNO
    const remainingNonFNO = finalHistoricalSymbolNames.filter(symbol => 
      !fnoSymbolNames.includes(symbol)
    );

    console.log('='.repeat(80));
    console.log('📋 FINAL VERIFICATION');
    console.log('='.repeat(80));
    console.log(`📊 Remaining symbols with historical data: ${finalHistoricalSymbolNames.length}`);
    console.log(`📊 FNO symbols: ${fnoSymbolNames.length}`);
    console.log(`❌ Remaining non-FNO symbols: ${remainingNonFNO.length}`);

    if (remainingNonFNO.length === 0) {
      console.log('\n🎉 SUCCESS! Only FNO symbols have historical data now!');
    } else {
      console.log('\n⚠️  Some non-FNO symbols still have historical data:');
      remainingNonFNO.forEach(symbol => console.log(`  - ${symbol}`));
    }

    // Generate final report
    const finalReport = {
      timestamp: new Date().toISOString(),
      operation: 'cleanup_historical_data',
      before: {
        total_historical_symbols: historicalSymbolNames.length,
        fno_symbols: fnoSymbolNames.length,
        non_fno_with_historical: nonFNOHistoricalSymbols.length,
        fno_without_historical: fnoSymbolsWithoutHistorical.length
      },
      after: {
        total_historical_symbols: finalHistoricalSymbolNames.length,
        remaining_non_fno: remainingNonFNO.length
      },
      deleted_symbols: nonFNOHistoricalSymbols,
      fno_without_historical: fnoSymbolsWithoutHistorical
    };

    require('fs').writeFileSync('historical_cleanup_report.json', JSON.stringify(finalReport, null, 2));
    console.log('\n📁 Generated: historical_cleanup_report.json');

  } catch (error) {
    console.error('❌ Error during historical data cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupHistoricalData();
