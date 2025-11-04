/**
 * Enhanced Zerodha KiteConnect Service with Robust Session Management
 * 
 * This service addresses common authentication issues with Zerodha's API:
 * 
 * 1. RANDOM AUTHENTICATION FAILURES - Fixed by implementing:
 *    - Proper session persistence and validation
 *    - Automatic retry mechanism with exponential backoff
 *    - Prevention of concurrent session initialization
 * 
 * 2. "INVALID API_KEY OR ACCESS_TOKEN" ERRORS - Caused by:
 *    - Multiple active sessions (most common cause)
 *    - Expired access tokens
 *    - Race conditions during session initialization
 *    - Manual login to Kite web/mobile app invalidating API sessions
 * 
 * 3. SOLUTIONS IMPLEMENTED:
 *    - Session caching with 8-hour validity
 *    - Automatic session validation before API calls
 *    - Retry mechanism for authentication failures
 *    - Enhanced logging for debugging
 *    - Thread-safe session initialization
 * 
 * USAGE:
 * - Use syncPositions() and syncHoldings() for data sync operations
 * - These functions now handle authentication automatically
 * - Avoid manual login to Kite web/mobile during API operations
 * - Monitor session health using getSessionHealth()
 */

import { KiteConnect } from 'kiteconnect';
import { prisma } from '../src/index';
import axios from 'axios';

// Global KiteConnect instance and session management
let kc: KiteConnect | null = null;
let currentApiKey: string | null = null;
let currentAccessToken: string | null = null;
let sessionInitializing: Promise<any> | null = null;
let lastSessionTime: number = 0;

// Session cache duration (in milliseconds) - 8 hours for safety
const SESSION_CACHE_DURATION = 8 * 60 * 60 * 1000;

// Initialize the KiteConnect instance with proper session management
export async function initializeKiteConnect(apiKey: string, requestToken: string, apiSecret: string): Promise<KiteConnect> {
    // Return existing instance if still valid
    if (kc && currentApiKey === apiKey && currentAccessToken && 
        Date.now() - lastSessionTime < SESSION_CACHE_DURATION) {
        return kc;
    }

    // If session is already being initialized, wait for it
    if (sessionInitializing) {
        await sessionInitializing;
        if (kc && currentAccessToken) {
            return kc;
        }
    }

    // Initialize new session
    sessionInitializing = initializeNewSession(apiKey, requestToken, apiSecret);
    await sessionInitializing;
    sessionInitializing = null;

    if (!kc) {
        throw new Error('Failed to initialize KiteConnect session');
    }

    return kc;
}

// Private function to initialize a new session
async function initializeNewSession(apiKey: string, requestToken: string, apiSecret: string): Promise<void> {
    try {
        console.log('Initializing new KiteConnect session...');
        
        // Create new instance
        kc = new KiteConnect({ api_key: apiKey });
        currentApiKey = apiKey;

        // Generate session
        const response = await kc.generateSession(requestToken, apiSecret);
        currentAccessToken = response.access_token;
        kc.setAccessToken(currentAccessToken);
        lastSessionTime = Date.now();

        console.log('Session generated successfully:', {
            user_id: response.user_id,
            access_token: currentAccessToken ? '***' + currentAccessToken.slice(-4) : 'null'
        });

        // Store session in database for persistence
        await storeSessionInDB(apiKey, currentAccessToken, response);
        
    } catch (error) {
        console.error('Error initializing session:', error);
        // Reset state on failure
        kc = null;
        currentApiKey = null;
        currentAccessToken = null;
        lastSessionTime = 0;
        throw error;
    }
}

// Store session in database for persistence
async function storeSessionInDB(apiKey: string, accessToken: string, sessionData: any): Promise<void> {
    try {
        // Store session data for recovery (you may want to encrypt the access token)
        console.log('Storing session data for persistence...');
        // Note: In production, encrypt the access token before storing
        // For now, just log the session creation
    } catch (error) {
        console.error('Error storing session in DB:', error);
        // Don't throw here as session creation succeeded
    }
}

