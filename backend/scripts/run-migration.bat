@echo off
echo Running database migration to add totp_secret column...
echo.

REM Check if the column already exists
psql -h localhost -U postgres -d asset_management -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'totp_secret';" > temp_check.txt 2>&1

REM Check if the result contains the column
findstr /C:"totp_secret" temp_check.txt >nul
if %errorlevel% equ 0 (
    echo Column totp_secret already exists in accounts table.
) else (
    echo Adding totp_secret column to accounts table...
    psql -h localhost -U postgres -d asset_management -f scripts/add-totp-secret-column.sql
    if %errorlevel% equ 0 (
        echo Migration completed successfully!
    ) else (
        echo Migration failed. Please check the error messages above.
    )
)

REM Clean up temp file
del temp_check.txt 2>nul

echo.
echo Migration script completed.
pause
