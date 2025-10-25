-- Migration script to combine safety_margins and symbol_and_margins tables
-- into a new unified symbol_margins table

-- Create the new unified table
CREATE TABLE IF NOT EXISTS symbol_margins (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(255) NOT NULL,
    margin FLOAT NOT NULL,
    safety_margin FLOAT,
    symbol_type VARCHAR(50) DEFAULT 'equity',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_symbol_margin_symbol_type UNIQUE (symbol, symbol_type)
);

-- Migrate data from symbol_and_margins table
INSERT INTO symbol_margins (symbol, margin, symbol_type, created_at, updated_at)
SELECT 
    symbol_prefix as symbol,
    margin,
    symbol_type,
    created_at,
    updated_at
FROM symbol_and_margins
ON CONFLICT (symbol, symbol_type) DO NOTHING;

-- Migrate data from safety_margins table
-- For existing records, update the safety_margin field
-- For new records, create new entries
INSERT INTO symbol_margins (symbol, margin, safety_margin, symbol_type, created_at, updated_at)
SELECT 
    sm.symbol,
    COALESCE(sam.margin, 0) as margin, -- Use margin from symbol_and_margins if exists, otherwise 0
    sm.safety_margin,
    sm.type as symbol_type,
    sm.created_at,
    sm.updated_at
FROM safety_margins sm
LEFT JOIN symbol_and_margins sam ON LOWER(sm.symbol) = LOWER(sam.symbol_prefix) AND sm.type = sam.symbol_type
ON CONFLICT (symbol, symbol_type) DO UPDATE SET
    safety_margin = EXCLUDED.safety_margin,
    updated_at = CURRENT_TIMESTAMP;

-- Update margin values for records that only had safety_margin
UPDATE symbol_margins 
SET margin = 0 
WHERE margin IS NULL OR margin = 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_symbol_margins_symbol ON symbol_margins(symbol);
CREATE INDEX IF NOT EXISTS idx_symbol_margins_symbol_type ON symbol_margins(symbol_type);
CREATE INDEX IF NOT EXISTS idx_symbol_margins_created_at ON symbol_margins(created_at);

-- Add comments to the table and columns
COMMENT ON TABLE symbol_margins IS 'Unified table for symbol margins and safety margins';
COMMENT ON COLUMN symbol_margins.symbol IS 'Trading symbol (e.g., RELIANCE, GOLD)';
COMMENT ON COLUMN symbol_margins.margin IS 'Margin value for the symbol';
COMMENT ON COLUMN symbol_margins.safety_margin IS 'Safety margin percentage for put option strike price calculation';
COMMENT ON COLUMN symbol_margins.symbol_type IS 'Type of symbol: equity, commodity, currency, debt';
