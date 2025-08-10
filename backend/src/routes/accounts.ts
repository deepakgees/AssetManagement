import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index';
import logger from '../utils/logger';
import { serviceLogger } from '../utils/serviceLogger';
import { KiteConnect } from 'kiteconnect';
import { generateSession, syncHoldings, syncPositions, initializeKiteConnect, setAccessToken } from '../../services/ZerodhaService';

const router = express.Router();

// Validation middleware
const validateAccount = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('apiKey').optional().trim(),
  body('apiSecret').optional().trim(),
  body('requestToken').optional().trim(),
];

// Get all accounts
router.get('/', async (req: Request, res: Response) => {
  try {
    logger.info('Fetching all accounts');
    
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: 'desc' },
    });

    logger.info(`Retrieved ${accounts.length} accounts`);
    res.json({ accounts });
  } catch (error) {
          logger.error('Error fetching accounts', {
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single account
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id);
    logger.info(`Fetching account with ID: ${accountId}`);
    
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
      },
    });

    if (!account) {
      logger.warn(`Account not found with ID: ${accountId}`);
      return res.status(404).json({ error: 'Account not found' });
    }

          logger.info(`Retrieved account: ${account.name} (ID: ${accountId})`);
    res.json({ account });
  } catch (error) {
          logger.error('Error fetching account', {
      accountId: req.params.id,
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new account
router.post('/', validateAccount, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
          logger.warn('Account creation validation failed', {
      errors: errors.array(),
    });
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, apiKey, apiSecret, requestToken, description } = req.body;
    
    logger.info('Creating new account', {
      name,
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      hasRequestToken: !!requestToken,
      hasDescription: !!description,
    });

    const account = await prisma.account.create({
      data: {
        name,
        apiKey,
        apiSecret,
        requestToken,
        description,
      },
    });

          logger.info(`Account created successfully: ${account.name} (ID: ${account.id})`);
    res.status(201).json({
      message: 'Account created successfully',
      account,
    });
  } catch (error) {
          logger.error('Error creating account', {
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update account
router.put('/:id', validateAccount, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, apiKey, apiSecret, requestToken, description } = req.body;
    const accountId = parseInt(req.params.id);

    // Check if account exists
    const existingAccount = await prisma.account.findFirst({
      where: {
        id: accountId,
      },
    });

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const updatedAccount = await prisma.account.update({
      where: { id: accountId },
      data: {
        name,
        apiKey,
        apiSecret,
        requestToken,
        description,
        updatedAt: new Date(),
      },
    });

    res.json({
      message: 'Account updated successfully',
      account: updatedAccount,
    });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete account
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id);

    // Check if account exists
    const existingAccount = await prisma.account.findFirst({
      where: {
        id: accountId,
      },
    });

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await prisma.account.delete({
      where: { id: accountId },
    });

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle account status
router.patch('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id);

    // Check if account exists
    const existingAccount = await prisma.account.findFirst({
      where: {
        id: accountId,
      },
    });

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const updatedAccount = await prisma.account.update({
      where: { id: accountId },
      data: {
        isActive: !existingAccount.isActive,
        updatedAt: new Date(),
      },
    });

    res.json({
      message: `Account ${updatedAccount.isActive ? 'activated' : 'deactivated'} successfully`,
      account: updatedAccount,
    });
  } catch (error) {
    console.error('Toggle account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get login URL for account
router.get('/:id/login-url', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id);

    // Check if account exists
    const existingAccount = await prisma.account.findFirst({
      where: {
        id: accountId,
      },
    });

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!existingAccount.apiKey) {
      return res.status(400).json({ 
        error: 'API key not configured', 
        message: 'Please configure API key for this account' 
      });
    }

    const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${existingAccount.apiKey}`;
    
    res.json({
      loginUrl,
      message: 'Login URL generated successfully'
    });
  } catch (error) {
    console.error('Get login URL error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Sync account data (holdings and positions) using ZerodhaService pattern
router.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id);

    // Check if account exists
    const existingAccount = await prisma.account.findFirst({
      where: {
        id: accountId,
      },
    });

    if (!existingAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (!existingAccount.apiKey || !existingAccount.apiSecret) {
      return res.status(400).json({ 
        error: 'Account credentials not configured', 
        message: 'Please configure API key and API secret for this account. Use the login flow to get a valid access token.' 
      });
    }

    // Get access token from request body or exchange request token
    let accessToken = req.body.accessToken;
    
    if (!accessToken) {
      // If no access token provided, try to exchange request token
      if (!existingAccount.requestToken) {
        return res.status(400).json({ 
          error: 'Authentication required', 
          message: 'Please provide an access token or complete the login flow to get a request token.' 
        });
      }      
    }

    try {
      // Initialize zerodha service with proper await
      await initializeKiteConnect(existingAccount.apiKey, existingAccount.requestToken, existingAccount.apiSecret);
      
      console.log('Zerodha session initialized successfully, starting data sync...');

      // Sync holdings using ZerodhaService
      await syncHoldings(existingAccount);

      // Sync positions using zerodha service
      await syncPositions(existingAccount);
      
      console.log('Data sync completed successfully');
      
    } catch (authError: any) {
      console.error('Authentication/Sync error:', authError);
      
      // Handle specific token expiration errors
      if (authError.message?.includes('Token is invalid') || 
          authError.message?.includes('expired') ||
          authError.error_type === 'TokenException') {
        return res.status(401).json({ 
          error: 'Authentication failed', 
          message: 'Token is invalid or has expired. Please login again to get a new request token.',
          error_type: 'TokenException',
          loginUrl: `https://kite.zerodha.com/connect/login?v=3&api_key=${existingAccount.apiKey}`
        });
      }
      
      // Handle other authentication errors
      if (authError.message?.includes('Invalid') || 
          authError.message?.includes('api_key') || 
          authError.message?.includes('access_token')) {
        return res.status(401).json({ 
          error: 'Authentication failed', 
          message: 'Invalid API credentials. Please check your API key and secret.',
          error_type: 'AuthenticationError'
        });
      }
      
      // Re-throw other errors to be handled by outer catch
      throw authError;
    }


    // Update account's last sync time
    await prisma.account.update({
      where: { id: accountId },
      data: {
        lastSync: new Date(),
        updatedAt: new Date(),
      },
    });

    res.json({
      message: 'Account synced successfully'
    });
  } catch (error) {
    console.error('Sync account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 