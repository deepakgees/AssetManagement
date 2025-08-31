-- Add unique constraints to prevent duplicate P&L and Dividend records
-- This script should be run after cleaning up existing duplicates

-- Add unique constraint for P&L records
ALTER TABLE pnl_records 
ADD CONSTRAINT unique_pnl_record 
UNIQUE ("uploadId", "symbol", "instrumentType", "entryDate", "exitDate", "quantity", "buyValue", "sellValue", "profit");

-- Add unique constraint for Dividend records
ALTER TABLE dividend_records 
ADD CONSTRAINT unique_dividend_record 
UNIQUE ("uploadId", "symbol", "isin", "exDate", "quantity", "dividendPerShare", "netDividendAmount");

-- Create indexes for better performance on duplicate checks
CREATE INDEX IF NOT EXISTS idx_pnl_records_duplicate_check 
ON pnl_records ("uploadId", "symbol", "instrumentType", "entryDate", "exitDate");

CREATE INDEX IF NOT EXISTS idx_dividend_records_duplicate_check 
ON dividend_records ("uploadId", "symbol", "isin", "exDate");

-- Add comments for documentation
COMMENT ON CONSTRAINT unique_pnl_record ON pnl_records IS 'Prevents duplicate P&L records within the same upload';
COMMENT ON CONSTRAINT unique_dividend_record ON dividend_records IS 'Prevents duplicate dividend records within the same upload';
