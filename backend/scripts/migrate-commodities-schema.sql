-- Migration script to restructure historical_price_commodities table
-- This script changes the table structure from date-based to year/month-based
-- Run this script after updating the Prisma schema

-- Step 1: Create a backup table with the old structure
CREATE TABLE historical_price_commodities_backup AS 
SELECT * FROM historical_price_commodities;

-- Step 2: Drop the existing unique constraint
ALTER TABLE historical_price_commodities 
DROP CONSTRAINT IF EXISTS unique_commodity_symbol_date;

-- Step 3: Add new columns for year and month
ALTER TABLE historical_price_commodities 
ADD COLUMN year INTEGER,
ADD COLUMN month INTEGER;

-- Step 4: Populate year and month columns from the existing date column
UPDATE historical_price_commodities 
SET 
    year = EXTRACT(YEAR FROM date),
    month = EXTRACT(MONTH FROM date);

-- Step 5: Make year and month columns NOT NULL
ALTER TABLE historical_price_commodities 
ALTER COLUMN year SET NOT NULL,
ALTER COLUMN month SET NOT NULL;

-- Step 6: Drop the old date column
ALTER TABLE historical_price_commodities 
DROP COLUMN date;

-- Step 7: Add new unique constraint for symbol, year, month combination
ALTER TABLE historical_price_commodities 
ADD CONSTRAINT unique_commodity_symbol_year_month 
UNIQUE (symbol, year, month);

-- Step 8: Add indexes for better performance
CREATE INDEX idx_commodities_symbol ON historical_price_commodities(symbol);
CREATE INDEX idx_commodities_year_month ON historical_price_commodities(year, month);
CREATE INDEX idx_commodities_symbol_year_month ON historical_price_commodities(symbol, year, month);

-- Step 9: Add check constraints for valid year and month values
ALTER TABLE historical_price_commodities 
ADD CONSTRAINT check_year_valid 
CHECK (year >= 1900 AND year <= 2100);

ALTER TABLE historical_price_commodities 
ADD CONSTRAINT check_month_valid 
CHECK (month >= 1 AND month <= 12);

-- Note: The backup table can be dropped after verifying the migration was successful
-- DROP TABLE historical_price_commodities_backup;
