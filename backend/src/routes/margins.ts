import { Request, Response, Router } from 'express';
import { prisma } from '../index';
import { syncMargins } from '../../services/ZerodhaService';

const router = Router();

// Get all margins
router.get('/', async (req: Request, res: Response) => {
  try {
    const margins = await prisma.margin.findMany({
      include: {
        account: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(margins);
  } catch (error) {
    console.error('Error fetching margins:', error);
    res.status(500).json({ error: 'Failed to fetch margins' });
  }
});

// Get margins by account ID
router.get('/account/:accountId', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId);
    
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const margins = await prisma.margin.findFirst({
      where: { accountId },
      include: {
        account: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!margins) {
      return res.status(404).json({ error: 'Margins not found for this account' });
    }

    res.json(margins);
  } catch (error) {
    console.error('Error fetching margins for account:', error);
    res.status(500).json({ error: 'Failed to fetch margins for account' });
  }
});

// Sync margins for a specific account
router.post('/sync/:accountId', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId);
    
    if (isNaN(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    // Get account details
    const account = await prisma.account.findFirst({
      where: { id: accountId },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!account.apiKey || !account.requestToken || !account.apiSecret) {
      return res.status(400).json({ error: 'Account API credentials not configured' });
    }

    // Sync margins using ZerodhaService
    const margins = await syncMargins(account);
    
    // Get the updated margin data from database
    const updatedMargin = await prisma.margin.findFirst({
      where: { accountId },
      include: {
        account: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      message: 'Margins synced successfully',
      margins: updatedMargin,
    });
  } catch (error: any) {
    console.error('Error syncing margins:', error);
    res.status(500).json({ 
      error: 'Failed to sync margins',
      details: error.message 
    });
  }
});

// Get margins summary (latest margins for all accounts)
router.get('/summary', async (req: Request, res: Response) => {
  try {
    // Get the latest margin data for each account
    const marginsSummary = await prisma.margin.findMany({
      include: {
        account: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group by account and get the latest for each
    const latestMargins = marginsSummary.reduce((acc: any[], margin) => {
      const existingIndex = acc.findIndex(m => m.accountId === margin.accountId);
      if (existingIndex === -1) {
        acc.push(margin);
      }
      return acc;
    }, []);

    res.json(latestMargins);
  } catch (error) {
    console.error('Error fetching margins summary:', error);
    res.status(500).json({ error: 'Failed to fetch margins summary' });
  }
});

export default router;
