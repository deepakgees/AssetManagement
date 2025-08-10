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

// Get holdings summary
router.get('/summary', async (req: Request, res: Response) => {
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
    });

    // Calculate summary
    const totalMarketValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const totalPnL = holdings.reduce((sum, h) => sum + h.pnl, 0);
    const totalInvestment = holdings.reduce((sum, h) => sum + (h.averagePrice * h.quantity), 0);
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

    res.json({
      summary: {
        totalHoldings: holdings.length,
        totalMarketValue,
        totalPnL,
        totalPnLPercentage,
        totalInvestment,
      },
      sectorBreakdown,
      holdings,
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
    const { tradingSymbol, quantity, averagePrice, lastPrice, exchange, sector, accountId } = req.body;

    // Verify account exists
    const account = await prisma.account.findFirst({
      where: {
        id: parseInt(accountId),
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const marketValue = quantity * lastPrice;
    const pnl = marketValue - (quantity * averagePrice);
    const pnlPercentage = (quantity * averagePrice) > 0 ? (pnl / (quantity * averagePrice)) * 100 : 0;

    const holding = await prisma.holding.create({
      data: {
        tradingSymbol,
        quantity,
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
    const { tradingSymbol, quantity, averagePrice, lastPrice, exchange, sector } = req.body;
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

    const marketValue = quantity * lastPrice;
    const pnl = marketValue - (quantity * averagePrice);
    const pnlPercentage = (quantity * averagePrice) > 0 ? (pnl / (quantity * averagePrice)) * 100 : 0;

    const updatedHolding = await prisma.holding.update({
      where: { id: holdingId },
      data: {
        tradingSymbol,
        quantity,
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