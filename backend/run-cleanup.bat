@echo off
echo Starting duplicate cleanup process...
echo.

cd /d "%~dp0"
node scripts/cleanup-duplicates.js

echo.
echo Cleanup completed. Press any key to exit.
pause >nul
