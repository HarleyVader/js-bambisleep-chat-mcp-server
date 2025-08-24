const { spawn, fork } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Patreon Process Manager
 *
 * Manages a child process for Patreon operations and provides
 * a clean API for the main server to interact with Patreon services.
 */
class PatreonProcessManager extends EventEmitter {
    constructor() {
        super();
        this.worker = null;
        this.isReady = false;
        this.messageId = 0;
        this.pendingMessages = new Map();
        this.restartCount = 0;
        this.maxRestarts = 3;
        this.setupProcessCleanup();
    }

    /**
     * Setup process cleanup handlers
     */
    setupProcessCleanup() {
        const cleanup = () => {
            console.log('🧹 Cleaning up Patreon worker process...');
            if (this.worker) {
                this.worker.kill('SIGTERM');
                setTimeout(() => {
                    if (this.worker) {
                        this.worker.kill('SIGKILL');
                    }
                }, 2000);
            }
        };

        process.on('SIGTERM', cleanup);
        process.on('SIGINT', cleanup);
        process.on('exit', cleanup);
    }

    /**
     * Start the Patreon worker process
     */
    async start() {
        return new Promise((resolve, reject) => {
            try {
                const workerPath = path.join(__dirname, './patreon-worker.js');

                this.worker = fork(workerPath, [], {
                    cwd: path.join(__dirname, '../../../'),
                    env: { ...process.env },
                    silent: false
                });

                this.worker.on('message', (message) => {
                    this.handleWorkerMessage(message);
                });

                this.worker.on('error', (error) => {
                    console.error('Patreon worker error:', error);
                    this.emit('error', error);
                    reject(error);
                });

                this.worker.on('exit', (code, signal) => {
                    console.log(`Patreon worker exited with code ${code} and signal ${signal}`);
                    this.isReady = false;

                    if (code !== 0 && this.restartCount < this.maxRestarts) {
                        console.log(`Restarting Patreon worker (attempt ${this.restartCount + 1}/${this.maxRestarts})`);
                        this.restartCount++;
                        setTimeout(() => this.start(), 1000);
                    } else {
                        this.emit('exit', code, signal);
                    }
                });

                // Wait for ready signal
                this.once('ready', () => {
                    this.isReady = true;
                    this.restartCount = 0;
                    resolve();
                });

                // Timeout if worker doesn't start
                setTimeout(() => {
                    if (!this.isReady) {
                        reject(new Error('Patreon worker failed to start within timeout'));
                    }
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Stop the Patreon worker process
     */
    async stop() {
        if (this.worker) {
            this.worker.kill('SIGTERM');

            // Wait for graceful shutdown or force kill after timeout
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    if (this.worker) {
                        this.worker.kill('SIGKILL');
                    }
                    resolve();
                }, 5000);

                this.worker.once('exit', () => {
                    clearTimeout(timeout);
                    this.worker = null;
                    this.isReady = false;
                    resolve();
                });
            });
        }
    }

    /**
     * Send message to worker and get response
     */
    async sendMessage(type, data = {}) {
        if (!this.isReady || !this.worker) {
            throw new Error('Patreon worker is not ready');
        }

        return new Promise((resolve, reject) => {
            const id = (++this.messageId).toString();

            this.pendingMessages.set(id, { resolve, reject });

            this.worker.send({ id, type, data });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingMessages.has(id)) {
                    this.pendingMessages.delete(id);
                    reject(new Error(`Message timeout: ${type}`));
                }
            }, 30000);
        });
    }

    /**
     * Handle messages from worker
     */
    handleWorkerMessage(message) {
        const { type, data } = message;

        switch (type) {
            case 'ready':
                console.log('Patreon worker is ready, PID:', data.pid);
                this.emit('ready');
                break;

            case 'response':
                if (this.pendingMessages.has(data.id)) {
                    const { resolve } = this.pendingMessages.get(data.id);
                    this.pendingMessages.delete(data.id);
                    resolve(data.data);
                }
                break;

            case 'error':
                if (this.pendingMessages.has(data.id)) {
                    const { reject } = this.pendingMessages.get(data.id);
                    this.pendingMessages.delete(data.id);
                    const error = new Error(data.error.message);
                    error.stack = data.error.stack;
                    error.name = data.error.name;
                    reject(error);
                }
                break;

            case 'webhook':
                this.emit('webhook', data);
                break;

            default:
                console.log('Unknown message type from Patreon worker:', type);
        }
    }

    // OAuth methods
    async getAuthorizationUrl(scopes = ['identity']) {
        const result = await this.sendMessage('oauth:authorize', { scopes });
        return result.authUrl;
    }

    async getTokens(code) {
        const result = await this.sendMessage('oauth:token', { code });
        return result.tokens;
    }

    async refreshTokens(refreshToken) {
        const result = await this.sendMessage('oauth:refresh', { refreshToken });
        return result.tokens;
    }

    // API methods
    async initializeAPI(accessToken) {
        await this.sendMessage('api:init', { accessToken });
        return true;
    }

    async getCurrentUser() {
        const result = await this.sendMessage('api:getCurrentUser');
        return result.user;
    }

    async getCampaigns() {
        const result = await this.sendMessage('api:getCampaigns');
        return result.campaigns;
    }

    async getCampaignMembers(campaignId, options = {}) {
        const result = await this.sendMessage('api:getCampaignMembers', { campaignId, options });
        return result.members;
    }

    async getCampaignPosts(campaignId, options = {}) {
        const result = await this.sendMessage('api:getCampaignPosts', { campaignId, options });
        return result.posts;
    }

    // Webhook methods
    async verifyWebhook(signature, body) {
        const result = await this.sendMessage('webhook:verify', { signature, body });
        return result.isValid;
    }

    async processWebhook(body, signature, event) {
        const result = await this.sendMessage('webhook:process', { body, signature, event });
        return result.webhookData;
    }

    // Health check
    async ping() {
        const result = await this.sendMessage('ping');
        return result.pong;
    }
}

module.exports = PatreonProcessManager;
