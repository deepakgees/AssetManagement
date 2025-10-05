@echo off
echo Fixing accounts table sequence issue...
echo.

REM Run the sequence fix script
psql -h localhost -U postgres -d asset_management -f scripts/fix-accounts-sequence.sql

if %errorlevel% equ 0 (
    echo Sequence fix completed successfully!
    echo The accounts table sequence has been reset.
) else (
    echo Sequence fix failed. Please check the error messages above.
)

echo.
echo Sequence fix script completed.
pause
