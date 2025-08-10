# Debug Troubleshooting Guide

## Common Issues and Solutions

### 1. Breakpoints Not Hitting

**Possible Causes:**
- Source maps not working properly
- Wrong file path in launch configuration
- TypeScript compilation issues
- Debugger not attached properly

**Solutions:**

#### Check Source Maps
```bash
cd backend
npm run build
```
This should generate `.js.map` files in the `dist` folder.

#### Verify Launch Configuration
Make sure your `.vscode/launch.json` has:
- `"sourceMaps": true`
- Correct `"program"` path
- `"runtimeArgs": ["-r", "ts-node/register"]`

#### Alternative Launch Configuration
If the above doesn't work, try this simpler configuration:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend (Simple)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/src/index.ts",
      "cwd": "${workspaceFolder}/backend",
      "runtimeArgs": ["-r", "ts-node/register"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"],
      "sourceMaps": true
    }
  ]
}
```

### 2. Debug Console Not Working

**Solution:**
- Make sure you're using "Debug Backend" configuration
- Check that `"console": "integratedTerminal"` is set
- Restart VS Code if needed

### 3. TypeScript Files Not Found

**Solution:**
- Make sure you're setting breakpoints in the TypeScript files (`.ts`), not compiled JavaScript
- Check that the file path in the debugger matches your actual file structure

### 4. Debugger Not Starting

**Solutions:**
1. Check if port 7001 is already in use:
   ```bash
   netstat -ano | findstr :7001
   ```

2. Kill any existing Node processes:
   ```bash
   taskkill /F /IM node.exe
   ```

3. Try the attach configuration instead:
   ```bash
   cd backend
   npm run debug
   ```
   Then use "Debug Backend (Attach)" configuration

### 5. Breakpoints in Specific Routes Not Hitting

**For accounts.ts line 261 (exchange-token route):**

1. **Test the route first:**
   ```bash
   curl -X POST http://localhost:7001/api/accounts/1/exchange-token \
     -H "Content-Type: application/json" \
     -d '{"requestToken": "test"}'
   ```

2. **Add console.log to verify the route is being hit:**
   ```typescript
   router.post('/:id/exchange-token', async (req: Request, res: Response) => {
     console.log('🔍 DEBUG: Exchange token route hit!');
     // ... rest of the code
   ```

3. **Check if the route is properly registered:**
   - Verify the route is exported correctly
   - Check that the route is imported in `index.ts`

### 6. Alternative Debugging Methods

#### Method 1: Console Debugging
Add this to your route:
```typescript
router.post('/:id/exchange-token', async (req: Request, res: Response) => {
  console.log('🔍 DEBUG: Starting exchange token process');
  console.log('🔍 DEBUG: req.params:', req.params);
  console.log('🔍 DEBUG: req.body:', req.body);
  
  try {
    const accountId = parseInt(req.params.id);
    console.log('🔍 DEBUG: accountId:', accountId);
    // ... rest of your code
```

#### Method 2: Chrome DevTools
1. Start the debugger: `npm run debug`
2. Open Chrome → `chrome://inspect`
3. Click "Open dedicated DevTools for Node"
4. Set breakpoints in the DevTools

#### Method 3: Command Line Debugging
```bash
cd backend
node --inspect-brk --require ts-node/register src/index.ts
```

### 7. Verify Your Setup

#### Step 1: Check Dependencies
```bash
cd backend
npm list ts-node
npm list typescript
```

#### Step 2: Test TypeScript Compilation
```bash
cd backend
npx tsc --noEmit
```

#### Step 3: Test ts-node
```bash
cd backend
npx ts-node --version
```

### 8. Debug Configuration Testing

Create a simple test file to verify debugging works:

```typescript
// backend/test-debug.ts
console.log('Debug test starting...');

function testFunction() {
  console.log('Inside test function');
  return 'test result';
}

const result = testFunction();
console.log('Result:', result);
```

Then add this to your launch.json:
```json
{
  "name": "Test Debug",
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/backend/test-debug.ts",
  "cwd": "${workspaceFolder}/backend",
  "runtimeArgs": ["-r", "ts-node/register"],
  "console": "integratedTerminal"
}
```

### 9. Environment Issues

#### Windows Specific
- Make sure you're using Git Bash or WSL if on Windows
- Check file permissions
- Try running VS Code as administrator

#### Path Issues
- Verify your workspace folder structure
- Check that the `backend` folder is at the root of your workspace

### 10. Quick Fixes

1. **Restart VS Code**
2. **Clear VS Code cache**: Delete `.vscode` folder and recreate
3. **Reinstall dependencies**:
   ```bash
   cd backend
   rm -rf node_modules package-lock.json
   npm install
   ```
4. **Update ts-node**:
   ```bash
   cd backend
   npm install ts-node@latest
   ```

### 11. Testing Your Breakpoint

To test if line 261 breakpoint works:

1. Set breakpoint at line 261 in `accounts.ts`
2. Start debugging with "Debug Backend"
3. Make a request to trigger the route:
   ```bash
   curl -X POST http://localhost:7001/api/accounts/1/exchange-token \
     -H "Content-Type: application/json" \
     -d '{"requestToken": "test"}'
   ```
4. The debugger should pause at your breakpoint

If it still doesn't work, try setting breakpoints at:
- Line 259: `router.post('/:id/exchange-token', async (req: Request, res: Response) => {`
- Line 260: `try {`
- Line 261: `const accountId = parseInt(req.params.id);`
