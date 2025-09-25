const speakeasy = require('speakeasy');

/**
 * Generate TOTP (Time-based One-Time Password) using secret key
 * @param {string} secret - The base32 encoded secret key from your authenticator app
 * @returns {string} - 6-digit TOTP code
 */
function generateTOTP(secret) {
    try {
        // Generate TOTP token
        const token = speakeasy.totp({
            secret: secret,
            encoding: 'base32',
            time: Math.floor(Date.now() / 1000), // Current time in seconds
            step: 30, // 30-second time step
            window: 1 // Allow 1 time step variance
        });
        
        return token;
    } catch (error) {
        console.error('Error generating TOTP:', error.message);
        throw error;
    }
}

/**
 * Get the remaining time until the next TOTP change
 * @returns {number} - Seconds remaining until next TOTP
 */
function getTimeRemaining() {
    const now = Math.floor(Date.now() / 1000);
    const timeStep = 30;
    const remaining = timeStep - (now % timeStep);
    return remaining;
}

/**
 * Generate TOTP with time remaining information
 * @param {string} secret - The base32 encoded secret key
 * @returns {object} - Object containing TOTP and time remaining
 */
function generateTOTPWithInfo(secret) {
    const totp = generateTOTP(secret);
    const timeRemaining = getTimeRemaining();
    
    return {
        totp: totp,
        timeRemaining: timeRemaining,
        expiresAt: new Date(Date.now() + (timeRemaining * 1000))
    };
}

module.exports = {
    generateTOTP,
    generateTOTPWithInfo,
    getTimeRemaining
};
