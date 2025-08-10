import express, { Request, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { KiteConnect } from 'kiteconnect';

const router = express.Router();

// Get real-time positions from Zerodha
router.get('/live/:accountId', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId);
    
    // Get account credentials
    const account = await prisma.account.findFirst({
      where: { id: accountId },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!account.apiKey || !account.apiSecret) {
      return res.status(400).json({ 
        error: 'Account credentials not configured',
        message: 'Please configure API key and API secret for this account'
      });
    }

    // Get access token from request body
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ 
        error: 'Access token required', 
        message: 'Please provide the access token obtained from the login flow.' 
      });
    }

    // Initialize KiteConnect instance using ZerodhaService pattern
    const kc = new KiteConnect({ api_key: account.apiKey });
    kc.setAccessToken(accessToken);
    
    // Fetch real-time positions from Zerodha using ZerodhaService pattern
    try {
      const positions = await kc.getPositions();
      const result = {
        success: true,
        data: positions.net.map((position: any) => ({
          tradingSymbol: position.tradingsymbol,
          exchange: position.exchange,
          quantity: position.quantity,
          averagePrice: position.average_price,
          lastPrice: position.last_price,
          marketValue: position.last_price * Math.abs(position.quantity),
          pnl: position.unrealised,
          pnlPercentage: position.average_price > 0 ? 
            ((position.last_price - position.average_price) / position.average_price) * 100 : 0,
          instrumentToken: position.instrument_token,
          product: position.product,
          dayBuyQuantity: position.day_buy_quantity,
          daySellQuantity: position.day_sell_quantity,
          dayBuyValue: position.day_buy_value,
          daySellValue: position.day_sell_value,
          accountId: accountId
        })),
        summary: {
          totalPositions: positions.net.length,
          totalMarketValue: positions.net.reduce((sum, p) => sum + (p.last_price * Math.abs(p.quantity)), 0),
          totalPnL: positions.net.reduce((sum, p) => sum + p.unrealised, 0),
          longPositions: positions.net.filter(p => p.quantity > 0).length,
          shortPositions: positions.net.filter(p => p.quantity < 0).length
        }
      };
      
      // Transform the data to match our frontend expectations
      const transformedPositions = result.data.map((position: any) => ({
        id: position.instrumentToken, // Use instrument token as ID
        tradingSymbol: position.tradingSymbol,
        quantity: Math.abs(position.quantity),
        averagePrice: position.averagePrice,
        lastPrice: position.lastPrice,
        marketValue: position.marketValue,
        pnl: position.pnl,
        pnlPercentage: position.pnlPercentage,
        exchange: position.exchange,
        product: position.product,
        side: position.quantity > 0 ? 'BUY' : 'SELL',
        accountId: accountId,
        account: {
          id: accountId,
          name: account.name,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      res.json({ 
        positions: transformedPositions,
        summary: result.summary,
        source: 'zerodha',
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Get live positions error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch positions from Zerodha',
        message: error.response?.data?.message || error.message 
      });
    }
  } catch (error) {
    console.error('Get live positions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all positions
router.get('/', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;

    const whereClause: any = {};

    if (accountId) {
      whereClause.accountId = parseInt(accountId as string);
    }

    const positions = await prisma.position.findMany({
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

    res.json({ positions });
  } catch (error) {
    console.error('Get positions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get positions summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;

    const whereClause: any = {};

    if (accountId) {
      whereClause.accountId = parseInt(accountId as string);
    }

    const positions = await prisma.position.findMany({
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
    const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
    const totalInvestment = positions.reduce((sum, p) => sum + (p.averagePrice * p.quantity), 0);
    const totalPnLPercentage = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

    // Group by product type
    const productBreakdown = positions.reduce((acc, position) => {
      const product = position.product || 'Others';
      if (!acc[product]) {
        acc[product] = { value: 0, count: 0 };
      }
      acc[product].value += position.marketValue;
      acc[product].count += 1;
      return acc;
    }, {} as Record<string, { value: number; count: number }>);

    // Group by side (BUY/SELL)
    const sideBreakdown = positions.reduce((acc, position) => {
      const side = position.side || 'Others';
      if (!acc[side]) {
        acc[side] = { value: 0, count: 0 };
      }
      acc[side].value += position.marketValue;
      acc[side].count += 1;
      return acc;
    }, {} as Record<string, { value: number; count: number }>);

    res.json({
      summary: {
        totalPositions: positions.length,
        totalMarketValue,
        totalPnL,
        totalPnLPercentage,
        totalInvestment,
      },
      productBreakdown,
      sideBreakdown,
      positions,
    });
  } catch (error) {
    console.error('Get positions summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single position
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const position = await prisma.position.findFirst({
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

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    res.json({ position });
  } catch (error) {
    console.error('Get position error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new position (for testing/demo purposes)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { tradingSymbol, quantity, averagePrice, lastPrice, exchange, product, side, accountId } = req.body;

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

    const position = await prisma.position.create({
      data: {
        tradingSymbol,
        quantity,
        averagePrice,
        lastPrice,
        marketValue,
        pnl,
        pnlPercentage,
        exchange,
        product,
        side,
        accountId: parseInt(accountId),
      },
    });

    res.status(201).json({
      message: 'Position created successfully',
      position,
    });
  } catch (error) {
    console.error('Create position error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update position
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { tradingSymbol, quantity, averagePrice, lastPrice, exchange, product, side } = req.body;
    const positionId = parseInt(req.params.id);

    // Check if position exists
    const existingPosition = await prisma.position.findFirst({
      where: {
        id: positionId,
      },
    });

    if (!existingPosition) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const marketValue = quantity * lastPrice;
    const pnl = marketValue - (quantity * averagePrice);
    const pnlPercentage = (quantity * averagePrice) > 0 ? (pnl / (quantity * averagePrice)) * 100 : 0;

    const updatedPosition = await prisma.position.update({
      where: { id: positionId },
      data: {
        tradingSymbol,
        quantity,
        averagePrice,
        lastPrice,
        marketValue,
        pnl,
        pnlPercentage,
        exchange,
        product,
        side,
        updatedAt: new Date(),
      },
    });

    res.json({
      message: 'Position updated successfully',
      position: updatedPosition,
    });
  } catch (error) {
    console.error('Update position error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete position
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const positionId = parseInt(req.params.id);

    // Check if position exists
    const existingPosition = await prisma.position.findFirst({
      where: {
        id: positionId,
      },
    });

    if (!existingPosition) {
      return res.status(404).json({ error: 'Position not found' });
    }

    await prisma.position.delete({
      where: { id: positionId },
    });

    res.json({ message: 'Position deleted successfully' });
  } catch (error) {
    console.error('Delete position error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 