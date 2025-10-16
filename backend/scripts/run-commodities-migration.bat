@echo off
echo Running commodities schema migration...
echo.

REM Check if DATABASE_URL is set
if "%DATABASE_URL%"=="" (
    echo Error: DATABASE_URL environment variable is not set
    echo Please set it in your .env file or environment
    pause
    exit /b 1
)

REM Run the migration script
echo Executing migration script...
psql "%DATABASE_URL%" -f migrate-commodities-schema.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Migration completed successfully!
    echo.
    echo Next steps:
    echo 1. Run 'npx prisma generate' to update the Prisma client
    echo 2. Restart your backend server
    echo 3. Verify the migration was successful
    echo 4. Drop the backup table when ready: DROP TABLE historical_price_commodities_backup;
) else (
    echo.
    echo Migration failed! Please check the error messages above.
    echo The backup table 'historical_price_commodities_backup' was created before the migration.
)

echo.
pause
