require('dotenv').config({ path: '../.env' });

const axios = require('axios');
const WebSocket = require('ws');
const GitHubService = require('./github/github-service');
const GitService = require('./git/git-service');

class MCPAgent {
    constructor() {
        this.serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000';
        this.agentId = process.env.AGENT_ID || `agent_${Date.now()}`;
        this.githubService = new GitHubService();
        this.gitService = new GitService();
        this.dockId = null;
        this.handshakeToken = null;
        this.ws = null;
        this.heartbeatInterval = null;
    }

    async start() {
        console.log(`🤖 Starting MCP Agent: ${this.agentId}`);
        console.log(`🔗 Server URL: ${this.serverUrl}`);

        try {
            // Initialize services
            await this.githubService.initialize();
            await this.gitService.initialize();

            // Connect to MCP server
            await this.connectToServer();

            console.log('✅ MCP Agent started successfully');
        } catch (error) {
            console.error('❌ Failed to start MCP Agent:', error.message);
            process.exit(1);
        }
    }

    async connectToServer() {
        try {
            // Initiate docking with MCP server
            const response = await axios.post(`${this.serverUrl}/api/dock`, {
                agentId: this.agentId,
                capabilities: [
                    'github-integration',
                    'git-operations',
                    'repository-management',
                    'pull-requests',
                    'issue-management'
                ],
                metadata: {
                    version: '1.0.0',
                    nodeVersion: process.version,
                    platform: process.platform
                }
            }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': `MCP-Agent/${this.agentId}`
                }
            });

            this.dockId = response.data.dockId;
            this.handshakeToken = response.data.handshakeToken;

            console.log(`🔌 Docked with server: ${this.dockId}`);

            // Start WebSocket connection for real-time communication
            this.connectWebSocket();

            // Start heartbeat
            this.startHeartbeat();

        } catch (error) {
            console.error('Failed to dock with server:', error.response?.data || error.message);
            throw error;
        }
    }

    connectWebSocket() {
        const wsUrl = this.serverUrl.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket';

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                console.log('📡 WebSocket connected');
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            });

            this.ws.on('close', () => {
                console.log('📡 WebSocket disconnected');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.connectWebSocket(), 5000);
            });

            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });

        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
        }
    }

    handleWebSocketMessage(message) {
        console.log('📨 Received message:', message);

        // Handle different message types
        switch (message.type) {
            case 'dock-request':
                this.handleDockRequest(message.data);
                break;
            case 'git-operation':
                this.handleGitOperation(message.data);
                break;
            case 'github-operation':
                this.handleGitHubOperation(message.data);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    async handleDockRequest(data) {
        console.log('🔌 Handling dock request:', data);
        // Process docking request logic here
    }

    async handleGitOperation(data) {
        console.log('📁 Handling git operation:', data);
        try {
            const result = await this.gitService.executeOperation(data);
            this.sendResponse('git-operation-result', result);
        } catch (error) {
            this.sendError('git-operation-error', error.message);
        }
    }

    async handleGitHubOperation(data) {
        console.log('🐙 Handling GitHub operation:', data);
        try {
            const result = await this.githubService.executeOperation(data);
            this.sendResponse('github-operation-result', result);
        } catch (error) {
            this.sendError('github-operation-error', error.message);
        }
    }

    sendResponse(type, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, data }));
        }
    }

    sendError(type, message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, error: message }));
        }
    }

    async startHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            try {
                await axios.post(`${this.serverUrl}/api/dock/${this.dockId}/heartbeat`, {
                    handshakeToken: this.handshakeToken
                }, {
                    timeout: 5000
                });
            } catch (error) {
                console.error('💓 Heartbeat failed:', error.response?.data || error.message);
            }
        }, 30000); // Every 30 seconds
    }

    async stop() {
        console.log('🛑 Stopping MCP Agent...');

        // Clear heartbeat
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
        }

        // Complete docking
        if (this.dockId && this.handshakeToken) {
            try {
                await axios.post(`${this.serverUrl}/api/dock/${this.dockId}/complete`, {
                    handshakeToken: this.handshakeToken,
                    result: {
                        status: 'shutdown',
                        message: 'Agent stopped gracefully'
                    }
                });
            } catch (error) {
                console.error('Failed to complete docking:', error.message);
            }
        }

        console.log('✅ MCP Agent stopped');
    }
}

// Create and start agent
const agent = new MCPAgent();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await agent.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await agent.stop();
    process.exit(0);
});

// Start the agent
agent.start().catch((error) => {
    console.error('💥 Agent startup failed:', error);
    process.exit(1);
});

module.exports = MCPAgent;
