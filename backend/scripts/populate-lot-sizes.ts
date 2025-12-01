import { PrismaClient } from '@prisma/client';
import logger from '../src/utils/logger';
import { getInstruments } from '../services/ZerodhaService';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Known lot sizes for common symbols (Indian markets)
// These are standard lot sizes that don't change frequently
const KNOWN_LOT_SIZES: Record<string, number> = {
  // Indices
  'NIFTY': 50,
  'BANKNIFTY': 15,
  'FINNIFTY': 40,
  'MIDCPNIFTY': 50,
  'SENSEX': 10,
  'BANKEX': 15,
  
  // Common equity stocks (most equity stocks have lot size of 1)
  // F&O stocks typically have lot sizes, but they can change
  // We'll try to fetch from API first, then fall back to known values
  
  // Commodities (MCX)
  'GOLD': 1, // 1 kg
  'GOLDM': 1, // 1 kg
  'SILVER': 30, // 30 kg
  'SILVERM': 5, // 5 kg
  'CRUDEOIL': 100, // 100 barrels
  'NATURALGAS': 1250, // 1250 MMBtu
  'COPPER': 1, // 1 MT
  'ZINC': 5, // 5 MT
  'LEAD': 5, // 5 MT
  'NICKEL': 1, // 1 MT
  'ALUMINIUM': 5, // 5 MT
};

interface Instrument {
  tradingsymbol: string;
  name: string;
  lot_size: number;
  instrument_type: string;
  exchange: string;
  segment: string;
}

