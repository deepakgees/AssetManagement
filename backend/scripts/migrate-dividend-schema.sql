-- Migration script to remove dividend_uploads table and add accountId to dividend_records
-- This script should be run after updating the Prisma schema

-- Step 1: Add accountId column to dividend_records table
ALTER TABLE dividend_records ADD COLUMN account_id INTEGER;

-- Step 2: Update existing records with accountId from dividend_uploads
UPDATE dividend_records 
SET account_id = dividend_uploads.account_id 
FROM dividend_uploads 
WHERE dividend_records.upload_id = dividend_uploads.id;

-- Step 3: Make accountId NOT NULL
ALTER TABLE dividend_records ALTER COLUMN account_id SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE dividend_records 
ADD CONSTRAINT fk_dividend_records_account_id 
FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- Step 5: Drop the old foreign key constraint and uploadId column
ALTER TABLE dividend_records DROP CONSTRAINT IF EXISTS dividend_records_upload_id_fkey;
ALTER TABLE dividend_records DROP COLUMN upload_id;

-- Step 6: Drop the dividend_uploads table
DROP TABLE IF EXISTS dividend_uploads;

-- Step 7: Add index for better performance
CREATE INDEX idx_dividend_records_account_id ON dividend_records(account_id);
CREATE INDEX idx_dividend_records_created_at ON dividend_records(created_at);

-- Step 8: Update the unique constraint to use accountId instead of uploadId
ALTER TABLE dividend_records DROP CONSTRAINT IF EXISTS unique_dividend_record;
ALTER TABLE dividend_records 
ADD CONSTRAINT unique_dividend_record 
UNIQUE (account_id, symbol, isin, ex_date, quantity, dividend_per_share, net_dividend_amount);
