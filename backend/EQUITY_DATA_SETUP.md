# Equity Data API Setup

The equity data download functionality uses Yahoo Finance API to fetch real stock data for Indian stocks.

## API Configuration

### Yahoo Finance API

**Setup:**
- **No API key required!** Yahoo Finance API is completely free to use
- No configuration needed in `.env` file
- No registration required

**Features:**
- Completely free with no rate limits
- Excellent support for Indian stocks (NSE/BSE)
- Historical data up to 10+ years
- Daily data aggregated to monthly closing prices
- Real-time and historical data

**Important:** Yahoo Finance API is free and doesn't require any setup. The system will fall back to mock data only if the API is temporarily unavailable.

## How It Works

1. **Primary**: Uses Yahoo Finance API for real stock data
2. **Fallback**: If Yahoo Finance API fails, falls back to mock data (for testing)

## Supported Stock Symbols

The system supports Indian stocks with NSE exchange:
- RELIANCE → RELIANCE.NS
- TCS → TCS.NS
- INFY → INFY.NS
- etc.

## Testing

The API is ready to use immediately - no setup required!