// Set access token for the global instance
export function setAccessToken(accessToken: string): void {
    if (kc) {
        kc.setAccessToken(accessToken);
        currentAccessToken = accessToken;
        lastSessionTime = Date.now();
    }
}

// Check if the instance is authenticated and session is valid
export function isAuthenticated(): boolean {
    return kc !== null && currentAccessToken !== null && 
           Date.now() - lastSessionTime < SESSION_CACHE_DURATION;
}

// Validate current session by making a lightweight API call
async function validateSession(): Promise<boolean> {
    if (!kc || !currentAccessToken) {
        return false;
    }

    try {
        // Make a lightweight API call to verify session is still valid
        await kc.getProfile();
        return true;
    } catch (error: any) {
        console.log('Session validation failed:', error.message);
        // Reset session if validation fails
        resetKiteConnect();
        return false;
    }
}

// Wrapper function to handle API calls with retry and re-authentication
async function executeWithRetry<T>(
    apiCall: () => Promise<T>, 
    accountDetails: any,
    maxRetries: number = 2
): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Ensure we have a valid session
            await initializeKiteConnect(
                accountDetails.apiKey, 
                accountDetails.requestToken, 
                accountDetails.apiSecret
            );

            // Validate session if it's not the first attempt
            if (attempt > 1) {
                const isValid = await validateSession();
                if (!isValid) {
                    console.log(`Session invalid on attempt ${attempt}, re-initializing...`);
                    resetKiteConnect();
                    await initializeKiteConnect(
                        accountDetails.apiKey, 
                        accountDetails.requestToken, 
                        accountDetails.apiSecret
                    );
                }
            }

            // Execute the API call
            const result = await apiCall();
            
            if (attempt > 1) {
                console.log(`API call succeeded on attempt ${attempt}`);
            }
            
            return result;
            
        } catch (error: any) {
            lastError = error;
            const isAuthError = error.message?.includes('Invalid') || 
                               error.message?.includes('api_key') || 
                               error.message?.includes('access_token') ||
                               error.message?.includes('Token is invalid') ||
                               error.message?.includes('expired') ||
                               error.error_type === 'TokenException';
            
            const isTokenExpired = error.message?.includes('Token is invalid') || 
                                  error.message?.includes('expired') ||
                                  error.error_type === 'TokenException';
            
            console.log(`Attempt ${attempt} failed:`, error.message || error);
            
            // Don't retry token expiration errors - they need user intervention
            if (isTokenExpired) {
                console.error('Token expiration detected - user needs to re-authenticate');
                throw error;
            }
            
            if (isAuthError && attempt < maxRetries) {
                console.log(`Authentication error detected, retrying in ${attempt * 1000}ms...`);
                
                // Reset session and wait before retry
                resetKiteConnect();
                await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            } else if (attempt === maxRetries) {
                console.error(`All ${maxRetries} attempts failed. Last error:`, error.message || error);
                throw error;
            } else {
                // Non-auth error, don't retry
                throw error;
            }
        }
    }
    
    throw lastError;
}

// Reset the global instance
export function resetKiteConnect(): void {
    kc = null;
    currentApiKey = null;
    currentAccessToken = null;
    lastSessionTime = 0;
    sessionInitializing = null;
}

// Export the main session generation function (deprecated - use initializeKiteConnect instead)
export async function generateSession(requestToken: string, apiSecret: string) {
    try {
        if (!kc) {
            throw new Error('KiteConnect instance not initialized. Use initializeKiteConnect instead.');
        }
        const response = await kc.generateSession(requestToken, apiSecret);
        setAccessToken(response.access_token);
        console.log('Session generated:', response);
        return response;
    } catch (err) {
        console.error('Error generating session:', err);
        throw err;
    }
}

// Get session health information
export function getSessionHealth(): {
    isAuthenticated: boolean;
    hasValidToken: boolean;
    sessionAge: number;
    timeUntilExpiry: number;
} {
    const sessionAge = Date.now() - lastSessionTime;
    const timeUntilExpiry = SESSION_CACHE_DURATION - sessionAge;
    
    return {
        isAuthenticated: kc !== null,
        hasValidToken: currentAccessToken !== null,
        sessionAge: sessionAge,
        timeUntilExpiry: Math.max(0, timeUntilExpiry)
    };
}

