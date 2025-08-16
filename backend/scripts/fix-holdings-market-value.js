const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixHoldingsMarketValue() {
  try {
    console.log('Starting to fix holdings market values...');
    
    // Get all holdings
    const holdings = await prisma.holding.findMany();
    console.log(`Found ${holdings.length} holdings to process`);
    
    let updatedCount = 0;
    
    for (const holding of holdings) {
      // Calculate total quantity (quantity + collateralQuantity)
      const totalQuantity = holding.quantity + (holding.collateralQuantity || 0);
      
      // Recalculate market value and P&L
      const newMarketValue = totalQuantity * holding.lastPrice;
      const newPnL = newMarketValue - (totalQuantity * holding.averagePrice);
      const newPnLPercentage = (totalQuantity * holding.averagePrice) > 0 
        ? (newPnL / (totalQuantity * holding.averagePrice)) * 100 
        : 0;
      
      // Update the holding if values have changed
      if (holding.marketValue !== newMarketValue || 
          holding.pnl !== newPnL || 
          holding.pnlPercentage !== newPnLPercentage) {
        
        await prisma.holding.update({
          where: { id: holding.id },
          data: {
            marketValue: newMarketValue,
            pnl: newPnL,
            pnlPercentage: newPnLPercentage,
            updatedAt: new Date(),
          },
        });
        
        console.log(`Updated holding ${holding.tradingSymbol}:`);
        console.log(`  Old market value: ${holding.marketValue}`);
        console.log(`  New market value: ${newMarketValue}`);
        console.log(`  Quantity: ${holding.quantity}, Collateral: ${holding.collateralQuantity || 0}`);
        console.log(`  Total quantity: ${totalQuantity}`);
        console.log(`  Last price: ${holding.lastPrice}`);
        console.log('---');
        
        updatedCount++;
      }
    }
    
    console.log(`\nCompleted! Updated ${updatedCount} holdings out of ${holdings.length} total holdings.`);
    
  } catch (error) {
    console.error('Error fixing holdings market values:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixHoldingsMarketValue();
