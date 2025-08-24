const express = require('express');
const router = express.Router();

/**
 * Patreon API Routes
 *
 * These routes handle Patreon integration through the child process manager
 */

// Middleware to ensure Patreon service is available
const ensurePatreonService = (req, res, next) => {
    if (!req.app.locals.patreonManager || !req.app.locals.patreonManager.isReady) {
        return res.status(503).json({
            error: 'Patreon service is not available',
            code: 'PATREON_SERVICE_UNAVAILABLE'
        });
    }
    next();
};

// OAuth Routes
router.get('/auth/url', ensurePatreonService, async (req, res) => {
    try {
        const scopes = req.query.scopes ? req.query.scopes.split(',') : ['identity', 'identity[email]', 'campaigns'];
        const authUrl = await req.app.locals.patreonManager.getAuthorizationUrl(scopes);

        res.json({
            success: true,
            authUrl,
            scopes
        });
    } catch (error) {
        console.error('Error generating Patreon auth URL:', error);
        res.status(500).json({
            error: 'Failed to generate authorization URL',
            message: error.message
        });
    }
});

router.post('/auth/token', ensurePatreonService, async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                error: 'Authorization code is required',
                code: 'MISSING_AUTH_CODE'
            });
        }

        const tokens = await req.app.locals.patreonManager.getTokens(code);

        // Store tokens in session
        req.session.patreonTokens = tokens;

        res.json({
            success: true,
            tokens: {
                access_token: tokens.access_token.substring(0, 20) + '...',
                expires_in: tokens.expires_in,
                scope: tokens.scope,
                token_type: tokens.token_type
            }
        });
    } catch (error) {
        console.error('Error exchanging Patreon auth code:', error);
        res.status(500).json({
            error: 'Failed to exchange authorization code',
            message: error.message
        });
    }
});

router.post('/auth/refresh', ensurePatreonService, async (req, res) => {
    try {
        const refreshToken = req.body.refresh_token || req.session.patreonTokens?.refresh_token;

        if (!refreshToken) {
            return res.status(400).json({
                error: 'Refresh token is required',
                code: 'MISSING_REFRESH_TOKEN'
            });
        }

        const tokens = await req.app.locals.patreonManager.refreshTokens(refreshToken);

        // Update session
        req.session.patreonTokens = tokens;

        res.json({
            success: true,
            tokens: {
                access_token: tokens.access_token.substring(0, 20) + '...',
                expires_in: tokens.expires_in,
                scope: tokens.scope,
                token_type: tokens.token_type
            }
        });
    } catch (error) {
        console.error('Error refreshing Patreon tokens:', error);
        res.status(500).json({
            error: 'Failed to refresh tokens',
            message: error.message
        });
    }
});

// API Routes - Require authentication
const requirePatreonAuth = (req, res, next) => {
    if (!req.session.patreonTokens?.access_token) {
        return res.status(401).json({
            error: 'Patreon authentication required',
            code: 'PATREON_AUTH_REQUIRED'
        });
    }
    next();
};

router.get('/user', ensurePatreonService, requirePatreonAuth, async (req, res) => {
    try {
        await req.app.locals.patreonManager.initializeAPI(req.session.patreonTokens.access_token);
        const user = await req.app.locals.patreonManager.getCurrentUser();

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error getting Patreon user:', error);
        res.status(500).json({
            error: 'Failed to get user information',
            message: error.message
        });
    }
});

router.get('/campaigns', ensurePatreonService, requirePatreonAuth, async (req, res) => {
    try {
        await req.app.locals.patreonManager.initializeAPI(req.session.patreonTokens.access_token);
        const campaigns = await req.app.locals.patreonManager.getCampaigns();

        res.json({
            success: true,
            campaigns
        });
    } catch (error) {
        console.error('Error getting Patreon campaigns:', error);
        res.status(500).json({
            error: 'Failed to get campaigns',
            message: error.message
        });
    }
});

router.get('/campaigns/:campaignId/members', ensurePatreonService, requirePatreonAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const options = {
            include: req.query.include ? req.query.include.split(',') : undefined,
            fields: req.query.fields ? JSON.parse(req.query.fields) : undefined,
            sort: req.query.sort,
            page: req.query.page ? { cursor: req.query.page } : undefined
        };

        await req.app.locals.patreonManager.initializeAPI(req.session.patreonTokens.access_token);
        const members = await req.app.locals.patreonManager.getCampaignMembers(campaignId, options);

        res.json({
            success: true,
            members
        });
    } catch (error) {
        console.error('Error getting Patreon campaign members:', error);
        res.status(500).json({
            error: 'Failed to get campaign members',
            message: error.message
        });
    }
});

router.get('/campaigns/:campaignId/posts', ensurePatreonService, requirePatreonAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const options = {
            include: req.query.include ? req.query.include.split(',') : undefined,
            fields: req.query.fields ? JSON.parse(req.query.fields) : undefined,
            sort: req.query.sort,
            page: req.query.page ? { cursor: req.query.page } : undefined
        };

        await req.app.locals.patreonManager.initializeAPI(req.session.patreonTokens.access_token);
        const posts = await req.app.locals.patreonManager.getCampaignPosts(campaignId, options);

        res.json({
            success: true,
            posts
        });
    } catch (error) {
        console.error('Error getting Patreon campaign posts:', error);
        res.status(500).json({
            error: 'Failed to get campaign posts',
            message: error.message
        });
    }
});

// Webhook endpoint
router.post('/webhooks/patreon', ensurePatreonService, express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['x-patreon-signature'];
        const event = req.headers['x-patreon-event'];
        const body = req.body;

        if (!signature) {
            return res.status(400).json({
                error: 'Missing webhook signature',
                code: 'MISSING_SIGNATURE'
            });
        }

        // Verify webhook signature
        const isValid = await req.app.locals.patreonManager.verifyWebhook(signature, body);

        if (!isValid) {
            return res.status(401).json({
                error: 'Invalid webhook signature',
                code: 'INVALID_SIGNATURE'
            });
        }

        // Process webhook
        const webhookData = await req.app.locals.patreonManager.processWebhook(body, signature, event);

        res.json({
            success: true,
            processed: true,
            event: event
        });
    } catch (error) {
        console.error('Error processing Patreon webhook:', error);
        res.status(500).json({
            error: 'Failed to process webhook',
            message: error.message
        });
    }
});

// Health check
router.get('/health', ensurePatreonService, async (req, res) => {
    try {
        const pong = await req.app.locals.patreonManager.ping();

        res.json({
            success: true,
            status: 'healthy',
            pong,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Status endpoint
router.get('/status', (req, res) => {
    const patreonManager = req.app.locals.patreonManager;

    res.json({
        success: true,
        status: {
            available: !!patreonManager,
            ready: patreonManager?.isReady || false,
            restartCount: patreonManager?.restartCount || 0,
            maxRestarts: patreonManager?.maxRestarts || 0
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
