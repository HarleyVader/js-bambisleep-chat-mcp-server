// 🔌 Socket.IO MCP Docking Service
// Replaces direct HTTP port connections with Socket.IO communication

class SocketMCPDockingService {
    constructor() {
        this.socket = null;
        this.dockId = null;
        this.handshakeToken = null;
        this.austrianComplianceMode = true;
        this.gdprCompliant = true;
        this.connectionCallbacks = new Map();

        // Spy protocols
        this.spyProtocols = {
            compartmentalization: true,
            needToKnow: true,
            zerotrust: true,
        };

        // Initialize Socket.IO connection
        this.initializeSocket();
    }

    /**
     * 🔌 Initialize Socket.IO connection
     */
    initializeSocket() {
        try {
            // Use same origin as current page - no hardcoded ports
            this.socket = io(window.location.origin, {
                transports: ['websocket', 'polling'],
                upgrade: true,
                timeout: 5000,
                autoConnect: true
            });

            this.setupSocketListeners();
            console.log('🔌 Socket.IO MCP service initialized');
        } catch (error) {
            console.error('🚨 Socket.IO initialization failed:', error);
            this.fallbackToHTTP();
        }
    }

    /**
     * 📡 Setup Socket.IO event listeners
     */
    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('✅ Socket.IO connected for MCP docking');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Socket.IO disconnected');
        });

        this.socket.on('mcp-dock-response', (data) => {
            this.handleDockResponse(data);
        });

        this.socket.on('mcp-error', (error) => {
            console.error('🚨 MCP Socket error:', error);
        });

        this.socket.on('connect_error', (error) => {
            console.error('🚨 Socket connection error:', error);
            this.fallbackToHTTP();
        });
    }

    /**
     * 🤝 Establish MCP Connection via Socket.IO
     */
    async establishMCPConnection(serverConfig) {
        try {
            console.log('🇦🇹 Initiating MCP docking via Socket.IO...');

            const requestData = {
                serverConfig: {
                    endpoint: window.location.origin,
                    austrianCompliance: true,
                    gdprEndpoint: '/api/agent-dock/gdpr',
                    socketConnection: true
                },
                agentId: 'bambisleep-agent-dr-girlfriend'
            };

            return new Promise((resolve, reject) => {
                const requestId = Date.now().toString();

                // Store callback for response
                this.connectionCallbacks.set(requestId, { resolve, reject });

                // Emit connection request
                this.socket.emit('mcp-dock-request', {
                    requestId,
                    ...requestData
                });

                // Timeout after 10 seconds
                setTimeout(() => {
                    if (this.connectionCallbacks.has(requestId)) {
                        this.connectionCallbacks.delete(requestId);
                        reject(new Error('MCP connection timeout'));
                    }
                }, 10000);
            });

        } catch (error) {
            console.error('🚨 Socket MCP docking failed:', error);
            return this.fallbackToHTTP();
        }
    }

    /**
     * 📨 Handle dock response from Socket.IO
     */
    handleDockResponse(data) {
        const { requestId, success, port, error } = data;
        const callback = this.connectionCallbacks.get(requestId);

        if (callback) {
            this.connectionCallbacks.delete(requestId);

            if (success && port) {
                this.dockId = port.dockId;
                this.handshakeToken = port.handshakeToken;

                console.log('✅ Socket MCP docking successful');
                console.log('🔌 Dock ID:', this.dockId);

                this.startSocketHeartbeat();
                callback.resolve({ success: true, port });
            } else {
                callback.reject(new Error(error || 'MCP connection failed'));
            }
        }
    }

    /**
     * 💓 Start Socket.IO heartbeat
     */
    startSocketHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.socket.connected && this.dockId) {
                this.socket.emit('mcp-heartbeat', {
                    dockId: this.dockId,
                    timestamp: new Date().toISOString()
                });
                console.log('💓 MCP Socket heartbeat sent');
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * 🔄 Fallback to HTTP when Socket.IO fails
     */
    async fallbackToHTTP() {
        console.log('🔄 Falling back to HTTP API...');

        try {
            const requestData = {
                serverConfig: {
                    endpoint: window.location.origin,
                    austrianCompliance: true,
                    gdprEndpoint: '/api/agent-dock/gdpr',
                    fallbackMode: true
                },
                agentId: 'bambisleep-agent-dr-girlfriend'
            };

            const response = await fetch('/api/agent-dock/establish-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Agent-Dr-Girlfriend/1.0.0'
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP fallback failed: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.port) {
                this.dockId = result.port.dockId;
                this.handshakeToken = result.port.handshakeToken;

                console.log('✅ HTTP fallback MCP docking successful');
                this.startHTTPHeartbeat();

                return result;
            } else {
                throw new Error('HTTP fallback connection invalid');
            }

        } catch (error) {
            console.error('🚨 HTTP fallback also failed:', error);
            throw error;
        }
    }

    /**
     * 💓 Start HTTP heartbeat for fallback mode
     */
    startHTTPHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(async () => {
            try {
                if (this.dockId) {
                    const response = await fetch(`/api/agent-dock/${this.dockId}/heartbeat`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'Agent-Dr-Girlfriend/1.0.0'
                        },
                        body: JSON.stringify({})
                    });

                    if (response.ok) {
                        console.log('💓 HTTP MCP heartbeat successful');
                    }
                }
            } catch (error) {
                console.warn('⚠️ HTTP heartbeat error:', error.message);
            }
        }, 30000);
    }

    /**
     * 📤 Verify patron via Socket.IO or HTTP
     */
    async verifyPatron(patronCredentials) {
        if (this.socket && this.socket.connected) {
            return this.verifyPatronSocket(patronCredentials);
        } else {
            return this.verifyPatronHTTP(patronCredentials);
        }
    }

    /**
     * 🔌 Verify patron via Socket.IO
     */
    async verifyPatronSocket(patronCredentials) {
        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();

            this.socket.emit('patron-verify', {
                requestId,
                dockId: this.dockId,
                patronCredentials
            });

            this.socket.once(`patron-verify-response-${requestId}`, (data) => {
                if (data.success) {
                    resolve(data);
                } else {
                    reject(new Error(data.error || 'Patron verification failed'));
                }
            });

            setTimeout(() => reject(new Error('Patron verification timeout')), 5000);
        });
    }

    /**
     * 📡 Verify patron via HTTP fallback
     */
    async verifyPatronHTTP(patronCredentials) {
        const response = await fetch(`/api/agent-dock/${this.dockId}/patron/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Agent-Dr-Girlfriend/1.0.0'
            },
            body: JSON.stringify(patronCredentials)
        });

        if (!response.ok) {
            throw new Error(`Patron verification failed: ${response.status}`);
        }

        return response.json();
    }

    /**
     * 🗑️ Cleanup on disconnect
     */
    disconnect() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        if (this.socket) {
            this.socket.disconnect();
        }

        this.connectionCallbacks.clear();
        console.log('🔌 MCP Socket service disconnected');
    }
}

// Export for global use
window.SocketMCPDockingService = SocketMCPDockingService;

// Auto-replace the old service if it exists
if (window.RealMCPDockingService) {
    console.log('🔄 Replacing RealMCPDockingService with SocketMCPDockingService');
    window.RealMCPDockingService = SocketMCPDockingService;
}
