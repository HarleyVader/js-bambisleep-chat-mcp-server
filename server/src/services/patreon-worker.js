#!/usr/bin/env node

/**
 * Patreon Worker Process (CommonJS Wrapper)
 *
 * This worker runs as a child process and handles Patreon API operations
 * without running its own HTTP server. It communicates with the parent
 * process via IPC (Inter-Process Communication).
 */

const { config } = require('dotenv');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Load environment variables from the server's .env file
config({ path: path.join(__dirname, '../../../.env') });

if (!process.send) {
    console.error('This process must be spawned as a child process with IPC enabled');
    console.error('Gracefully shutting down...');

    // Attempt graceful shutdown
    process.on('exit', () => {
        console.log('Patreon worker process exiting...');
    });

    setTimeout(() => {
        process.exit(1);
    }, 1000);
    return;
}

// Simple IPC message handler that translates requests to REST API calls
class PatreonWorkerWrapper {
    constructor() {
        this.pendingRequests = new Map();
        this.messageId = 0;
        this.setupIPCHandlers();
    }

    setupIPCHandlers() {
        process.on('message', async (message) => {
            try {
                await this.handleMessage(message);
            } catch (error) {
                this.sendError(message.id, error);
            }
        });

        // Send ready signal to parent
        this.sendToParent('ready', { pid: process.pid });
    }

    async handleMessage(message) {
        const { id, type, data } = message;

        switch (type) {
            case 'oauth:authorize': {
                // For OAuth authorize, we can construct the URL directly
                const clientId = process.env.PATREON_CLIENT_ID;
                const redirectUri = encodeURIComponent(process.env.PATREON_REDIRECT_URI || '');
                const scopes = (data.scopes || ['identity']).join(' ');
                const authUrl = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes}`;
                this.sendResponse(id, { authUrl });
                break;
            }

            case 'oauth:token': {
                // Handle token exchange via direct HTTP calls
                const response = await this.exchangeCodeForTokens(data.code);
                this.sendResponse(id, { tokens: response });
                break;
            }

            case 'oauth:refresh': {
                // Handle token refresh via direct HTTP calls
                const response = await this.refreshTokens(data.refreshToken);
                this.sendResponse(id, { tokens: response });
                break;
            }

            case 'api:init': {
                // API client initialization is just storing the token
                this.accessToken = data.accessToken;
                this.sendResponse(id, { success: true });
                break;
            }

            case 'api:getCurrentUser': {
                if (!this.accessToken) {
                    throw new Error('API client not initialized');
                }
                const user = await this.makePatreonAPICall('/api/oauth2/v2/identity?include=memberships&fields%5Buser%5D=email,first_name,full_name,image_url,last_name,social_connections,thumb_url,url,vanity');
                this.sendResponse(id, { user });
                break;
            }

            case 'api:getCampaigns': {
                if (!this.accessToken) {
                    throw new Error('API client not initialized');
                }
                const campaigns = await this.makePatreonAPICall('/api/oauth2/v2/campaigns');
                this.sendResponse(id, { campaigns });
                break;
            }

            case 'api:getCampaignMembers': {
                if (!this.accessToken) {
                    throw new Error('API client not initialized');
                }
                const members = await this.makePatreonAPICall(`/api/oauth2/v2/campaigns/${data.campaignId}/members`);
                this.sendResponse(id, { members });
                break;
            }

            case 'api:getCampaignPosts': {
                if (!this.accessToken) {
                    throw new Error('API client not initialized');
                }
                const posts = await this.makePatreonAPICall(`/api/oauth2/v2/campaigns/${data.campaignId}/posts`);
                this.sendResponse(id, { posts });
                break;
            }

            case 'webhook:verify': {
                const isValid = this.verifyWebhookSignature(data.body, data.signature);
                this.sendResponse(id, { isValid });
                break;
            }

            case 'webhook:process': {
                // Basic webhook processing
                const webhookData = JSON.parse(data.body);
                this.sendResponse(id, { webhookData });
                break;
            }

            case 'ping': {
                this.sendResponse(id, { pong: true, timestamp: Date.now() });
                break;
            }

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    }

    async exchangeCodeForTokens(code) {
        const params = new URLSearchParams({
            code,
            grant_type: 'authorization_code',
            client_id: process.env.PATREON_CLIENT_ID,
            client_secret: process.env.PATREON_CLIENT_SECRET,
            redirect_uri: process.env.PATREON_REDIRECT_URI
        });

        return new Promise((resolve, reject) => {
            const postData = params.toString();
            const options = {
                hostname: 'www.patreon.com',
                path: '/api/oauth2/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    } else {
                        reject(new Error(`Token exchange failed: ${res.statusCode} ${res.statusMessage}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    async refreshTokens(refreshToken) {
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: process.env.PATREON_CLIENT_ID,
            client_secret: process.env.PATREON_CLIENT_SECRET
        });

        return new Promise((resolve, reject) => {
            const postData = params.toString();
            const options = {
                hostname: 'www.patreon.com',
                path: '/api/oauth2/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    } else {
                        reject(new Error(`Token refresh failed: ${res.statusCode} ${res.statusMessage}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    async makePatreonAPICall(endpoint) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'www.patreon.com',
                path: endpoint,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'User-Agent': process.env.PATREON_USER_AGENT || 'BambiSleep-Chat-Patreon/1.0.0'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    } else {
                        reject(new Error(`API call failed: ${res.statusCode} ${res.statusMessage}`));
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });
    }

    verifyWebhookSignature(body, signature) {
        const secret = process.env.PATREON_WEBHOOK_SECRET || 'default-secret';
        const expectedSignature = crypto.createHmac('md5', secret).update(body).digest('hex');
        return signature === expectedSignature;
    }

    sendResponse(id, data) {
        this.sendToParent('response', { id, data });
    }

    sendError(id, error) {
        this.sendToParent('error', {
            id,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            }
        });
    }

    sendToParent(type, data) {
        if (process.send) {
            process.send({ type, data, timestamp: Date.now() });
        }
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Patreon worker received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Patreon worker received SIGINT, shutting down gracefully...');
    process.exit(0);
});

// Initialize worker
new PatreonWorkerWrapper();