async function populateLotSizes() {
  try {
    logger.info('Starting lot size population...');
    
    // Get all symbols from symbol_margins table
    const symbolMargins = await prisma.symbolMargin.findMany({
      select: {
        id: true,
        symbol: true,
        symbolType: true,
        lotSize: true,
      },
    });
    
    logger.info(`Found ${symbolMargins.length} symbols to process`);
    
    // Try to get lot sizes from local CSV file first
    let instrumentsMap: Map<string, number> = new Map();
    let apiFetched = false;
    
    // Step 1: Try to read from local CSV file
    try {
      const csvPath = path.join(__dirname, '../fo_mktlots.csv');
      logger.info(`Attempting to read lot sizes from local CSV file: ${csvPath}`);
      
      if (fs.existsSync(csvPath)) {
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.split('\n');
        logger.info(`Parsing ${lines.length} lines from local CSV file...`);
        
        // Parse CSV data
        // Format: UNDERLYING, SYMBOL, LOT_SIZE
        // Skip header lines and empty lines
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Skip header lines (contain "UNDERLYING" or "Derivatives")
          if (line.toUpperCase().includes('UNDERLYING') || 
              line.toUpperCase().includes('DERIVATIVES') ||
              line.toUpperCase().includes('SYMBOL') && line.includes(',')) {
            continue;
          }
          
          // Split by comma and trim
          const columns = line.split(',').map(col => col.trim());
          
          // Expect at least 3 columns: UNDERLYING, SYMBOL, LOT_SIZE
          if (columns.length >= 3) {
            const symbol = columns[1]?.toUpperCase().trim();
            const lotSizeStr = columns[2]?.trim();
            
            // Skip if symbol is empty or lot size is not a number
            if (symbol && lotSizeStr) {
              // Handle date format in header (e.g., "25-Nov") - skip those lines
              if (lotSizeStr.includes('-') || lotSizeStr.includes('/')) {
                continue;
              }
              
              const lotSize = parseInt(lotSizeStr, 10);
              if (!isNaN(lotSize) && lotSize > 0 && symbol) {
                instrumentsMap.set(symbol, lotSize);
              }
            }
          }
        }
        
        if (instrumentsMap.size > 0) {
          apiFetched = true;
          logger.info(`Successfully parsed ${instrumentsMap.size} lot sizes from local CSV file`);
        } else {
          logger.warn('Local CSV file parsed but no valid lot sizes found');
        }
      } else {
        logger.warn(`Local CSV file not found at ${csvPath}`);
      }
    } catch (csvError: any) {
      logger.warn(`Failed to read from local CSV file: ${csvError?.message || csvError}`);
      logger.info('Will try Kite Connect API or known lot sizes');
    }
    
    // Step 2: Try to get instruments from Kite Connect API if CSV file failed and account is available
    if (!apiFetched) {
      try {
        // Get first active account with API credentials
        const account = await prisma.account.findFirst({
          where: {
            isActive: true,
            apiKey: { not: null },
            apiSecret: { not: null },
            accessToken: { not: null },
          },
        });
        
        if (account && account.apiKey && account.apiSecret) {
          logger.info(`Attempting to fetch instruments from Kite Connect API using account: ${account.name}`);
          
          try {
            // Try to get instruments for different segments
            // Note: getInstruments may work without full authentication for public segments
            const segments = ['NSE', 'BSE', 'NFO', 'MCX', 'CDS'];
            
            for (const segment of segments) {
              try {
                logger.info(`Fetching instruments for segment: ${segment}`);
                // Use empty string for requestToken if not available - some segments may work without it
                const instruments = await getInstruments(
                  account.apiKey,
                  account.requestToken || '',
                  account.apiSecret,
                  segment
                ) as Instrument[];
                
                if (instruments && Array.isArray(instruments)) {
                  instruments.forEach((instrument: Instrument) => {
                    if (instrument.lot_size && instrument.lot_size > 0) {
                      // Store by trading symbol (uppercase for consistency)
                      const key = instrument.tradingsymbol.toUpperCase();
                      instrumentsMap.set(key, instrument.lot_size);
                    }
                  });
                  logger.info(`Fetched ${instruments.length} instruments from ${segment}`);
                }
              } catch (segmentError: any) {
                logger.warn(`Failed to fetch instruments for segment ${segment}: ${segmentError?.message || segmentError}`);
                // Continue with other segments
              }
            }
            
            if (instrumentsMap.size > 0) {
              apiFetched = true;
              logger.info(`Successfully fetched ${instrumentsMap.size} instruments with lot sizes from API`);
            } else {
              logger.info('No instruments fetched from API. Will use known lot sizes only.');
            }
          } catch (apiError: any) {
            logger.warn(`Failed to fetch instruments from API: ${apiError?.message || apiError}`);
            logger.info('Will use known lot sizes and leave others empty');
          }
        } else {
          logger.info('No active account with API credentials found. Will use known lot sizes only.');
        }
      } catch (error) {
        logger.warn(`Error attempting to fetch from API: ${error}`);
        logger.info('Will use known lot sizes and leave others empty');
      }
    }
    
    // Process each symbol
    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    
    for (const symbolMargin of symbolMargins) {
      let lotSize: number | null = null;
      
      // Try to find lot size from CSV/API data
      if (apiFetched) {
        // Try exact match first
        const apiLotSize = instrumentsMap.get(symbolMargin.symbol.toUpperCase());
        if (apiLotSize) {
          lotSize = apiLotSize;
        } else {
          // Try to find by symbol prefix (for F&O symbols like RELIANCE, NIFTY, etc.)
          // Some symbols might be stored without exchange suffix
          for (const [key, value] of instrumentsMap.entries()) {
            if (key.startsWith(symbolMargin.symbol.toUpperCase()) || 
                symbolMargin.symbol.toUpperCase().startsWith(key)) {
              lotSize = value;
              break;
            }
          }
        }
      }
      
      // If not found in CSV/API, try known lot sizes (only for non-equity or if no data fetched)
      if (lotSize === null && (!apiFetched || symbolMargin.symbolType !== 'equity')) {
        const knownLotSize = KNOWN_LOT_SIZES[symbolMargin.symbol.toUpperCase()];
        if (knownLotSize) {
          lotSize = knownLotSize;
        }
      }
      
      // For equity symbols, if we have CSV data, update even if lot size exists
      // For other symbol types or if no data fetched, only update if lot size is null
      const shouldUpdate = lotSize !== null && (
        symbolMargin.symbolType === 'equity' && apiFetched ? true : 
        (symbolMargin.lotSize === null || symbolMargin.lotSize === undefined)
      );
      
      if (shouldUpdate) {
        // Check if the value is actually different
        if (symbolMargin.lotSize === lotSize) {
          skipped++;
          logger.debug(`Unchanged ${symbolMargin.symbol} (${symbolMargin.symbolType}): lot size = ${lotSize}`);
        } else {
          await prisma.symbolMargin.update({
            where: { id: symbolMargin.id },
            data: { lotSize },
          });
          updated++;
          logger.debug(`Updated ${symbolMargin.symbol} (${symbolMargin.symbolType}): lot size = ${symbolMargin.lotSize || 'null'} -> ${lotSize}`);
        }
      } else if (symbolMargin.lotSize !== null && symbolMargin.lotSize !== undefined) {
        skipped++;
        logger.debug(`Skipped ${symbolMargin.symbol} (${symbolMargin.symbolType}): already has lot size = ${symbolMargin.lotSize}`);
      } else {
        notFound++;
        logger.debug(`Could not find lot size for ${symbolMargin.symbol} (${symbolMargin.symbolType})`);
      }
    }
    
    logger.info('='.repeat(60));
    logger.info('Lot size population completed!');
    logger.info(`Total symbols processed: ${symbolMargins.length}`);
    logger.info(`Updated with lot size: ${updated}`);
    logger.info(`Unchanged/Skipped: ${skipped}`);
    logger.info(`Could not find lot size: ${notFound}`);
    logger.info('='.repeat(60));
    
    if (notFound > 0) {
      logger.info(`Note: ${notFound} symbols were left without lot size as they could not be found.`);
      logger.info('You can manually update these or run this script again after adding more known lot sizes.');
    }
    
  } catch (error) {
    logger.error('Error populating lot sizes:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script if executed directly
if (require.main === module) {
  populateLotSizes()
    .then(() => {
      logger.info('Lot size population completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Lot size population failed:', error);
      process.exit(1);
    });
}

export default populateLotSizes;

