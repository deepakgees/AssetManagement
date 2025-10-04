-- Migration script to remove pnl_uploads table and add accountId to pnl_records
-- This script should be run after updating the Prisma schema

-- Step 1: Add accountId column to pnl_records table
ALTER TABLE pnl_records ADD COLUMN account_id INTEGER;

-- Step 2: Update existing records with accountId from pnl_uploads
UPDATE pnl_records 
SET account_id = pnl_uploads.account_id 
FROM pnl_uploads 
WHERE pnl_records.upload_id = pnl_uploads.id;

-- Step 3: Make accountId NOT NULL
ALTER TABLE pnl_records ALTER COLUMN account_id SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE pnl_records 
ADD CONSTRAINT fk_pnl_records_account_id 
FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- Step 5: Drop the old foreign key constraint and uploadId column
ALTER TABLE pnl_records DROP CONSTRAINT IF EXISTS pnl_records_upload_id_fkey;
ALTER TABLE pnl_records DROP COLUMN upload_id;

-- Step 6: Drop the pnl_uploads table
DROP TABLE IF EXISTS pnl_uploads;

-- Step 7: Add index for better performance
CREATE INDEX idx_pnl_records_account_id ON pnl_records(account_id);
CREATE INDEX idx_pnl_records_created_at ON pnl_records(created_at);
