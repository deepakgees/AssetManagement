@echo off

REM Run pg_restore
"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" -U postgres -d assetManagement_backup "C:\Users\goenkd\OneDrive - msg systems ag\MSG\AssetManagement_Backups\2025-09-27_11-15-03.custom.backup"



echo Backup restored successfully

pause