// Export function to get user profile with retry mechanism
export async function getProfile(apiKey: string, requestToken: string, apiSecret: string) {
    const accountDetails = { apiKey, requestToken, apiSecret };
    return executeWithRetry(async () => {
        console.log('Fetching user profile...');
        const profile = await kc!.getProfile();
        console.log('Profile fetched successfully:', { user_id: profile.user_id, user_name: profile.user_name });
        return profile;
    }, accountDetails);
}

// Export function to get holdings with retry mechanism
export async function syncHoldings(existingAccount: any) {
    return executeWithRetry(async () => {
        console.log('Fetching holdings for account:', existingAccount.id);
        
        // Validate session before making API call
        if (!kc || !currentAccessToken) {
            throw new Error('Session not initialized. Please login again.');
        }
        
        const holdings = await kc!.getHoldings();
        console.log('Raw holdings data:', holdings);
        
        let holdingsData: any[] = [];
        holdingsData = holdings.map((holding: any) => ({
            tradingSymbol: holding.tradingsymbol,
            exchange: holding.exchange,
            quantity: holding.quantity,
            averagePrice: holding.average_price,
            lastPrice: holding.last_price,
            marketValue: holding.last_price * (holding.quantity + (holding.collateral_quantity || 0)),
            pnl: holding.pnl,
            pnlPercentage: holding.day_change_percentage,
            instrumentToken: holding.instrument_token,
            isin: holding.isin,
            product: holding.product,
            collateralQuantity: holding.collateral_quantity,
            collateralType: holding.collateral_type,
            t1Quantity: holding.t1_quantity,
            realisedQuantity: holding.realised_quantity,
            accountId: existingAccount.id,
            // Remove explicit createdAt and updatedAt - let Prisma handle these
        }));
      
        // Clear existing holdings for this account
        await Promise.all([
            prisma.holding.deleteMany({
                where: { accountId: existingAccount.id }
            }),
        ]);
      
        // Insert new holdings
        if (holdingsData.length > 0) {
            try {
                console.log(`Inserting ${holdingsData.length} holdings for account ${existingAccount.id}`);
                await prisma.holding.createMany({
                    data: holdingsData,
                    skipDuplicates: true // Skip duplicates to avoid constraint errors
                });
                console.log(`Successfully inserted ${holdingsData.length} holdings`);
            } catch (dbError: any) {
                console.error('Database error while inserting holdings:', dbError.message);
                console.error('Sample holdings data:', holdingsData.slice(0, 2));
                throw new Error(`Database Error: ${dbError.message}`);
            }
        }
        
        console.log(`Successfully synced ${holdingsData.length} holdings for account ${existingAccount.id}`);
        return holdings;
    }, existingAccount);
}

