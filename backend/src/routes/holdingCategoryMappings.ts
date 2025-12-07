import express, { Request, Response } from 'express';
import { prisma } from '../index';

const router = express.Router();

// Get all category mappings
router.get('/', async (req: Request, res: Response) => {
  try {
    const mappings = await prisma.holdingCategoryMapping.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({ mappings });
  } catch (error) {
    console.error('Get category mappings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update category mapping
router.post('/', async (req: Request, res: Response) => {
  try {
    const { tradingSymbol, holdingType, category } = req.body;

    if (!tradingSymbol || !holdingType || !category) {
      return res.status(400).json({ error: 'tradingSymbol, holdingType, and category are required' });
    }

    const validCategories = ['equity', 'liquid_fund', 'gold', 'silver'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${validCategories.join(', ')}` });
    }

    const validHoldingTypes = ['equity', 'mutual_fund'];
    if (!validHoldingTypes.includes(holdingType)) {
      return res.status(400).json({ error: `holdingType must be one of: ${validHoldingTypes.join(', ')}` });
    }

    const mapping = await prisma.holdingCategoryMapping.upsert({
      where: {
        unique_holding_category: {
          tradingSymbol,
          holdingType,
        },
      },
      update: {
        category,
        updatedAt: new Date(),
      },
      create: {
        tradingSymbol,
        holdingType,
        category,
      },
    });

    res.json({ mapping });
  } catch (error) {
    console.error('Create/update category mapping error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete category mapping
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    await prisma.holdingCategoryMapping.delete({
      where: { id },
    });

    res.json({ message: 'Category mapping deleted successfully' });
  } catch (error) {
    console.error('Delete category mapping error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

