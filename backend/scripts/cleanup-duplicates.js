const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  console.log('Starting duplicate cleanup process...\n');

  try {
    // 1. Clean up P&L duplicates
    console.log('=== Cleaning up P&L duplicates ===');
    
    // Find duplicate P&L records based on key fields
    const pnlDuplicates = await prisma.$queryRaw`
      WITH duplicates AS (
        SELECT 
          "uploadId",
          "symbol",
          "instrumentType",
          "entryDate",
          "exitDate",
          "quantity",
          "buyValue",
          "sellValue",
          "profit",
          COUNT(*) as count,
          MIN(id) as keep_id
        FROM pnl_records 
        WHERE "symbol" IS NOT NULL 
          AND "symbol" != ''
        GROUP BY 
          "uploadId",
          "symbol",
          "instrumentType",
          "entryDate",
          "exitDate",
          "quantity",
          "buyValue",
          "sellValue",
          "profit"
        HAVING COUNT(*) > 1
      )
      SELECT * FROM duplicates
    `;

    console.log(`Found ${pnlDuplicates.length} groups of duplicate P&L records`);

    let pnlDeletedCount = 0;
    for (const duplicate of pnlDuplicates) {
      const deleted = await prisma.pnLRecord.deleteMany({
        where: {
          uploadId: duplicate.uploadId,
          symbol: duplicate.symbol,
          instrumentType: duplicate.instrumentType,
          entryDate: duplicate.entryDate,
          exitDate: duplicate.exitDate,
          quantity: duplicate.quantity,
          buyValue: duplicate.buyValue,
          sellValue: duplicate.sellValue,
          profit: duplicate.profit,
          id: {
            not: duplicate.keep_id
          }
        }
      });
      pnlDeletedCount += deleted.count;
      console.log(`Deleted ${deleted.count} duplicate P&L records for ${duplicate.symbol} (keeping ID: ${duplicate.keep_id})`);
    }

    // 2. Clean up Dividend duplicates
    console.log('\n=== Cleaning up Dividend duplicates ===');
    
    const dividendDuplicates = await prisma.$queryRaw`
      WITH duplicates AS (
        SELECT 
          "uploadId",
          "symbol",
          "isin",
          "exDate",
          "quantity",
          "dividendPerShare",
          "netDividendAmount",
          COUNT(*) as count,
          MIN(id) as keep_id
        FROM dividend_records 
        WHERE "symbol" IS NOT NULL 
          AND "symbol" != ''
        GROUP BY 
          "uploadId",
          "symbol",
          "isin",
          "exDate",
          "quantity",
          "dividendPerShare",
          "netDividendAmount"
        HAVING COUNT(*) > 1
      )
      SELECT * FROM duplicates
    `;

    console.log(`Found ${dividendDuplicates.length} groups of duplicate Dividend records`);

    let dividendDeletedCount = 0;
    for (const duplicate of dividendDuplicates) {
      const deleted = await prisma.dividendRecord.deleteMany({
        where: {
          uploadId: duplicate.uploadId,
          symbol: duplicate.symbol,
          isin: duplicate.isin,
          exDate: duplicate.exDate,
          quantity: duplicate.quantity,
          dividendPerShare: duplicate.dividendPerShare,
          netDividendAmount: duplicate.netDividendAmount,
          id: {
            not: duplicate.keep_id
          }
        }
      });
      dividendDeletedCount += deleted.count;
      console.log(`Deleted ${deleted.count} duplicate Dividend records for ${duplicate.symbol} (keeping ID: ${duplicate.keep_id})`);
    }

    // 3. Clean up empty/invalid records
    console.log('\n=== Cleaning up empty/invalid records ===');
    
    const emptyPnlRecords = await prisma.pnLRecord.deleteMany({
      where: {
        OR: [
          { symbol: null },
          { symbol: '' },
          {
            AND: [
              { quantity: null },
              { buyValue: null },
              { sellValue: null },
              { profit: null }
            ]
          }
        ]
      }
    });

    const emptyDividendRecords = await prisma.dividendRecord.deleteMany({
      where: {
        OR: [
          { symbol: null },
          { symbol: '' },
          {
            AND: [
              { quantity: null },
              { dividendPerShare: null },
              { netDividendAmount: null }
            ]
          }
        ]
      }
    });

    console.log(`Deleted ${emptyPnlRecords.count} empty P&L records`);
    console.log(`Deleted ${emptyDividendRecords.count} empty Dividend records`);

    // 4. Summary
    console.log('\n=== Cleanup Summary ===');
    console.log(`Total P&L duplicates removed: ${pnlDeletedCount}`);
    console.log(`Total Dividend duplicates removed: ${dividendDeletedCount}`);
    console.log(`Total empty P&L records removed: ${emptyPnlRecords.count}`);
    console.log(`Total empty Dividend records removed: ${emptyDividendRecords.count}`);
    console.log(`Total records cleaned up: ${pnlDeletedCount + dividendDeletedCount + emptyPnlRecords.count + emptyDividendRecords.count}`);

    // 5. Final counts
    const finalPnlCount = await prisma.pnLRecord.count();
    const finalDividendCount = await prisma.dividendRecord.count();
    
    console.log('\n=== Final Record Counts ===');
    console.log(`P&L records: ${finalPnlCount}`);
    console.log(`Dividend records: ${finalDividendCount}`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupDuplicates()
  .then(() => {
    console.log('\nCleanup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });
