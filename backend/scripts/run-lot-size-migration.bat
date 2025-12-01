@echo off
echo Starting Lot Size Column Migration...
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js and try again
    pause
    exit /b 1
)

REM Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo Error: npm is not installed or not in PATH
    echo Please install npm and try again
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

echo Step 1: Adding lot_size column to symbol_margins table...
npx ts-node scripts/add-lot-size-migration.ts

if errorlevel 1 (
    echo.
    echo Migration failed! Check the error messages above.
    pause
    exit /b 1
)

echo.
echo Step 2: Generating Prisma client...
npx prisma generate

if errorlevel 1 (
    echo.
    echo Prisma generate failed! Check the error messages above.
    pause
    exit /b 1
)

echo.
echo Step 3: Populating lot sizes for existing symbols...
npx ts-node scripts/populate-lot-sizes.ts

if errorlevel 1 (
    echo.
    echo Lot size population failed! Check the error messages above.
    echo You can run the population script again later.
    pause
    exit /b 1
)

echo.
echo Migration completed successfully!
echo.
echo Next steps:
echo 1. Restart your backend server
echo 2. The lot_size field is now available in the symbol_margins table
echo.
pause

