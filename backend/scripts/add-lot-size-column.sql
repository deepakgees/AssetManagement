-- Migration script to add lot_size column to symbol_margins table

-- Add the lot_size column
ALTER TABLE symbol_margins 
ADD COLUMN IF NOT EXISTS lot_size INTEGER;

-- Add comment to the column
COMMENT ON COLUMN symbol_margins.lot_size IS 'Lot size for the symbol (number of units per lot)';

