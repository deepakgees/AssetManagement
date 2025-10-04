# Database Schema Optimization

## Overview
This optimization removes the `pnl_uploads` and `dividend_uploads` tables and stores the `accountId` directly in the `pnl_records` and `dividend_records` tables, simplifying the database structure and improving performance.

## Changes Made

### Database Schema Changes
1. **Removed `pnl_uploads` and `dividend_uploads` tables** - No longer needed as upload metadata is not critical
2. **Added `accountId` to `pnl_records` and `dividend_records`** - Direct relationship to accounts
3. **Updated foreign key relationships** - Both record tables now directly reference `accounts`

### Backend Changes
1. **Updated Prisma schema** - Removed `PnLUpload` and `DividendUpload` models, updated record models
2. **Modified PnL and Dividend routes** - Updated all routes to work with new schema
3. **Simplified upload process** - No longer creates upload records, directly processes CSV
4. **Updated duplicate checking** - Now checks against account records directly

### Frontend Changes
1. **Updated TypeScript interfaces** - Both `PnLRecord` and `DividendRecord` now have `accountId` instead of `uploadId`
2. **Modified service methods** - Updated to work with new API responses
3. **Updated delete functionality** - Now deletes by date instead of upload ID

## Migration Steps

### 1. Run Database Migrations
```bash
# Run the PnL migration script
psql -d your_database -f backend/scripts/migrate-pnl-schema.sql

# Run the dividend migration script
psql -d your_database -f backend/scripts/migrate-dividend-schema.sql
```

### 2. Regenerate Prisma Client
```bash
cd backend
npx prisma generate
```

### 3. Restart Applications
- Restart the backend server
- Restart the frontend application

## Benefits

1. **Simplified Schema** - One less table to maintain
2. **Better Performance** - Fewer joins required for queries
3. **Direct Relationships** - PnL records directly linked to accounts
4. **Easier Maintenance** - Less complex data model

## API Changes

### Upload Response
**Before:**
```json
{
  "message": "File uploaded successfully",
  "uploadId": 123,
  "status": "processing"
}
```

**After:**
```json
{
  "message": "File uploaded successfully", 
  "accountId": 456,
  "status": "processing"
}
```

### Delete Upload
**Before:** `DELETE /pnl/upload/:uploadId`
**After:** `DELETE /pnl/upload/:date?accountId=:accountId`

## Notes
- Existing data will be preserved during migration
- Upload history is now grouped by creation date
- All existing functionality remains the same from user perspective
