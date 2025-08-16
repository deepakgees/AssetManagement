@echo off
echo Starting Asset Management App...

echo Starting Backend...
cd backend
start /B npm run dev
cd ..

echo Starting Frontend...
cd frontend
start /B npm run start
cd ..

echo Both applications are starting in the background.
echo Backend should be available at: http://localhost:7001
echo Frontend should be available at: http://localhost:7000
echo.
echo Press any key to exit this window...
pause >nul
