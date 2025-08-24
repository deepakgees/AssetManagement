-- Add family column to accounts table
ALTER TABLE accounts ADD COLUMN family VARCHAR(255);

-- Update existing accounts to have a default family value based on name
-- This is optional - you can remove this if you want to keep family as NULL for existing accounts
UPDATE accounts SET family = CONCAT(name, ' Family') WHERE family IS NULL;

-- Add a comment to document the change
COMMENT ON COLUMN accounts.family IS 'Family name for grouping accounts';
