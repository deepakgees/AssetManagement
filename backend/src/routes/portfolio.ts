import express, { Request, Response, NextFunction } from 'express';
import { prisma } from '../index';

const router = express.Router();

// Get portfolio overview
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;

    const whereClause: any = {};

    if (accountId) {
      whereClause.accountId = parseInt(accountId as string);
    }

    // Get holdings and positions
    const [holdings, positions] = await Promise.all([
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
      prisma.position.findMany({
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

    // Calculate portfolio metrics
    const holdingsValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const holdingsPnL = holdings.reduce((sum, h) => sum + h.pnl, 0);
    const positionsValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const positionsPnL = positions.reduce((sum, p) => sum + p.pnl, 0);

    const totalValue = holdingsValue + positionsValue;
    const totalPnL = holdingsPnL + positionsPnL;
    const totalInvestment = holdings.reduce((sum, h) => sum + (h.averagePrice * h.quantity), 0) +
                           positions.reduce((sum, p) => sum + (p.averagePrice * p.quantity), 0);
    const totalPnLPercentage = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

    // Get latest portfolio snapshot
    const latestSnapshot = await prisma.portfolioSnapshot.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      overview: {
        totalValue,
        totalPnL,
        totalPnLPercentage,
        totalInvestment,
        holdingsValue,
        holdingsPnL,
        positionsValue,
        positionsPnL,
        totalHoldings: holdings.length,
        totalPositions: positions.length,
      },
      latestSnapshot,
      holdings,
      positions,
    });
  } catch (error) {
    console.error('Get portfolio overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get portfolio analytics
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;

    const whereClause: any = {};

    if (accountId) {
      whereClause.accountId = parseInt(accountId as string);
    }

    // Get holdings and positions
    const [holdings, positions] = await Promise.all([
      prisma.holding.findMany({
        where: whereClause,
      }),
      prisma.position.findMany({
        where: whereClause,
      }),
    ]);

    // Sector breakdown (from holdings)
    const sectorBreakdown = holdings.reduce((acc, holding) => {
      const sector = holding.sector || 'Others';
      if (!acc[sector]) {
        acc[sector] = { value: 0, count: 0, pnl: 0 };
      }
      acc[sector].value += holding.marketValue;
      acc[sector].count += 1;
      acc[sector].pnl += holding.pnl;
      return acc;
    }, {} as Record<string, { value: number; count: number; pnl: number }>);

    // Product breakdown (from positions)
    const productBreakdown = positions.reduce((acc, position) => {
      const product = position.product || 'Others';
      if (!acc[product]) {
        acc[product] = { value: 0, count: 0, pnl: 0 };
      }
      acc[product].value += position.marketValue;
      acc[product].count += 1;
      acc[product].pnl += position.pnl;
      return acc;
    }, {} as Record<string, { value: number; count: number; pnl: number }>);

    // Top performers (holdings)
    const topHoldings = holdings
      .sort((a, b) => b.pnlPercentage - a.pnlPercentage)
      .slice(0, 5);

    // Worst performers (holdings)
    const worstHoldings = holdings
      .sort((a, b) => a.pnlPercentage - b.pnlPercentage)
      .slice(0, 5);

    // Top performers (positions)
    const topPositions = positions
      .sort((a, b) => b.pnlPercentage - a.pnlPercentage)
      .slice(0, 5);

    // Worst performers (positions)
    const worstPositions = positions
      .sort((a, b) => a.pnlPercentage - b.pnlPercentage)
      .slice(0, 5);

    res.json({
      sectorBreakdown,
      productBreakdown,
      topHoldings,
      worstHoldings,
      topPositions,
      worstPositions,
    });
  } catch (error) {
    console.error('Get portfolio analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get portfolio performance history
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const { accountId, days = 30 } = req.query;

    const whereClause: any = {};

    if (accountId) {
      whereClause.accountId = parseInt(accountId as string);
    }

    // Get portfolio snapshots for the specified period
    const snapshots = await prisma.portfolioSnapshot.findMany({
      where: {
        ...whereClause,
        createdAt: {
          gte: new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate performance metrics
    const performanceData = snapshots.map((snapshot, index) => {
      const previousSnapshot = index > 0 ? snapshots[index - 1] : null;
      const dailyReturn = previousSnapshot 
        ? ((snapshot.totalValue - previousSnapshot.totalValue) / previousSnapshot.totalValue) * 100
        : 0;

      return {
        date: snapshot.createdAt,
        totalValue: snapshot.totalValue,
        totalPnL: snapshot.totalPnL,
        totalPnLPercentage: snapshot.totalPnLPercentage,
        dailyReturn,
      };
    });

    res.json({
      performanceData,
      snapshots,
    });
  } catch (error) {
    console.error('Get portfolio performance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create portfolio snapshot
router.post('/snapshot', async (req: Request, res: Response) => {
  try {
    const { accountId, totalValue, totalPnL, totalPnLPercentage, cashBalance, marginUsed, availableMargin } = req.body;

    // Verify account exists
    const account = await prisma.account.findFirst({
      where: {
        id: parseInt(accountId),
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const snapshot = await prisma.portfolioSnapshot.create({
      data: {
        totalValue,
        totalPnL,
        totalPnLPercentage,
        cashBalance,
        marginUsed,
        availableMargin,
        accountId: parseInt(accountId),
      },
    });

    res.status(201).json({
      message: 'Portfolio snapshot created successfully',
      snapshot,
    });
  } catch (error) {
    console.error('Create portfolio snapshot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get portfolio snapshots
router.get('/snapshots', async (req: Request, res: Response) => {
  try {
    const { accountId, limit = 50 } = req.query;

    const whereClause: any = {};

    if (accountId) {
      whereClause.accountId = parseInt(accountId as string);
    }

    const snapshots = await prisma.portfolioSnapshot.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    res.json({ snapshots });
  } catch (error) {
    console.error('Get portfolio snapshots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 