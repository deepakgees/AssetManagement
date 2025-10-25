# Symbol Margins Migration Guide

This document describes the migration from separate `safety_margins` and `symbol_and_margins` tables to a unified `symbol_margins` table.

## Overview

The migration combines two separate tables into a single, more efficient table that stores both margin values and safety margins for all trading symbols in one place.

### Before Migration
- `safety_margins` table: stored safety margin percentages for put option strike price calculations
- `symbol_and_margins` table: stored margin values for different symbol types

### After Migration
- `symbol_margins` table: unified table containing both margin values and safety margins

## New Table Schema

```sql
CREATE TABLE symbol_margins (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(255) NOT NULL,
    margin FLOAT NOT NULL,
    safety_margin FLOAT,
    symbol_type VARCHAR(50) DEFAULT 'equity',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_symbol_margin_symbol_type UNIQUE (symbol, symbol_type)
);
```

## Migration Steps

### 1. Run the Migration Script

**Windows:**
```bash
cd backend
scripts\run-symbol-migration.bat
```

**Linux/Mac:**
```bash
cd backend
./scripts/run-symbol-migration.sh
```

### 2. Update Prisma Schema

After running the migration, update your Prisma client:

```bash
npx prisma generate
```

### 3. Restart Backend Server

Restart your backend server to use the new schema.

### 4. Update Frontend

The frontend has been updated to use the new unified API endpoints:
- Old: `/api/safetyMargins` and `/api/symbolAndMargins`
- New: `/api/symbolMargins`

## API Changes

### New Endpoints

All endpoints are now under `/api/symbolMargins`:

- `GET /api/symbolMargins` - Get all symbol margin records
- `GET /api/symbolMargins/:id` - Get specific record
- `GET /api/symbolMargins/symbol/:symbol` - Get records by symbol
- `POST /api/symbolMargins` - Create new record
- `PUT /api/symbolMargins/:id` - Update record
- `DELETE /api/symbolMargins/:id` - Delete record
- `POST /api/symbolMargins/sync-commodities` - Sync commodities from Kite API
- `POST /api/symbolMargins/sync-equities` - Sync equities from Kite API

### Query Parameters

- `symbolType`: Filter by symbol type (equity, commodity, currency, debt)
- `symbol`: Search by symbol name
- `hasSafetyMargin`: Filter records that have/don't have safety margins

### Request/Response Format

```typescript
interface SymbolMargin {
  id: number;
  symbol: string;
  margin: number;
  safetyMargin?: number;
  symbolType: string;
  createdAt: string;
  updatedAt: string;
}
```

## Frontend Changes

### New Unified Page

- **Route**: `/symbolMargins`
- **Component**: `SymbolMargins.tsx`
- **Service**: `symbolMarginsService.ts`

### Features

- **Unified Management**: Manage both margin values and safety margins in one place
- **Advanced Filtering**: Filter by symbol type, symbol name, and safety margin presence
- **Sync Capabilities**: Sync commodities and equities from Kite API
- **Bulk Operations**: Create, update, and delete records efficiently

### Removed Components

- `SafetyMargins.tsx` - Replaced by unified component
- `SymbolAndMargins.tsx` - Replaced by unified component
- `safetyMarginsService.ts` - Replaced by unified service
- `symbolAndMarginsService.ts` - Replaced by unified service

## Data Migration Details

The migration script performs the following operations:

1. **Creates new table**: `symbol_margins` with unified schema
2. **Migrates symbol_and_margins data**: 
   - `symbol_prefix` → `symbol`
   - `margin` → `margin`
   - `symbol_type` → `symbol_type`
3. **Migrates safety_margins data**:
   - `symbol` → `symbol`
   - `safety_margin` → `safety_margin`
   - `type` → `symbol_type`
4. **Handles conflicts**: Updates existing records with safety margin data
5. **Creates indexes**: For better query performance

## Benefits

1. **Unified Management**: All symbol and margin data in one place
2. **Better Performance**: Single table queries instead of joins
3. **Simplified UI**: One page to manage all symbol margins
4. **Consistent Data**: No duplicate symbols across tables
5. **Enhanced Filtering**: Advanced filtering capabilities
6. **Better Sync**: Unified sync process for all symbol types

## Rollback Plan

If you need to rollback the migration:

1. **Backup the new table**:
   ```sql
   CREATE TABLE symbol_margins_backup AS SELECT * FROM symbol_margins;
   ```

2. **Restore old tables** (if you have backups):
   ```sql
   -- Restore from your database backup
   ```

3. **Update application code** to use old endpoints

## Troubleshooting

### Common Issues

1. **Migration fails**: Check database permissions and connection
2. **Data conflicts**: Review the migration logs for specific errors
3. **Frontend errors**: Ensure all old service imports are removed
4. **API errors**: Verify the new routes are properly registered

### Verification

After migration, verify the data:

```sql
-- Check total records
SELECT COUNT(*) FROM symbol_margins;

-- Check by symbol type
SELECT symbol_type, COUNT(*) FROM symbol_margins GROUP BY symbol_type;

-- Check records with safety margins
SELECT COUNT(*) FROM symbol_margins WHERE safety_margin IS NOT NULL;
```

## Support

If you encounter issues during migration:

1. Check the migration logs for specific error messages
2. Verify database connectivity and permissions
3. Ensure all dependencies are installed
4. Review the Prisma schema changes

The migration is designed to be safe and preserve all existing data while providing a more efficient and unified approach to symbol margin management.
