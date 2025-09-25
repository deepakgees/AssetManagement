import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index';
import logger from '../utils/logger';
import { serviceLogger } from '../utils/serviceLogger';
import { KiteConnect } from 'kiteconnect';
import { generateSession, syncHoldings, syncPositions, initializeKiteConnect, setAccessToken, syncMargins } from '../../services/ZerodhaService';
import { generateTOTPWithInfo } from '../utils/totp-generator';
import zerodhaLoginBot from '../utils/zerodhaLoginBot';

const router = express.Router();

// Helper function to sync account data (holdings, positions, margins)
async function syncAccountData(account: any): Promise<{ success: boolean; error?: any }> {
 
  try {
    console.log(`🔄 Starting data sync for account: ${account.name} with request token: ${account.requestToken}`);
    logger.info(`Starting data sync for account: ${account.name} with request token: ${account.requestToken}`);

    // Initialize zerodha service with the tokens
    await initializeKiteConnect(account.apiKey, account.requestToken, account.apiSecret);
    
    // Sync holdings using ZerodhaService
    await syncHoldings(account);
    console.log(`✅ Holdings synced for account: ${account.name}`);

    // Sync positions using zerodha service
    await syncPositions(account);
    console.log(`✅ Positions synced for account: ${account.name}`);

    // Sync margins using zerodha service
    await syncMargins(account);
    console.log(`✅ Margins synced for account: ${account.name}`);

    // Update account's last sync time
    await prisma.account.update({
      where: { id: account.id },
      data: {
        lastSync: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Data sync completed for account: ${account.name}`);
    logger.info(`Data sync completed successfully for account: ${account.name}`);

    return { success: true };
  } catch (syncError: any) {
    console.error(`❌ Data sync failed for account: ${account.name}`, syncError);
    logger.error(`Data sync failed for account: ${account.name}`, {
      accountId: account.id,
      error: {
        message: syncError.message,
        stack: syncError.stack,
      },
    });
    return { success: false, error: syncError };
  }

}

// Validation middleware
const validateAccount = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('family').optional().trim(),
  body('apiKey').optional().trim(),
  body('apiSecret').optional().trim(),
  body('requestToken').optional().trim(),
  body('totpSecret').optional().trim(),
  body('userId').optional().trim(),
  body('password').optional().trim(),
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

    const { name, family, apiKey, apiSecret, requestToken, description, totpSecret, userId, password } = req.body;
    
    logger.info('Creating new account', {
      name,
      family,
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      hasRequestToken: !!requestToken,
      hasDescription: !!description,
      hasTotpSecret: !!totpSecret,
      hasUserId: !!userId,
      hasPassword: !!password,
    });

    const account = await prisma.account.create({
      data: {
        name,
        family,
        apiKey,
        apiSecret,
        requestToken,
        description,
        totpSecret,
        userId,
        password,
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

    const { name, family, apiKey, apiSecret, requestToken, description, totpSecret, userId, password } = req.body;
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
        family,
        apiKey,
        apiSecret,
        requestToken,
        description,
        totpSecret,
        userId,
        password,
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

    // Use the reusable sync function
    const syncResult = await syncAccountData(existingAccount);
    
    if (!syncResult.success) {
      const authError = syncResult.error;
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

    res.json({
      message: 'Account synced successfully'
    });
  } catch (error) {
    console.error('Sync account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync all accounts
router.post('/sync-all', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Sync All button clicked - Starting sync all accounts process');
    logger.info('Starting sync all accounts process');
    
    // Get all active accounts
    const accounts = await prisma.account.findMany({
      where: {
        isActive: true,
      },
    });

    if (accounts.length === 0) {
      logger.info('No active accounts found for sync');
      return res.json({
        message: 'No active accounts found to sync',
        syncedAccounts: 0,
        failedAccounts: 0,
      });
    }

    let syncedAccounts = 0;
    let failedAccounts = 0;
    const results = [];

    logger.info(`Found ${accounts.length} active accounts to sync`);
    console.log(`🚀 Starting sequential sync for ${accounts.length} accounts...`);

    // Process each account sequentially
    for (const account of accounts) {
      try {
        logger.info(`Syncing account: ${account.name} (ID: ${account.id})`);
        
        // Check if account has required credentials
        if (!account.apiKey || !account.apiSecret) {
          logger.warn(`Account ${account.name} missing credentials, skipping`);
          results.push({
            accountId: account.id,
            accountName: account.name,
            status: 'skipped',
            message: 'Missing API credentials',
          });
          failedAccounts++;
          continue;
        }

        if (!account.requestToken) {
          logger.warn(`Account ${account.name} missing request token, skipping`);
          results.push({
            accountId: account.id,
            accountName: account.name,
            status: 'skipped',
            message: 'Missing request token - please complete login flow',
          });
          failedAccounts++;
          continue;
        }


        // Check if account has TOTP secret configured
        if (!account.totpSecret) {
          logger.warn(`Account ${account.name} missing TOTP secret, skipping`);
          results.push({
            accountId: account.id,
            accountName: account.name,
            status: 'skipped',
            message: 'Missing TOTP secret - please configure TOTP secret for this account',
          });
          failedAccounts++;
          continue;
        }

        // Generate TOTP for account using the stored secret
        const totpInfo = generateTOTPWithInfo(account.totpSecret);

        console.log(`🔄 Starting login process for account: ${account.name} (${syncedAccounts + failedAccounts + 1}/${accounts.length})`);
        logger.info(`Starting login process for account: ${account.name} (${syncedAccounts + failedAccounts + 1}/${accounts.length})`);

        // Use account's API credentials for login bot - this will now wait for completion
        const loginResult = await zerodhaLoginBot(account.apiKey!, account.apiSecret!, account.userId || account.name, account.password || '', totpInfo.totp);
        console.log(`✅ Login completed successfully for account: ${account.name}`);
        logger.info(`Login completed successfully for account: ${account.name}`, {
          accountId: account.id,
          requestToken: loginResult.requestToken ? 'received' : 'not received',
          accessToken: loginResult.accessToken ? 'received' : 'not received'
        });

        //update account object with new requestToken
        account.requestToken = loginResult.requestToken;

        // Update account with new tokens if received
        if (loginResult.requestToken) {
          await prisma.account.update({
            where: { id: account.id },
            data: {
              requestToken: loginResult.requestToken,
              updatedAt: new Date(),
            },
          });
          console.log(`📝 Updated request token for account: ${account.name}`);
        }

        console.log(`⏳ Waiting 5 seconds before synching account...`);
        //await new Promise(resolve => setTimeout(resolve, 5000));

        // Now sync the account data using the reusable sync function
        const syncResult = await syncAccountData(account);
                
        results.push({
          accountId: account.id,
          accountName: account.name,
          status: 'success',
          message: 'Login and data sync completed successfully',
        });
        syncedAccounts++;

        // Add a small delay between accounts to ensure browser cleanup
        if (syncedAccounts + failedAccounts < accounts.length) {
          console.log(`⏳ Waiting 2 seconds before processing next account...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (accountError: any) {
        logger.error(`Failed to sync account ${account.name}`, {
          accountId: account.id,
          error: {
            message: accountError.message,
            stack: accountError.stack,
          },
        });

        results.push({
          accountId: account.id,
          accountName: account.name,
          status: 'failed',
          message: accountError.message || 'Unknown error occurred',
        });
        failedAccounts++;
      }
    }

    logger.info(`Sync all completed: ${syncedAccounts} successful, ${failedAccounts} failed`);

    res.json({
      message: `Sync all completed: ${syncedAccounts} successful, ${failedAccounts} failed`,
      syncedAccounts,
      failedAccounts,
      results,
    });

  } catch (error: any) {
    logger.error('Error in sync all accounts', {
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to sync all accounts',
    });
  }
});

export default router; 