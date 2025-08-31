@echo off

REM Run pg_restore
"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" -U postgres -d assetManagement "C:\Users\goenkd\OneDrive - msg systems ag\MSG\AssetManagement_Backups\2025-08-30_17-25-19.custom.backup"



echo Backup restored successfully

pause