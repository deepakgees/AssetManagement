import express, { Request, Response, NextFunction } from 'express';
import { prisma } from '../index';

const router = express.Router();

// Get all holdings
router.get('/', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;

    const whereClause: any = {};

    if (accountId) {
      whereClause.accountId = parseInt(accountId as string);
    }

    const holdings = await prisma.holding.findMany({
      where: whereClause,
      include: {
        account: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ holdings });
  } catch (error) {
    console.error('Get holdings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unmapped holdings
router.get('/unmapped', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;

    const whereClause: any = {};
    if (accountId) {
      whereClause.accountId = parseInt(accountId as string);
    }

    // Get all holdings and mutual fund holdings
    const [holdings, mutualFundHoldings] = await Promise.all([
      prisma.holding.findMany({
        where: whereClause,
        include: {
          account: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.mutualFundHolding.findMany({
        where: whereClause,
        include: {
          account: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // Get all category mappings
    const categoryMappings = await prisma.holdingCategoryMapping.findMany();
    const categoryMap = new Map<string, string>();
    categoryMappings.forEach(mapping => {
      const key = `${mapping.tradingSymbol}_${mapping.holdingType}`;
      categoryMap.set(key, mapping.category);
    });

    // Filter unmapped holdings
    const unmappedEquityHoldings = holdings.filter(holding => {
      const key = `${holding.tradingSymbol}_equity`;
      return !categoryMap.has(key);
    });

    const unmappedMutualFundHoldings = mutualFundHoldings.filter(mfHolding => {
      const key = `${mfHolding.tradingSymbol}_mutual_fund`;
      return !categoryMap.has(key);
    });

    res.json({
      equityHoldings: unmappedEquityHoldings,
      mutualFundHoldings: unmappedMutualFundHoldings,
    });
  } catch (error) {
    console.error('Get unmapped holdings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get holdings summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;

    const whereClause: any = {};

    if (accountId) {
      whereClause.accountId = parseInt(accountId as string);
    }

    // Get equity holdings and mutual fund holdings in parallel
    const [holdings, mutualFundHoldings] = await Promise.all([
      prisma.holding.findMany({
        where: whereClause,
        include: {
          account: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.mutualFundHolding.findMany({
        where: whereClause,
        include: {
          account: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // Calculate equity holdings summary
    const equityMarketValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const equityPnL = holdings.reduce((sum, h) => sum + h.pnl, 0);
    const equityInvestment = holdings.reduce((sum, h) => sum + (h.averagePrice * (h.quantity + (h.collateralQuantity || 0))), 0);

    // Calculate mutual fund holdings summary
    const mfMarketValue = mutualFundHoldings.reduce((sum, mf) => sum + (mf.lastPrice * mf.quantity), 0);
    const mfPnL = mutualFundHoldings.reduce((sum, mf) => sum + mf.pnl, 0);
    const mfInvestment = mutualFundHoldings.reduce((sum, mf) => sum + (mf.averagePrice * mf.quantity), 0);

    // Combined totals
    const totalMarketValue = equityMarketValue + mfMarketValue;
    const totalPnL = equityPnL + mfPnL;
    const totalInvestment = equityInvestment + mfInvestment;
    const totalPnLPercentage = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

    // Group by sector
    const sectorBreakdown = holdings.reduce((acc, holding) => {
      const sector = holding.sector || 'Others';
      if (!acc[sector]) {
        acc[sector] = { value: 0, count: 0 };
      }
      acc[sector].value += holding.marketValue;
      acc[sector].count += 1;
      return acc;
    }, {} as Record<string, { value: number; count: number }>);

    // Get category mappings
    const categoryMappings = await prisma.holdingCategoryMapping.findMany();
    const categoryMap = new Map<string, string>();
    categoryMappings.forEach(mapping => {
      const key = `${mapping.tradingSymbol}_${mapping.holdingType}`;
      categoryMap.set(key, mapping.category);
    });

    // Calculate category breakup - only use categories from mappings, "Unmapped" for others
    // Track both market value and invested amount per category
    const categoryBreakdown: Record<string, { marketValue: number; investedAmount: number }> = {};

    // Process equity holdings
    holdings.forEach(holding => {
      const key = `${holding.tradingSymbol}_equity`;
      const category = categoryMap.get(key) || 'Unmapped';
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { marketValue: 0, investedAmount: 0 };
      }
      categoryBreakdown[category].marketValue += holding.marketValue;
      categoryBreakdown[category].investedAmount += (holding.averagePrice * (holding.quantity + (holding.collateralQuantity || 0)));
    });

    // Process mutual fund holdings
    mutualFundHoldings.forEach(mfHolding => {
      const key = `${mfHolding.tradingSymbol}_mutual_fund`;
      const category = categoryMap.get(key) || 'Unmapped';
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { marketValue: 0, investedAmount: 0 };
      }
      categoryBreakdown[category].marketValue += (mfHolding.lastPrice * mfHolding.quantity);
      categoryBreakdown[category].investedAmount += (mfHolding.averagePrice * mfHolding.quantity);
    });

    res.json({
      summary: {
        totalHoldings: holdings.length + mutualFundHoldings.length,
        totalMarketValue,
        totalPnL,
        totalPnLPercentage,
        totalInvestment,
      },
      sectorBreakdown,
      categoryBreakdown,
      holdings,
      mutualFundHoldings,
    });
  } catch (error) {
    console.error('Get holdings summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single holding
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const holding = await prisma.holding.findFirst({
      where: {
        id: parseInt(req.params.id),
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!holding) {
      return res.status(404).json({ error: 'Holding not found' });
    }

    res.json({ holding });
  } catch (error) {
    console.error('Get holding error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new holding (for testing/demo purposes)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { tradingSymbol, quantity, collateralQuantity, averagePrice, lastPrice, exchange, sector, accountId } = req.body;

    // Verify account exists
    const account = await prisma.account.findFirst({
      where: {
        id: parseInt(accountId),
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const totalQuantity = quantity + (collateralQuantity || 0);
    const marketValue = totalQuantity * lastPrice;
    const pnl = marketValue - (totalQuantity * averagePrice);
    const pnlPercentage = (totalQuantity * averagePrice) > 0 ? (pnl / (totalQuantity * averagePrice)) * 100 : 0;

    const holding = await prisma.holding.create({
      data: {
        tradingSymbol,
        quantity,
        collateralQuantity: collateralQuantity || 0,
        averagePrice,
        lastPrice,
        marketValue,
        pnl,
        pnlPercentage,
        exchange,
        sector,
        accountId: parseInt(accountId),
      },
    });

    res.status(201).json({
      message: 'Holding created successfully',
      holding,
    });
  } catch (error) {
    console.error('Create holding error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update holding
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { tradingSymbol, quantity, collateralQuantity, averagePrice, lastPrice, exchange, sector } = req.body;
    const holdingId = parseInt(req.params.id);

    // Check if holding exists
    const existingHolding = await prisma.holding.findFirst({
      where: {
        id: holdingId,
      },
    });

    if (!existingHolding) {
      return res.status(404).json({ error: 'Holding not found' });
    }

    const totalQuantity = quantity + (collateralQuantity || 0);
    const marketValue = totalQuantity * lastPrice;
    const pnl = marketValue - (totalQuantity * averagePrice);
    const pnlPercentage = (totalQuantity * averagePrice) > 0 ? (pnl / (totalQuantity * averagePrice)) * 100 : 0;

    const updatedHolding = await prisma.holding.update({
      where: { id: holdingId },
      data: {
        tradingSymbol,
        quantity,
        collateralQuantity: collateralQuantity || 0,
        averagePrice,
        lastPrice,
        marketValue,
        pnl,
        pnlPercentage,
        exchange,
        sector,
        updatedAt: new Date(),
      },
    });

    res.json({
      message: 'Holding updated successfully',
      holding: updatedHolding,
    });
  } catch (error) {
    console.error('Update holding error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete holding
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const holdingId = parseInt(req.params.id);

    // Check if holding exists
    const existingHolding = await prisma.holding.findFirst({
      where: {
        id: holdingId,
      },
    });

    if (!existingHolding) {
      return res.status(404).json({ error: 'Holding not found' });
    }

    await prisma.holding.delete({
      where: { id: holdingId },
    });

    res.json({ message: 'Holding deleted successfully' });
  } catch (error) {
    console.error('Delete holding error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 