# Historical Price Commodities Schema Migration

## Overview
This document describes the migration of the `historical_price_commodities` table from a date-based structure to a year/month-based structure.

## Changes Made

### 1. Database Schema Changes
- **File**: `backend/prisma/schema.prisma`
- **Changes**:
  - Replaced `date: DateTime` field with `year: Int` and `month: Int` fields
  - Updated unique constraint from `unique_commodity_symbol_date` to `unique_commodity_symbol_year_month`
  - Added NOT NULL constraints for year and month fields

### 2. Migration Scripts
- **File**: `backend/scripts/migrate-commodities-schema.sql`
  - Creates backup table before migration
  - Extracts year and month from existing date column
  - Drops old date column and unique constraint
  - Adds new unique constraint and indexes
  - Includes validation constraints for year (1900-2100) and month (1-12)

- **File**: `backend/scripts/run-commodities-migration.bat` (Windows)
- **File**: `backend/scripts/run-commodities-migration.sh` (Unix/Linux)
  - Batch/shell scripts to execute the migration
  - Includes error handling and next steps guidance

### 3. Service Updates
- **File**: `backend/src/services/mcxDataService.ts`
  - Updated `MonthlyMCXData` interface to use `year` and `month` instead of `date`
  - Modified database queries to use new unique constraint
  - Updated data processing to extract year/month from dates
  - Fixed error logging to show year-month format

### 4. API Route Updates
- **File**: `backend/src/routes/historicalData.ts`
  - Updated `/commodities` endpoint to accept year/month parameters instead of date range
  - Changed query parameters: `startDate/endDate` → `startYear/endYear/startMonth/endMonth`
  - Updated ordering to sort by year and month descending

## New Table Structure

```sql
CREATE TABLE historical_price_commodities (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    closing_price DOUBLE PRECISION NOT NULL,
    percent_change DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_commodity_symbol_year_month UNIQUE (symbol, year, month),
    CONSTRAINT check_year_valid CHECK (year >= 1900 AND year <= 2100),
    CONSTRAINT check_month_valid CHECK (month >= 1 AND month <= 12)
);
```

## Migration Steps

1. **Update Prisma Schema**: ✅ Completed
2. **Run Migration Script**: 
   ```bash
   # Windows
   cd backend/scripts
   run-commodities-migration.bat
   
   # Unix/Linux
   cd backend/scripts
   chmod +x run-commodities-migration.sh
   ./run-commodities-migration.sh
   ```
3. **Generate Prisma Client**: 
   ```bash
   cd backend
   npx prisma generate
   ```
4. **Restart Backend Server**: Manual restart required
5. **Verify Migration**: Check that data is accessible via new API endpoints
6. **Cleanup**: Drop backup table when ready:
   ```sql
   DROP TABLE historical_price_commodities_backup;
   ```

## API Changes

### Before (Date-based)
```
GET /api/historical-data/commodities?symbol=MCX_GOLD&startDate=2023-01-01&endDate=2023-12-31
```

### After (Year/Month-based)
```
GET /api/historical-data/commodities?symbol=MCX_GOLD&startYear=2023&endYear=2023&startMonth=1&endMonth=12
```

## Benefits

1. **Simplified Queries**: Year/month filtering is more intuitive for monthly data
2. **Better Performance**: Integer comparisons are faster than date comparisons
3. **Consistency**: Matches the structure of `historical_price_equity` table
4. **Data Integrity**: Validation constraints ensure valid year/month values

## Rollback Plan

If rollback is needed:
1. Restore from backup table: `INSERT INTO historical_price_commodities SELECT * FROM historical_price_commodities_backup;`
2. Revert code changes
3. Regenerate Prisma client

## Notes

- The migration preserves all existing data by extracting year/month from the date column
- All related services and API endpoints have been updated
- The backup table is created automatically during migration
- Validation constraints prevent invalid year/month values
