# Backend Debugging Guide

## Option 1: VS Code Debugger (Recommended for Line-by-Line Debugging)

### Setup
1. Open VS Code in the project root
2. Go to the Debug panel (Ctrl+Shift+D)
3. Select "Debug Backend" from the dropdown
4. Set breakpoints in your code by clicking on the line numbers

### How to Debug accounts.ts
1. Open `backend/src/routes/accounts.ts`
2. Set breakpoints by clicking on the line numbers (red dots will appear)
3. Press F5 or click the green play button in the Debug panel
4. The debugger will stop at your breakpoints
5. Use F10 to step over, F11 to step into, Shift+F11 to step out

### Debug Controls
- **F5**: Continue execution
- **F10**: Step over (execute current line, move to next)
- **F11**: Step into (go into function calls)
- **Shift+F11**: Step out (exit current function)
- **F9**: Toggle breakpoint

## Option 2: Command Line Debugging

### Start with debugger attached
```bash
cd backend
npm run debug
```

### Start with debugger paused on first line
```bash
cd backend
npm run debug-brk
```

### Connect to Chrome DevTools
1. Run `npm run debug`
2. Open Chrome and go to `chrome://inspect`
3. Click "Open dedicated DevTools for Node"
4. Set breakpoints in the DevTools

## Option 3: Console Debugging

Add debug statements to your code:

```typescript
// In accounts.ts
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Debug: Starting to fetch accounts');
    logger.info('Fetching all accounts');
    
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: 'desc' },
    });

    console.log('🔍 Debug: Retrieved accounts:', accounts.length);
    logger.info(`Retrieved ${accounts.length} accounts`);
    res.json({ accounts });
  } catch (error) {
    console.error('🔍 Debug: Error details:', error);
    logger.error('Error fetching accounts', {
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Option 4: Logging Debug

Use the existing logger with debug level:

```typescript
// In accounts.ts
router.post('/:id/sync', async (req: Request, res: Response) => {
  logger.debug('🔍 Starting sync process', { accountId: req.params.id });
  
  try {
    const accountId = parseInt(req.params.id);
    logger.debug('🔍 Parsed account ID', { accountId });
    
    const existingAccount = await prisma.account.findFirst({
      where: { id: accountId },
    });
    
    logger.debug('🔍 Found account', { 
      accountExists: !!existingAccount,
      accountName: existingAccount?.name 
    });
    
    // ... rest of the code
  } catch (error) {
    logger.debug('🔍 Sync error', { error: error.message });
    // ... error handling
  }
});
```

## Debugging Specific Scenarios

### Debugging Account Creation
1. Set breakpoint in `router.post('/', validateAccount, async (req: Request, res: Response) => {`
2. Use Postman or curl to send a POST request to `/api/accounts`
3. Step through validation, database creation, and response

### Debugging Token Exchange
1. Set breakpoint in `router.post('/:id/exchange-token', async (req: Request, res: Response) => {`
2. Step through the Zerodha service calls
3. Check the `result` object after token exchange

### Debugging Account Sync
1. Set breakpoint in `router.post('/:id/sync', async (req: Request, res: Response) => {`
2. Step through holdings and positions fetching
3. Check database operations

## Environment Variables for Debugging

Create a `.env.debug` file:
```env
NODE_ENV=development
DEBUG=*
LOG_LEVEL=debug
```

## Useful Debug Commands

```bash
# Start with debug logging
LOG_LEVEL=debug npm run dev

# Start with all debug info
DEBUG=* npm run dev

# Start with specific debug modules
DEBUG=express:* npm run dev
```

## Chrome DevTools Integration

1. Start the debugger: `npm run debug`
2. Open Chrome DevTools (F12)
3. Go to Sources tab
4. Find your TypeScript files under the file tree
5. Set breakpoints directly in Chrome DevTools

## Tips for Effective Debugging

1. **Set breakpoints strategically**: At the start of functions, before database calls, after API responses
2. **Use conditional breakpoints**: Right-click on a breakpoint to set conditions
3. **Watch variables**: Use the Watch panel to monitor specific variables
4. **Check call stack**: Use the Call Stack panel to understand the execution flow
5. **Use console.log strategically**: For quick debugging without stopping execution

## Common Debugging Scenarios

### Database Connection Issues
```typescript
// Add to your route handlers
logger.debug('🔍 Database connection status', { 
  prismaConnected: !!prisma 
});
```

### API Response Debugging
```typescript
// In your route handlers
logger.debug('🔍 API Response', { 
  statusCode: res.statusCode,
  responseData: res.locals.responseData 
});
```

### Request Validation Debugging
```typescript
// In validation middleware
logger.debug('🔍 Request validation', { 
  body: req.body,
  validationErrors: errors.array() 
});
```
