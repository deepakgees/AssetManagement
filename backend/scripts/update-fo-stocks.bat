@echo off
echo Updating NSE F&O stocks in database...
echo.

echo Running static F&O stocks population...
npx ts-node scripts/fetch-and-populate-fo-stocks.ts

echo.
echo F&O stocks update completed!
echo.
pause
