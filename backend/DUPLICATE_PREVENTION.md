# Duplicate Prevention System for P&L and Dividend Uploads

## Overview

This system prevents duplicate entries when uploading P&L and Dividend CSV files. It includes both database-level constraints and application-level checks to ensure data integrity.

## Components

### 1. Database Schema Changes

#### Unique Constraints
- **P&L Records**: `unique_pnl_record` constraint on combination of:
  - `uploadId`, `symbol`, `instrumentType`, `entryDate`, `exitDate`, `quantity`, `buyValue`, `sellValue`, `profit`
  
- **Dividend Records**: `unique_dividend_record` constraint on combination of:
  - `uploadId`, `symbol`, `isin`, `exDate`, `quantity`, `dividendPerShare`, `netDividendAmount`

#### Performance Indexes
- `idx_pnl_records_duplicate_check` on key fields for faster duplicate detection
- `idx_dividend_records_duplicate_check` on key fields for faster duplicate detection

### 2. Application-Level Duplicate Prevention

#### Upload Process Changes
- **P&L Uploads**: Records are inserted individually with duplicate detection
- **Dividend Uploads**: Records are inserted individually with duplicate detection
- **Error Handling**: Duplicate records are skipped and logged, but don't fail the upload

#### Pre-upload Duplicate Checking
- New endpoints to check for potential duplicates before upload:
  - `POST /api/pnl/check-duplicates/:accountId`
  - `POST /api/dividends/check-duplicates/:accountId`

### 3. Cleanup Scripts

#### Existing Duplicate Cleanup
- `cleanup-duplicates.js`: Comprehensive script to identify and remove existing duplicates
- Removes empty/invalid records
- Keeps the first occurrence of each duplicate group

## Implementation Steps

### Step 1: Clean Up Existing Duplicates
```bash
cd backend
node scripts/cleanup-duplicates.js
```

### Step 2: Apply Database Schema Changes
```bash
# Generate and apply Prisma migration
npx prisma migrate dev --name add-unique-constraints

# Or manually apply SQL constraints
psql -d your_database -f scripts/add-unique-constraints.sql
```

### Step 3: Restart Backend Services
```bash
# Restart your backend server to apply the changes
npm run dev
```

## How It Works

### During Upload
1. **File Processing**: CSV files are parsed as before
2. **Individual Insertion**: Each record is inserted individually instead of batch insertion
3. **Duplicate Detection**: If a record violates the unique constraint, it's skipped
4. **Logging**: Skipped duplicates are logged with details
5. **Success Response**: Upload completes with count of new vs skipped records

### Duplicate Detection Logic
- **P&L Records**: Considered duplicate if ALL key fields match:
  - Symbol, Instrument Type, Entry Date, Exit Date, Quantity, Buy Value, Sell Value, Profit
  
- **Dividend Records**: Considered duplicate if ALL key fields match:
  - Symbol, ISIN, Ex-Date, Quantity, Dividend Per Share, Net Dividend Amount

### Error Handling
- **Unique Constraint Violation (P2002)**: Record is skipped, upload continues
- **Other Errors**: Upload fails, error is logged and returned to client

## API Endpoints

### Check Duplicates Before Upload
```http
POST /api/pnl/check-duplicates/:accountId
POST /api/dividends/check-duplicates/:accountId

Body: {
  "records": [
    {
      "symbol": "RELIANCE",
      "instrumentType": "Equity - Short Term",
      "entryDate": "2024-01-15",
      "exitDate": "2024-01-20",
      "quantity": 100,
      "buyValue": 2500,
      "sellValue": 2600,
      "profit": 100
    }
  ]
}

Response: {
  "duplicates": [...],
  "totalRecords": 1,
  "duplicateCount": 0
}
```

### Upload Response Changes
```json
{
  "message": "File uploaded successfully",
  "uploadId": 123,
  "status": "completed",
  "stats": {
    "inserted": 150,
    "skipped": 5,
    "total": 155
  }
}
```

## Monitoring and Logging

### Service Logs
- All duplicate skips are logged with record details
- Upload statistics are logged for monitoring
- Error conditions are logged with full context

### Database Monitoring
- Monitor unique constraint violations
- Track upload success/failure rates
- Monitor performance impact of individual inserts

## Performance Considerations

### Before Implementation
- Batch inserts were faster but allowed duplicates
- No duplicate checking during upload

### After Implementation
- Individual inserts are slower but prevent duplicates
- Unique constraints provide database-level protection
- Indexes improve duplicate detection performance

### Optimization Options
1. **Batch with Duplicate Check**: Process in batches, check for duplicates, then insert
2. **Pre-upload Validation**: Check entire file before upload
3. **Hybrid Approach**: Use batch inserts with ON CONFLICT handling

## Troubleshooting

### Common Issues

#### 1. Migration Fails Due to Existing Duplicates
```bash
# Run cleanup script first
node scripts/cleanup-duplicates.js

# Then apply migration
npx prisma migrate dev
```

#### 2. Upload Performance Degradation
- Monitor upload times
- Consider implementing batch processing with conflict resolution
- Add more specific indexes if needed

#### 3. Memory Issues with Large Files
- Implement streaming processing for very large files
- Add file size limits
- Process in smaller chunks

### Debugging Commands

#### Check for Duplicates
```sql
-- P&L duplicates
SELECT COUNT(*) FROM (
  SELECT "uploadId", "symbol", "instrumentType", "entryDate", "exitDate", 
         "quantity", "buyValue", "sellValue", "profit", COUNT(*)
  FROM pnl_records 
  GROUP BY "uploadId", "symbol", "instrumentType", "entryDate", "exitDate", 
           "quantity", "buyValue", "sellValue", "profit"
  HAVING COUNT(*) > 1
) as duplicates;

-- Dividend duplicates
SELECT COUNT(*) FROM (
  SELECT "uploadId", "symbol", "isin", "exDate", "quantity", 
         "dividendPerShare", "netDividendAmount", COUNT(*)
  FROM dividend_records 
  GROUP BY "uploadId", "symbol", "isin", "exDate", "quantity", 
           "dividendPerShare", "netDividendAmount"
  HAVING COUNT(*) > 1
) as duplicates;
```

#### Check Constraint Status
```sql
-- Verify constraints exist
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE constraint_type = 'UNIQUE' 
  AND table_name IN ('pnl_records', 'dividend_records');
```

## Future Enhancements

### Potential Improvements
1. **Smart Duplicate Detection**: Use fuzzy matching for similar records
2. **User Notification**: Show duplicate warnings in UI before upload
3. **Bulk Operations**: Add endpoints for bulk duplicate cleanup
4. **Audit Trail**: Track all duplicate prevention actions
5. **Configuration**: Make duplicate detection rules configurable

### Monitoring Dashboard
- Upload success/failure rates
- Duplicate detection statistics
- Performance metrics
- Error tracking and alerting
