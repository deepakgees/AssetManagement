import express, { Request, Response, NextFunction } from 'express';
import { prisma } from '../index';
import logger from '../utils/logger';

const router = express.Router();

// Capture token from redirect with dynamic account name
router.get('/:accountName', async (req: Request, res: Response) => {
  console.log('=== CAPTURE TOKEN ROUTE CALLED ===');
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  console.log('Query:', req.query);
  console.log('Account Name:', req.params.accountName);
  console.log('==================================');
  
  try {
    const accountName = req.params.accountName;
    const { 
      action, 
      status, 
      request_token, 
      checksum, 
      error, 
      error_description
    } = req.query;

    logger.info('Token capture endpoint called', {
      action,
      status,
      hasRequestToken: !!request_token,
      hasChecksum: !!checksum,
      error,
      errorDescription: error_description,
      accountName,
      queryParams: req.query
    });

    // Handle error cases
    if (error) {
      logger.error('Token capture failed', {
        error,
        errorDescription: error_description,
        accountName
      });
      
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:7000';
      const redirectUrl = `${frontendUrl}/auth/callback?error=${encodeURIComponent(error as string)}&error_description=${encodeURIComponent(error_description as string || '')}&account_name=${encodeURIComponent(accountName)}`;
      
      return res.redirect(redirectUrl);
    }

    // Handle successful token capture
    if (request_token && status === 'success') {
      logger.info('Token captured successfully', {
        hasRequestToken: !!request_token,
        accountName
      });

      // Find and update the account with the request token by name
      try {
        // First find the account by name
        const account = await prisma.account.findFirst({
          where: { name: accountName }
        });
        
        if (!account) {
          logger.error('Account not found', { accountName });
          
          // If account not found, redirect with error
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:7000';
          const redirectUrl = `${frontendUrl}/auth/callback?error=account_not_found&error_description=${encodeURIComponent(`Account '${accountName}' not found`)}&account_name=${encodeURIComponent(accountName)}`;
          
          return res.redirect(redirectUrl);
        }
        
        // Update the account with the request token
        const updatedAccount = await prisma.account.update({
          where: { id: account.id },
          data: { 
            requestToken: request_token as string,
            updatedAt: new Date()
          }
        });
        
        logger.info('Account updated with request token', {
          accountId: updatedAccount.id,
          accountName,
          hasRequestToken: !!request_token
        });
      } catch (dbError) {
        logger.error('Failed to update account with request token', {
          accountName,
          error: {
            message: dbError.message,
            stack: dbError.stack
          }
        });
        
        // If any other error occurs, redirect with error
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:7000';
        const redirectUrl = `${frontendUrl}/auth/callback?error=update_failed&error_description=${encodeURIComponent('Failed to update account')}&account_name=${encodeURIComponent(accountName)}`;
        
        return res.redirect(redirectUrl);
      }

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:7000';
      const redirectUrl = `${frontendUrl}/auth/callback?status=success&request_token=${encodeURIComponent(request_token as string)}&account_name=${encodeURIComponent(accountName)}`;
      
      return res.redirect(redirectUrl);
    }

    // Handle other cases
    logger.warn('Token capture called with unexpected parameters', {
      queryParams: req.query,
      accountName
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:7000';
    const redirectUrl = `${frontendUrl}/auth/callback?status=unknown&account_name=${encodeURIComponent(accountName)}`;
    
    res.redirect(redirectUrl);

  } catch (error) {
    logger.error('Error in token capture endpoint', {
      error: {
        message: error.message,
        stack: error.stack,
      },
      queryParams: req.query,
      accountName: req.params.accountName
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:7000';
    const redirectUrl = `${frontendUrl}/auth/callback?error=internal_error&error_description=${encodeURIComponent('Internal server error')}&account_name=${encodeURIComponent(req.params.accountName)}`;
    
    res.redirect(redirectUrl);
  }
});



// Test route to verify mounting
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'CaptureToken routes are working', path: req.path });
});

export default router;