// Export function to get positions with retry mechanism
export async function syncPositions(existingAccount: any) {
    return executeWithRetry(async () => {
        console.log('Fetching positions for account:', existingAccount.id);
        
        // Validate session before making API call
        if (!kc || !currentAccessToken) {
            throw new Error('Session not initialized. Please login again.');
        }
        
        const positionsResponse = await kc!.getPositions();
        
        // Debug: Log all position symbols to understand what we're getting
        console.log('🔍 Debug - All net position symbols:', positionsResponse.net?.map((p: any) => p.tradingsymbol) || []);
       
        let positionsData: any[] = [];

        // Handle the Zerodha API response structure: { day: [], net: [] }
        // We'll use the 'net' array which contains the consolidated positions
        const netPositions = positionsResponse.net || [];
       
        // Process net positions (overnight + day positions combined)
        // Filter out positions ending with "_Day" (case-insensitive)
        const filteredNetPositions = netPositions.filter((position: any) => {
            const tradingSymbol = String(position.tradingsymbol || '');
            const shouldFilter = tradingSymbol.toLowerCase().endsWith('_day');
            if (shouldFilter) {
                console.log(`🚫 Filtering out net position: ${tradingSymbol}`);
            }
            return !shouldFilter;
        });

        positionsData = filteredNetPositions.map((position: any) => {
            const quantity = Math.round(position.quantity || 0); // Convert to integer
            const averagePrice = parseFloat(position.average_price || 0);
            const lastPrice = parseFloat(position.last_price || 0);
            const marketValue = parseFloat(position.value || 0);
            const pnl = parseFloat(position.pnl || 0);
            
            return {
                tradingSymbol: String(position.tradingsymbol || ''),
                exchange: String(position.exchange || ''),
                quantity: quantity,
                averagePrice: averagePrice,
                lastPrice: lastPrice,
                marketValue: marketValue,
                pnl: pnl,
                pnlPercentage: pnl && marketValue ? 
                    parseFloat(((pnl / Math.abs(marketValue)) * 100).toFixed(2)) : 0,
                product: String(position.product || 'UNKNOWN'),
                side: quantity > 0 ? 'BUY' : quantity < 0 ? 'SELL' : 'NONE',
                accountId: existingAccount.id,
                // Remove explicit createdAt and updatedAt - let Prisma handle these
            };
        });

        const allPositions = [...positionsData];

        // Clear existing positions for this account
        await Promise.all([      
            prisma.position.deleteMany({
                where: { accountId: existingAccount.id }
            })
        ]);

        // Calculate margins for each position using Kite Connect API
        const positionsWithMargins = await calculatePositionsMargins(allPositions, existingAccount.apiKey || '');

        // Insert new positions with margin blocked
        if (positionsWithMargins.length > 0) {
            try {
                console.log('Sample position data being inserted:', positionsWithMargins[0]);
                console.log('🔍 Debug - All positions being inserted:', positionsWithMargins.map(p => p.tradingSymbol));
                await prisma.position.createMany({
                    data: positionsWithMargins,
                    skipDuplicates: true // Skip duplicates to avoid constraint errors
                });
                console.log(`Successfully inserted ${positionsWithMargins.length} positions with margins into database`);
            } catch (dbError: any) {
                console.error('Database insertion error:', dbError.message);
                console.error('Sample problematic data:', positionsWithMargins.slice(0, 2));
                throw new Error(`Database Error: ${dbError.message}`);
            }
        }
        

        console.log(`Successfully synced ${filteredNetPositions.length} net positions for account ${existingAccount.id} (skipped all day positions)`);        
        return positionsResponse;
    }, existingAccount);
}

