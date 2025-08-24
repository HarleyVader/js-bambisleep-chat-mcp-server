/**
 * Patreon API v2 Client Implementation
 *
 * Comprehensive client for interacting with all Patreon API v2 endpoints
 * Features:
 * - Complete endpoint coverage
 * - Rate limiting with retry logic
 * - Automatic token refresh
 * - Error handling
 *
 * Based on official Patreon API v2 documentation
 */

const axios = require('axios');
const { PatreonAPIError } = require('../auth/oauth');

class PatreonAPIClient {
    constructor(config = {}) {
        this.userAgent = config.userAgent || 'BambiSleep-Chat-Patreon/1.0.0';
        this.retryAttempts = config.retryAttempts || 3;
        this.retryDelay = config.retryDelay || 1000;
        this.rateLimitInfo = null;
        this.tokenManager = null;

        this.axios = axios.create({
            baseURL: config.baseURL || 'https://www.patreon.com/api/oauth2/v2',
            timeout: config.timeout || 30000,
            headers: {
                'User-Agent': this.userAgent,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });

        // Set access token if provided
        if (config.accessToken) {
            this.setAccessToken(config.accessToken);
        }

        // Setup request/response interceptors
        this.setupInterceptors();
    }

    /**
     * Set access token for API requests
     */
    setAccessToken(token) {
        this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    /**
     * Set token manager for automatic token refresh
     */
    setTokenManager(tokenManager) {
        this.tokenManager = tokenManager;
    }

    /**
     * Setup axios interceptors for error handling and rate limiting
     */
    setupInterceptors() {
        // Request interceptor - add token if available
        this.axios.interceptors.request.use(
            async (config) => {
                if (this.tokenManager) {
                    try {
                        const token = await this.tokenManager.getAccessToken();
                        config.headers = config.headers || {};
                        config.headers['Authorization'] = `Bearer ${token}`;
                    } catch (error) {
                        console.warn('Failed to get access token:', error);
                    }
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor - handle rate limits and errors
        this.axios.interceptors.response.use(
            (response) => {
                this.updateRateLimitInfo(response.headers);
                return response;
            },
            (error) => {
                this.updateRateLimitInfo(error.response?.headers);
                return Promise.reject(this.handleAPIError(error));
            }
        );
    }

    /**
     * Update rate limit information from response headers
     */
    updateRateLimitInfo(headers = {}) {
        // Patreon doesn't provide specific rate limit headers
        // This is a placeholder for future implementation
        this.rateLimitInfo = {
            requestsRemaining: 100,
            resetTime: new Date(Date.now() + 60000), // 1 minute from now
        };
    }

    /**
     * Handle API errors with enhanced error information
     */
    handleAPIError(error) {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            let message = `API Error ${status}`;
            let code;
            let details;
            let retryAfterSeconds;

            if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
                const firstError = data.errors[0];
                message = firstError.title || firstError.detail || message;
                code = firstError.code || firstError.code_name;
                details = firstError.detail;
                retryAfterSeconds = firstError.retry_after_seconds;
            }

            return new PatreonAPIError(message, status, code, details, retryAfterSeconds);
        }

        if (error.request) {
            return new PatreonAPIError('Network error', 0);
        }

        return new PatreonAPIError(error.message, 500);
    }

    /**
     * Make a request with retry logic and rate limiting
     */
    async makeRequest(config, context = {}) {
        const requestContext = {
            endpoint: config.url || 'unknown',
            method: config.method || 'GET',
            attempt: 0,
            startTime: Date.now(),
            ...context,
        };

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            requestContext.attempt = attempt;

            try {
                const response = await this.axios.request(config);
                return response.data;
            } catch (error) {
                // Don't retry on non-retryable errors
                if (error.status < 500 && error.status !== 429) {
                    throw error;
                }

                // Don't retry on last attempt
                if (attempt === this.retryAttempts) {
                    throw error;
                }

                // Calculate delay for retry
                let delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff

                if (error.retryAfterSeconds) {
                    delay = error.retryAfterSeconds * 1000;
                }

                console.warn(
                    `Request to ${requestContext.endpoint} failed (attempt ${attempt}/${this.retryAttempts}). ` +
                    `Retrying in ${delay}ms. Error: ${error.message}`
                );

                await this.sleep(delay);
            }
        }

        throw new PatreonAPIError('Max retry attempts exceeded', 500);
    }

    /**
     * Sleep utility for retry delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Build query string from parameters
     */
    buildQueryString(params) {
        const entries = [];

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (key === 'fields' && typeof value === 'object') {
                    // Handle fields parameter specially for sparse fieldsets
                    const fieldsParams = PatreonAPIClient.buildFieldsParam(value);
                    Object.entries(fieldsParams).forEach(([fieldKey, fieldValue]) => {
                        entries.push(`${encodeURIComponent(fieldKey)}=${encodeURIComponent(fieldValue)}`);
                    });
                } else if (Array.isArray(value)) {
                    entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(value.join(','))}`);
                } else {
                    entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
                }
            }
        });

        return entries.join('&');
    }

    /**
     * Build fields parameter for sparse fieldsets
     */
    static buildFieldsParam(fields) {
        const result = {};

        Object.entries(fields).forEach(([resourceType, fieldList]) => {
            result[`fields[${resourceType}]`] = fieldList.join(',');
        });

        return result;
    }

    // ============================================================================
    // Identity Endpoints
    // ============================================================================

    /**
     * Get current user identity
     *
     * @param {Object} params - Query parameters for fields and includes
     * @returns {Promise<Object>} Promise resolving to user data
     */
    async getCurrentUser(params = {}) {
        const queryString = this.buildQueryString(params);
        const url = `/identity${queryString ? `?${queryString}` : ''}`;
        
        console.log('🔍 Patreon API URL:', `https://www.patreon.com/api/oauth2/v2${url}`);
        console.log('🔍 Query params:', params);
        console.log('🔍 Query string:', queryString);

        return this.makeRequest({
            method: 'GET',
            url,
        });
    }

    // ============================================================================
    // Campaign Endpoints
    // ============================================================================

    /**
     * Get campaigns owned by the current user
     *
     * @param {Object} params - Query parameters for fields, includes, and pagination
     * @returns {Promise<Object>} Promise resolving to campaigns data
     */
    async getCampaigns(params = {}) {
        const queryString = this.buildQueryString(params);
        const url = `/campaigns${queryString ? `?${queryString}` : ''}`;

        return this.makeRequest({
            method: 'GET',
            url,
        });
    }

    /**
     * Get a specific campaign by ID
     *
     * @param {string} campaignId - The campaign ID
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Promise resolving to campaign data
     */
    async getCampaign(campaignId, params = {}) {
        const queryString = this.buildQueryString(params);
        const url = `/campaigns/${campaignId}${queryString ? `?${queryString}` : ''}`;

        return this.makeRequest({
            method: 'GET',
            url,
        });
    }

    // ============================================================================
    // Member Endpoints
    // ============================================================================

    /**
     * Get members for a campaign
     *
     * @param {string} campaignId - The campaign ID
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Promise resolving to members data
     */
    async getCampaignMembers(campaignId, params = {}) {
        const queryString = this.buildQueryString(params);
        const url = `/campaigns/${campaignId}/members${queryString ? `?${queryString}` : ''}`;

        return this.makeRequest({
            method: 'GET',
            url,
        });
    }

    /**
     * Get a specific member by ID
     *
     * @param {string} memberId - The member ID
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Promise resolving to member data
     */
    async getMember(memberId, params = {}) {
        const queryString = this.buildQueryString(params);
        const url = `/members/${memberId}${queryString ? `?${queryString}` : ''}`;

        return this.makeRequest({
            method: 'GET',
            url,
        });
    }

    // ============================================================================
    // Post Endpoints
    // ============================================================================

    /**
     * Get posts for a campaign
     *
     * @param {string} campaignId - The campaign ID
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Promise resolving to posts data
     */
    async getCampaignPosts(campaignId, params = {}) {
        const queryString = this.buildQueryString(params);
        const url = `/campaigns/${campaignId}/posts${queryString ? `?${queryString}` : ''}`;

        return this.makeRequest({
            method: 'GET',
            url,
        });
    }

    /**
     * Get a specific post by ID
     *
     * @param {string} postId - The post ID
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Promise resolving to post data
     */
    async getPost(postId, params = {}) {
        const queryString = this.buildQueryString(params);
        const url = `/posts/${postId}${queryString ? `?${queryString}` : ''}`;

        return this.makeRequest({
            method: 'GET',
            url,
        });
    }

    // ============================================================================
    // Webhook Endpoints
    // ============================================================================

    /**
     * Get webhooks for a campaign
     *
     * @param {string} campaignId - The campaign ID
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Promise resolving to webhooks data
     */
    async getCampaignWebhooks(campaignId, params = {}) {
        const queryString = this.buildQueryString(params);
        const url = `/campaigns/${campaignId}/webhooks${queryString ? `?${queryString}` : ''}`;

        return this.makeRequest({
            method: 'GET',
            url,
        });
    }

    /**
     * Create a new webhook
     *
     * @param {string} campaignId - The campaign ID
     * @param {Object} webhookData - Webhook configuration
     * @returns {Promise<Object>} Promise resolving to created webhook
     */
    async createWebhook(campaignId, webhookData) {
        return this.makeRequest({
            method: 'POST',
            url: `/campaigns/${campaignId}/webhooks`,
            data: webhookData,
        });
    }

    /**
     * Update a webhook
     *
     * @param {string} webhookId - The webhook ID
     * @param {Object} webhookData - Updated webhook configuration
     * @returns {Promise<Object>} Promise resolving to updated webhook
     */
    async updateWebhook(webhookId, webhookData) {
        return this.makeRequest({
            method: 'PATCH',
            url: `/webhooks/${webhookId}`,
            data: webhookData,
        });
    }

    /**
     * Delete a webhook
     *
     * @param {string} webhookId - The webhook ID
     * @returns {Promise<void>} Promise resolving when webhook is deleted
     */
    async deleteWebhook(webhookId) {
        return this.makeRequest({
            method: 'DELETE',
            url: `/webhooks/${webhookId}`,
        });
    }

    /**
     * Get rate limit information
     * @returns {Object|null} Current rate limit info
     */
    getRateLimitInfo() {
        return this.rateLimitInfo;
    }
}

module.exports = {
    PatreonAPIClient
};
