@echo off
setlocal enabledelayedexpansion

REM Check if port number is provided, default to killing both frontend and backend
if "%~1"=="" (
    echo Killing AssetManagement Frontend - port 7000 and Backend - port 7001...
    set FRONTEND_PORT=7000
    set BACKEND_PORT=7001
    goto :kill_both
)

set PORT=%1

REM Check if user wants to kill both frontend and backend
if /i "%1"=="both" (
    echo Killing AssetManagement Frontend - port 7000 and Backend - port 7001...
    set FRONTEND_PORT=7000
    set BACKEND_PORT=7001
    goto :kill_both
)

echo Searching for processes using port %PORT%...

REM Find processes using the specified port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% "') do (
    set PID=%%a
    if not "!PID!"=="0" (
        echo Found process with PID !PID! using port %PORT%
        
        REM Get process name for confirmation
        for /f "tokens=1" %%b in ('tasklist /fi "PID eq !PID!" /fo csv ^| findstr /v "PID"') do (
            set PROCESS_NAME=%%b
            set PROCESS_NAME=!PROCESS_NAME:"=!
            echo Process: !PROCESS_NAME!
        )
        
        REM Ask for confirmation
        set /p CONFIRM="Do you want to kill this process? (y/n): "
        if /i "!CONFIRM!"=="y" (
            echo Killing process !PID!...
            taskkill /PID !PID! /F
            if !errorlevel! equ 0 (
                echo Process !PID! killed successfully.
            ) else (
                echo Failed to kill process !PID!. You may need administrator privileges.
            )
        ) else (
            echo Process !PID! not killed.
        )
        echo.
    )
)

REM Check if any processes were found
netstat -ano | findstr ":%PORT% " >nul
if errorlevel 1 (
    echo No processes found using port %PORT%
) else (
    echo.
    echo Remaining processes using port %PORT%:
    netstat -ano | findstr ":%PORT% "
)

pause
exit /b 0

:kill_both
echo.
echo ========================================
echo Killing Frontend - Port %FRONTEND_PORT%
echo ========================================
call :kill_port_processes %FRONTEND_PORT%

echo.
echo ========================================
echo Killing Backend - Port %BACKEND_PORT%
echo ========================================
call :kill_port_processes %BACKEND_PORT%

echo.
echo ========================================
echo Summary
echo ========================================
echo Checking remaining processes...
netstat -ano | findstr ":7000 " >nul
if errorlevel 1 (
    echo [OK] Frontend - port 7000: No processes found
) else (
    echo [FAIL] Frontend - port 7000: Still has active processes
    netstat -ano | findstr ":7000 "
)

netstat -ano | findstr ":7001 " >nul
if errorlevel 1 (
    echo [OK] Backend - port 7001: No processes found
) else (
    echo [FAIL] Backend - port 7001: Still has active processes
    netstat -ano | findstr ":7001 "
)

pause
exit /b 0

:kill_port_processes
set TARGET_PORT=%1
echo Searching for processes using port %TARGET_PORT%...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%TARGET_PORT% "') do (
    set PID=%%a
    if not "!PID!"=="0" (
        echo Found process with PID !PID! using port %TARGET_PORT%
        
        REM Get process name for confirmation
        for /f "tokens=1" %%b in ('tasklist /fi "PID eq !PID!" /fo csv ^| findstr /v "PID"') do (
            set PROCESS_NAME=%%b
            set PROCESS_NAME=!PROCESS_NAME:"=!
            echo Process: !PROCESS_NAME!
        )
        
        REM Ask for confirmation
        set /p CONFIRM="Do you want to kill this process? (y/n): "
        if /i "!CONFIRM!"=="y" (
            echo Killing process !PID!...
            taskkill /PID !PID! /F
            if !errorlevel! equ 0 (
                echo Process !PID! killed successfully.
            ) else (
                echo Failed to kill process !PID!. You may need administrator privileges.
            )
        ) else (
            echo Process !PID! not killed.
        )
        echo.
    )
)

REM Check if any processes were found
netstat -ano | findstr ":%TARGET_PORT% " >nul
if errorlevel 1 (
    echo No processes found using port %TARGET_PORT%
) else (
    echo.
    echo Remaining processes using port %TARGET_PORT%:
    netstat -ano | findstr ":%TARGET_PORT% "
)
goto :eof