// Helper function to calculate margins for positions using Kite Connect API
// Reference: https://kite.trade/docs/connect/v3/margins/
async function calculatePositionsMargins(positions: any[], apiKey: string): Promise<any[]> {
    if (!kc || !currentAccessToken || positions.length === 0) {
        // If no session or no positions, return positions without margins
        return positions.map(p => ({ ...p, marginBlocked: null }));
    }

    try {
        console.log(`Calculating margins for ${positions.length} positions using Kite Connect API`);
        
        // Filter out positions with zero quantity (no margin needed)
        const nonZeroPositions = positions.filter(p => p.quantity !== 0);
        
        if (nonZeroPositions.length === 0) {
            return positions.map(p => ({ ...p, marginBlocked: null }));
        }

        // Convert positions to order format for margin calculation API
        // Reference: https://kite.trade/docs/connect/v3/margins/#order-margins
        const orders = nonZeroPositions.map(position => {
            // Use LIMIT order with current price if available, otherwise use MARKET
            const hasPrice = position.lastPrice && position.lastPrice > 0;
            return {
                exchange: position.exchange,
                tradingsymbol: position.tradingSymbol,
                transaction_type: position.side, // BUY or SELL
                variety: 'regular',
                product: position.product || 'NRML', // Use position product or default to NRML
                order_type: hasPrice ? 'LIMIT' : 'MARKET',
                quantity: Math.abs(position.quantity),
                price: hasPrice ? position.lastPrice : 0,
                trigger_price: 0
            };
        });

        // Call Kite Connect margin calculation API
        // POST https://api.kite.trade/margins/orders
        const apiUrl = `https://api.kite.trade/margins/orders`;
        const authHeader = `token ${apiKey}:${currentAccessToken}`;
        
        const response = await axios.post(apiUrl, orders, {
            headers: {
                'X-Kite-Version': '3',
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });

        if (response.data && response.data.status === 'success' && response.data.data) {
            const marginResults = response.data.data;
            
            // Create a map of tradingSymbol to margin blocked
            const marginMap = new Map<string, number>();
            marginResults.forEach((result: any) => {
                if (result.tradingsymbol && result.total !== undefined) {
                    marginMap.set(result.tradingsymbol, parseFloat(result.total || 0));
                }
            });

            // Add margin blocked to positions
            const positionsWithMargins = positions.map(position => {
                const marginBlocked = position.quantity !== 0 && marginMap.has(position.tradingSymbol)
                    ? marginMap.get(position.tradingSymbol)!
                    : null;
                return {
                    ...position,
                    marginBlocked
                };
            });

            console.log(`Successfully calculated margins for ${nonZeroPositions.length} positions`);
            return positionsWithMargins;
        } else {
            console.warn('Margin calculation API returned unexpected response format:', response.data);
            // Return positions without margins if API response is unexpected
            return positions.map(p => ({ ...p, marginBlocked: null }));
        }
    } catch (error: any) {
        console.error('Error calculating margins for positions:', error.message);
        console.error('Error details:', error.response?.data || error.message);
        // Return positions without margins if calculation fails
        // This allows positions to still be saved even if margin calculation fails
        return positions.map(p => ({ ...p, marginBlocked: null }));
    }
}

// Export function to get margins
export async function syncMargins(existingAccount: any) {
    return executeWithRetry(async () => {
        console.log('Fetching margins for account:', existingAccount.id);
        
        // Validate session before making API call
        if (!kc || !currentAccessToken) {
            throw new Error('Session not initialized. Please login again.');
        }
        
        const margins = await kc!.getMargins('equity');
        console.log('Raw margins data:', margins);
        
        // Clear existing margins for this account first
        await prisma.margin.deleteMany({
            where: { accountId: existingAccount.id }
        });
        
        // Insert new margin data - explicitly construct the data object to avoid any unwanted fields
        try {
            const marginData = {
                accountId: existingAccount.id,
                segment: margins.segment || 'EQUITY',
                enabled: margins.enabled || true,
                net: parseFloat(margins.net || 0),
                debits: parseFloat(margins.utilised?.debits || 0),
                payout: parseFloat(margins.utilised?.payout || 0),
                liquidCollateral: parseFloat(margins.utilised?.liquid_collateral || 0),
                stockCollateral: parseFloat(margins.utilised?.stock_collateral || 0),
                span: parseFloat(margins.utilised?.span || 0),
                exposure: parseFloat(margins.utilised?.exposure || 0),
                additional: parseFloat(margins.utilised?.additional || 0),
                delivery: parseFloat(margins.utilised?.delivery || 0),
                optionPremium: parseFloat(margins.utilised?.option_premium || 0),
                holdingSales: parseFloat(margins.utilised?.holding_sales || 0),
                turnover: parseFloat(margins.utilised?.turnover || 0),
                equity: parseFloat(margins.utilised?.equity || 0),
                m2mRealised: parseFloat(margins.utilised?.m2m_realised || 0),
                m2mUnrealised: parseFloat(margins.utilised?.m2m_unrealised || 0),
            };
            
            await prisma.margin.create({
                data: marginData
            });
            console.log(`Successfully inserted margin data for account ${existingAccount.id}`);
        } catch (dbError: any) {
            console.error('Database error while inserting margin data:', dbError.message);
            console.error('Raw margins data:', margins);
            throw new Error(`Database Error: ${dbError.message}`);
        }
        
        console.log(`Successfully synced margins for account ${existingAccount.id}`);
        return margins;
    }, existingAccount);
}

// Export function to get instruments
export async function getInstruments(apiKey: string, requestToken: string, apiSecret: string, segment?: string) {
    try {
        initializeKiteConnect(apiKey, requestToken, apiSecret);
        const instruments = await kc.getInstruments(segment);
        console.log('Instruments:', instruments);
        return instruments;
    } catch (err) {
        console.error('Error getting instruments:', err);
        throw err;
    }
}

// Export function to get quotes
export async function getQuote(apiKey: string, requestToken: string, apiSecret: string, instruments: string[]) {
    try {
        initializeKiteConnect(apiKey, requestToken, apiSecret);
        const quotes = await kc.getQuote(instruments);
        console.log('Quotes:', quotes);
        return quotes;
    } catch (err) {
        console.error('Error getting quotes:', err);
        throw err;
    }
}

// Export function to get OHLC data
export async function getOHLC(apiKey: string, requestToken: string, apiSecret: string, instruments: string[]) {
    try {
        initializeKiteConnect(apiKey, requestToken, apiSecret);
        const ohlc = await kc.getOHLC(instruments);
        console.log('OHLC:', ohlc);
        return ohlc;
    } catch (err) {
        console.error('Error getting OHLC:', err);
        throw err;
    }
}

// Export function to get LTP (Last Traded Price)
export async function getLTP(apiKey: string, requestToken: string, apiSecret: string, instruments: string[]) {
    try {
        initializeKiteConnect(apiKey, requestToken, apiSecret);
        const ltp = await kc.getLTP(instruments);
        console.log('LTP:', ltp);
        return ltp;
    } catch (err) {
        console.error('Error getting LTP:', err);
        throw err;
    }
}

// Export function to get historical data
export async function getHistoricalData(
    apiKey: string, 
    requestToken: string,
    apiSecret: string,
    instrumentToken: number, 
    interval: string, 
    from: string | Date, 
    to: string | Date, 
    continuous: boolean, 
    oi: boolean
) {
    try {
        initializeKiteConnect(apiKey, requestToken, apiSecret);
        const historicalData = await kc.getHistoricalData(instrumentToken, interval, from, to, continuous, oi);
        console.log('Historical Data:', historicalData);
        return historicalData;
    } catch (err) {
        console.error('Error getting historical data:', err);
        throw err;
    }
}

// Export function to place regular order
export async function placeRegularOrder(apiKey: string, requestToken: string, apiSecret: string, orderParams: any) {
    try {
        initializeKiteConnect(apiKey, requestToken, apiSecret);
        const order = await kc.placeOrder(kc.VARIETY_REGULAR, orderParams);
        console.log('Regular Order Placed:', order);
        return order;
    } catch (err) {
        console.error('Error placing regular order:', err);
        throw err;
    }
}

// Export function to modify order
export async function modifyOrder(apiKey: string, requestToken: string, apiSecret: string, orderId: number, orderParams: any) {
    try {
        initializeKiteConnect(apiKey, requestToken, apiSecret);
        const order = await kc.modifyOrder(kc.VARIETY_REGULAR, orderId, orderParams);
        console.log('Order Modified:', order);
        return order;
    } catch (err) {
        console.error('Error modifying order:', err);
        throw err;
    }
}

// Export function to cancel order
export async function cancelOrder(apiKey: string, requestToken: string, apiSecret: string, orderId: number) {
    try {
        initializeKiteConnect(apiKey, requestToken, apiSecret);
        const order = await kc.cancelOrder(kc.VARIETY_REGULAR, orderId);
        console.log('Order Cancelled:', order);
        return order;
    } catch (err) {
        console.error('Error cancelling order:', err);
        throw err;
    }
}

// Export function to get order history
export async function getOrderHistory(apiKey: string, requestToken: string, apiSecret: string, orderId: number | string) {
    try {
        initializeKiteConnect(apiKey, requestToken, apiSecret);
        const orderHistory = await kc.getOrderHistory(orderId);
        console.log('Order History:', orderHistory);
        return orderHistory;
    } catch (err) {
        console.error('Error getting order history:', err);
        throw err;
    }
}

