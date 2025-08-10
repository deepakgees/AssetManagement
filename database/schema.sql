-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    access_token VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);

-- Create holdings table
CREATE TABLE IF NOT EXISTS holdings (
    id SERIAL PRIMARY KEY,
    trading_symbol VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    average_price DECIMAL(10,2) NOT NULL,
    last_price DECIMAL(10,2) NOT NULL,
    market_value DECIMAL(15,2) NOT NULL,
    pnl DECIMAL(15,2) NOT NULL,
    pnl_percentage DECIMAL(5,2) NOT NULL,
    exchange VARCHAR(20) NOT NULL,
    sector VARCHAR(100),
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    trading_symbol VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    average_price DECIMAL(10,2) NOT NULL,
    last_price DECIMAL(10,2) NOT NULL,
    market_value DECIMAL(15,2) NOT NULL,
    pnl DECIMAL(15,2) NOT NULL,
    pnl_percentage DECIMAL(5,2) NOT NULL,
    exchange VARCHAR(20) NOT NULL,
    product VARCHAR(10) NOT NULL, -- CNC, MIS, NRML
    side VARCHAR(10) NOT NULL, -- BUY, SELL
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create portfolio_snapshots table
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id SERIAL PRIMARY KEY,
    total_value DECIMAL(15,2) NOT NULL,
    total_pnl DECIMAL(15,2) NOT NULL,
    total_pnl_percentage DECIMAL(5,2) NOT NULL,
    cash_balance DECIMAL(15,2) NOT NULL,
    margin_used DECIMAL(15,2) NOT NULL,
    available_margin DECIMAL(15,2) NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a default user for testing
INSERT INTO users (email, password, name) VALUES 
('test@example.com', '$2a$10$dummy.hash.for.testing', 'Test User')
ON CONFLICT (email) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_account_id ON holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_positions_account_id ON positions(account_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_account_id ON portfolio_snapshots(account_id); 