/**
 * Patreon Webhook Handler
 *
 * Secure webhook processing with signature verification and event handling
 * Supports all Patreon webhook events
 *
 * Based on Patreon API v2 webhook documentation
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

class PatreonWebhookHandler extends EventEmitter {
    constructor(config) {
        super();
        this.secret = config.secret;

        if (!this.secret) {
            throw new Error('Webhook secret is required');
        }
    }

    /**
     * Process incoming webhook request
     *
     * @param {string|Buffer} body - Raw request body as string or buffer
     * @param {string} signature - X-Patreon-Signature header value
     * @param {string} event - X-Patreon-Event header value (optional)
     * @returns {Promise<Object>} Promise resolving to processed webhook event
     */
    async processWebhook(body, signature, event) {
        const bodyString = typeof body === 'string' ? body : body.toString('utf8');

        // Verify signature
        if (!this.verifySignature(bodyString, signature)) {
            throw new Error('Invalid webhook signature');
        }

        // Parse payload
        let payload;
        try {
            payload = JSON.parse(bodyString);
        } catch {
            throw new Error('Invalid JSON payload');
        }

        // Validate and extract webhook data
        const webhookEvent = this.parseWebhookPayload(payload, signature, event);

        // Emit event
        this.emit(webhookEvent.trigger, webhookEvent);
        this.emit('*', webhookEvent);

        return webhookEvent;
    }

    /**
     * Verify webhook signature using HMAC-MD5
     *
     * @param {string} body - Raw request body
     * @param {string} signature - Signature from header
     * @returns {boolean} True if signature is valid
     */
    verifySignature(body, signature) {
        try {
            const expectedSignature = crypto
                .createHmac('md5', this.secret)
                .update(body, 'utf8')
                .digest('hex');

            // Use timing-safe comparison
            return this.timingSafeEqual(signature, expectedSignature);
        } catch (err) {
            console.error('Error verifying signature:', err);
            return false;
        }
    }

    /**
     * Parse and validate webhook payload
     */
    parseWebhookPayload(payload, signature, eventHeader) {
        // Extract main data
        if (!payload.data || typeof payload.data !== 'object') {
            throw new Error('Invalid webhook payload: missing data field');
        }

        const data = payload.data;

        if (typeof data.type !== 'string' || typeof data.id !== 'string') {
            throw new Error('Invalid webhook payload: invalid data structure');
        }

        // Determine trigger from data type or header
        let trigger;

        if (eventHeader) {
            trigger = eventHeader;
        } else {
            // Infer trigger from data type (fallback)
            trigger = this.inferTriggerFromData(data);
        }

        // Validate trigger
        if (!this.isValidTrigger(trigger)) {
            throw new Error(`Invalid webhook trigger: ${trigger}`);
        }

        // Extract included resources
        const included = Array.isArray(payload.included)
            ? payload.included
            : undefined;

        return {
            trigger,
            data,
            included,
            rawPayload: payload,
            signature,
            timestamp: new Date(),
        };
    }

    /**
     * Infer webhook trigger from data type (fallback method)
     */
    inferTriggerFromData(data) {
        switch (data.type) {
            case 'member':
                return 'members:update'; // Default for member events
            case 'post':
                return 'posts:publish'; // Default for post events
            default:
                throw new Error(`Cannot infer trigger from data type: ${data.type}`);
        }
    }

    /**
     * Validate webhook trigger
     */
    isValidTrigger(trigger) {
        const validTriggers = [
            'members:create',
            'members:update',
            'members:delete',
            'members:pledge:create',
            'members:pledge:update',
            'members:pledge:delete',
            'posts:publish',
            'posts:update',
            'posts:delete',
        ];

        return validTriggers.includes(trigger);
    }

    /**
     * Timing-safe string comparison to prevent timing attacks
     */
    timingSafeEqual(a, b) {
        if (a.length !== b.length) {
            return false;
        }

        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }

        return result === 0;
    }

    /**
     * Get human-readable description of webhook trigger
     */
    static getTriggerDescription(trigger) {
        const descriptions = {
            'members:create': 'A new member joined the campaign',
            'members:update': 'A member updated their membership',
            'members:delete': 'A member left the campaign',
            'members:pledge:create': 'A member created a new pledge',
            'members:pledge:update': 'A member updated their pledge',
            'members:pledge:delete': 'A member deleted their pledge',
            'posts:publish': 'A new post was published',
            'posts:update': 'A post was updated',
            'posts:delete': 'A post was deleted',
        };

        return descriptions[trigger] || 'Unknown event';
    }

    /**
     * Extract member data from webhook event
     */
    static extractMemberData(event) {
        if (event.data.type === 'member') {
            return event.data;
        }
        return null;
    }

    /**
     * Extract post data from webhook event
     */
    static extractPostData(event) {
        if (event.data.type === 'post') {
            return event.data;
        }
        return null;
    }
}

/**
 * Create Express middleware for webhook processing
 *
 * @param {PatreonWebhookHandler} handler - The webhook handler instance
 * @returns {Function} Express middleware function
 */
function createWebhookMiddleware(handler) {
    return async (req, res, next) => {
        try {
            const signature = req.headers['x-patreon-signature'];
            const event = req.headers['x-patreon-event'];

            if (!signature) {
                return res.status(400).json({
                    error: 'Missing X-Patreon-Signature header'
                });
            }

            // Ensure we have the raw body
            let body;
            if (req.rawBody) {
                body = req.rawBody;
            } else if (req.body) {
                body = Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
            } else {
                return res.status(400).json({
                    error: 'No body provided'
                });
            }

            await handler.processWebhook(body, signature, event);

            res.status(200).json({
                message: 'Webhook processed successfully',
                event: event || 'unknown',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Webhook processing error:', error);
            res.status(400).json({
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    };
}

module.exports = {
    PatreonWebhookHandler,
    createWebhookMiddleware
};
