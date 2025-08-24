/**
 * BambiSleep Chat Patreon Integration
 *
 * A comprehensive library for integrating with the Patreon API v2.
 * Provides OAuth authentication, API client operations, and secure webhook handling.
 */

// Core API Client
const { PatreonAPIClient } = require('./api/client');

// OAuth Authentication
const { PatreonOAuth, TokenManager, PatreonAPIError } = require('./auth/oauth');

// Webhook Handler
const { PatreonWebhookHandler, createWebhookMiddleware } = require('./webhooks/handler');

// Version info
const VERSION = '1.0.0';

module.exports = {
    PatreonAPIClient,
    PatreonOAuth,
    TokenManager,
    PatreonAPIError,
    PatreonWebhookHandler,
    createWebhookMiddleware,
    VERSION
};
