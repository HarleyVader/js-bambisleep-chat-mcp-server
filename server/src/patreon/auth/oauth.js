/**
 * Patreon OAuth 2.0 Authentication Implementation
 *
 * Handles the complete OAuth flow for Patreon API authentication including:
 * - Authorization URL generation
 * - Token exchange
 * - Token refresh
 * - Scope management
 *
 * Based on Patreon API v2 OAuth documentation
 */

const axios = require('axios');

/**
 * Custom error class for Patreon API errors
 */
class PatreonAPIError extends Error {
    constructor(message, status, code, details, retryAfterSeconds) {
        super(message);
        this.name = 'PatreonAPIError';
        this.status = status;
        this.code = code;
        this.details = details;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

/**
 * Utility function to create URL search params string
 */
function createUrlParams(params) {
    return Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
}

class PatreonOAuth {
    constructor(config) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
        this.baseURL = 'https://www.patreon.com';
        this.userAgent = config.userAgent || 'BambiSleep-Chat-Patreon/1.0.0';

        if (!this.clientId || !this.clientSecret || !this.redirectUri) {
            throw new Error('OAuth configuration missing required parameters');
        }
    }

    /**
     * Generate the authorization URL for OAuth flow
     *
     * @param {string[]} scopes - Array of Patreon scopes to request
     * @param {string} state - CSRF protection state parameter
     * @returns {string} Authorization URL for redirecting users
     */
    getAuthorizationUrl(scopes = ['identity', 'campaigns'], state) {
        const paramsObj = {
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            scope: scopes.join(' '),
        };

        if (state) {
            paramsObj.state = state;
        }

        const params = createUrlParams(paramsObj);
        return `${this.baseURL}/oauth2/authorize?${params}`;
    }

    /**
     * Exchange authorization code for access tokens
     *
     * @param {string} code - Authorization code from OAuth callback
     * @returns {Promise<Object>} Promise resolving to token response
     */
    async getTokens(code) {
        try {
            const paramsObj = {
                code,
                grant_type: 'authorization_code',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: this.redirectUri,
            };

            const params = createUrlParams(paramsObj);

            const response = await axios.post(
                `${this.baseURL}/api/oauth2/token`,
                params,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': this.userAgent,
                    },
                    timeout: 30000,
                }
            );

            return this.validateTokenResponse(response.data);
        } catch (error) {
            throw this.handleOAuthError(error, 'Failed to exchange code for tokens');
        }
    }

    /**
     * Refresh access token using refresh token
     *
     * @param {string} refreshToken - The refresh token to use
     * @returns {Promise<Object>} Promise resolving to new token response
     */
    async refreshTokens(refreshToken) {
        try {
            const paramsObj = {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: this.clientId,
                client_secret: this.clientSecret,
            };

            const params = createUrlParams(paramsObj);

            const response = await axios.post(
                `${this.baseURL}/api/oauth2/token`,
                params,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': this.userAgent,
                    },
                    timeout: 30000,
                }
            );

            return this.validateTokenResponse(response.data);
        } catch (error) {
            throw this.handleOAuthError(error, 'Failed to refresh tokens');
        }
    }

    /**
     * Validate and type-check token response
     */
    validateTokenResponse(data) {
        if (!data || typeof data !== 'object') {
            throw new PatreonAPIError('Invalid token response format', 500);
        }

        if (
            typeof data.access_token !== 'string' ||
            typeof data.refresh_token !== 'string' ||
            typeof data.expires_in !== 'number' ||
            typeof data.scope !== 'string' ||
            data.token_type !== 'Bearer'
        ) {
            throw new PatreonAPIError('Invalid token response structure', 500);
        }

        return {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in,
            scope: data.scope,
            token_type: data.token_type,
        };
    }

    /**
     * Handle OAuth-specific errors with enhanced error information
     */
    handleOAuthError(error, context) {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data || {};

            let message = context;
            let code;
            let details;

            if (data.error) {
                message = `${context}: ${data.error}`;
                code = data.error;
            }

            if (data.error_description) {
                details = data.error_description;
            }

            return new PatreonAPIError(message, status, code, details);
        }

        return new PatreonAPIError(`${context}: ${error.message}`, 500);
    }
}

/**
 * Token manager for handling token storage and refresh
 */
class TokenManager {
    constructor() {
        this.tokens = new Map();
    }

    /**
     * Store tokens for a user
     */
    storeTokens(userId, tokens) {
        this.tokens.set(userId, {
            ...tokens,
            expires_at: Date.now() + (tokens.expires_in * 1000)
        });
    }

    /**
     * Get tokens for a user
     */
    getTokens(userId) {
        return this.tokens.get(userId);
    }

    /**
     * Check if tokens are expired
     */
    isExpired(userId) {
        const tokenData = this.tokens.get(userId);
        if (!tokenData) return true;
        return Date.now() >= tokenData.expires_at;
    }

    /**
     * Remove tokens for a user
     */
    removeTokens(userId) {
        this.tokens.delete(userId);
    }
}

module.exports = {
    PatreonOAuth,
    TokenManager,
    PatreonAPIError
};
