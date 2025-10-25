import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFOStocks() {
  console.log('Checking F&O stocks in database...\n');
  
  try {
    // Get all equity stocks
    const equityStocks = await prisma.symbolMargin.findMany({
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
    
    console.log(`Total equity stocks in database: ${equityStocks.length}\n`);
    
    // Display stocks in groups of 10
    const stocksPerGroup = 10;
    for (let i = 0; i < equityStocks.length; i += stocksPerGroup) {
      const group = equityStocks.slice(i, i + stocksPerGroup);
      console.log(`Stocks ${i + 1}-${Math.min(i + stocksPerGroup, equityStocks.length)}:`);
      group.forEach(stock => {
        const margin = stock.margin > 0 ? stock.margin : 'Not set';
        const safetyMargin = stock.safetyMargin ? `${stock.safetyMargin}%` : 'Not set';
        console.log(`  ${stock.symbol} - Margin: ${margin}, Safety: ${safetyMargin}`);
      });
      console.log('');
    }
    
    // Show statistics
    const stocksWithMargin = equityStocks.filter(stock => stock.margin > 0).length;
    const stocksWithSafetyMargin = equityStocks.filter(stock => stock.safetyMargin !== null).length;
    
    console.log('Statistics:');
    console.log(`- Total stocks: ${equityStocks.length}`);
    console.log(`- Stocks with margin set: ${stocksWithMargin}`);
    console.log(`- Stocks with safety margin set: ${stocksWithSafetyMargin}`);
    console.log(`- Stocks without margin: ${equityStocks.length - stocksWithMargin}`);
    console.log(`- Stocks without safety margin: ${equityStocks.length - stocksWithSafetyMargin}`);
    
  } catch (error) {
    console.error('Error checking F&O stocks:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
checkFOStocks()
  .then(() => {
    console.log('\nCheck completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Check failed:', error);
    process.exit(1);
  });
