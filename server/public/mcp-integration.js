// 🔌 MCP Integration with Socket.IO Support
// Automatically detects and integrates MCP server using Socket.IO instead of ports

(async function initializeMCPIntegration() {
    console.log('🔍 Starting MCP integration with Socket.IO...');

    try {
        // Load Socket.IO first if not already loaded
        if (!window.io) {
            console.log('🔌 Loading Socket.IO...');
            const socketScript = document.createElement('script');
            socketScript.type = 'text/javascript';
            socketScript.src = `${window.location.origin}/socket.io/socket.io.js`;
            socketScript.crossOrigin = 'anonymous';
            document.head.appendChild(socketScript);

            await new Promise((resolve, reject) => {
                socketScript.onload = () => {
                    console.log('✅ Socket.IO script loaded successfully');
                    resolve();
                };
                socketScript.onerror = (error) => {
                    console.warn('❌ Socket.IO script failed to load:', error);
                    reject(error);
                };
                
                // Timeout fallback
                setTimeout(() => {
                    if (window.io) {
                        console.log('✅ Socket.IO available via timeout check');
                        resolve();
                    } else {
                        console.warn('⚠️ Socket.IO timeout - continuing anyway');
                        resolve(); // Continue anyway
                    }
                }, 5000);
            });
        }

        // Check if MCP server is available via API route
        const baseUrl = window.location.origin;
        const response = await fetch(`${baseUrl}/api/agent-integration`);

        if (response.ok) {
            const integrationInfo = await response.json();
            console.log('✅ MCP server detected via /api/ route');
            console.log('📡 Integration info:', integrationInfo);

            // Load the Socket.IO MCP service instead of HTTP version
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = `${baseUrl}/static/socketMCPDockingService.js`;
            script.crossOrigin = 'anonymous';
            script.onload = function () {
                console.log('✅ Socket.IO MCP service loaded');

                // Store the Socket.IO service
                if (window.SocketMCPDockingService) {
                    window.realMCPDockingService = window.SocketMCPDockingService;
                    window.mcpDockingService = new window.SocketMCPDockingService();
                    console.log('🔌 Socket.IO MCP docking service initialized');

                    // Trigger integration complete event
                    window.dispatchEvent(new CustomEvent('mcpIntegrationReady', {
                        detail: {
                            service: 'socket',
                            baseUrl: window.location.origin,
                            integrationInfo
                        }
                    }));
                } else {
                    console.warn('❌ SocketMCPDockingService not found in loaded script');
                }
            };
            script.onerror = function (error) {
                console.warn('❌ Failed to load Socket.IO MCP service, falling back to HTTP:', error);
                loadHTTPFallback();
            };
            document.head.appendChild(script);

            return true;
        }
    } catch (error) {
        console.log('ℹ️ No MCP Server found via Socket.IO, trying HTTP fallback:', error.message);
        loadHTTPFallback();
    }

    function loadHTTPFallback() {
        console.log('🔄 Loading HTTP fallback MCP service...');
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = '/static/realMCPDockingService.js';
        script.onload = function () {
            if (window.RealMCPDockingService) {
                window.realMCPDockingService = window.RealMCPDockingService;
                window.mcpDockingService = new window.RealMCPDockingService();
                console.log('✅ HTTP fallback MCP service initialized');
            }
        };
        document.head.appendChild(script);
    }

    return false;
})();

// Helper function for the agent to override the service
window.enableRealMCPDocking = function (currentService) {
    if (window.realMCPDockingService) {
        console.log('🔄 Switching to real MCP Docking Service...');
        return new window.realMCPDockingService();
    } else {
        console.log('ℹ️ Real MCP service not available, using current service');
        return currentService;
    }
};
