// MCP Server Integration for Agent Dr Girlfriend
// This script detects and integrates with a real MCP server when available

(async function initializeMCPIntegration() {
    console.log('🔍 Checking for MCP Server integration...');
    
    try {
        // Check if MCP server is available
        const response = await fetch('http://localhost:3000/agent/agent-integration');
        
        if (response.ok) {
            const integrationInfo = await response.json();
            console.log('✅ MCP Server detected:', integrationInfo.serverUrl);
            
            // Load the real MCP service script
            const script = document.createElement('script');
            script.src = 'http://localhost:3000/static/realMCPDockingService.js';
            script.onload = function() {
                console.log('🇦🇹 Real MCP Docking Service script loaded');
                
                // Store the real service for when the agent asks for it
                if (window.RealMCPDockingService) {
                    window.realMCPDockingService = window.RealMCPDockingService;
                    console.log('🔌 Real MCP Service ready for agent');
                }
            };
            script.onerror = function() {
                console.warn('❌ Failed to load real MCP service script');
            };
            document.head.appendChild(script);
            
            return true;
        }
    } catch (error) {
        console.log('ℹ️ No MCP Server found, using mock service:', error.message);
    }
    
    return false;
})();

// Helper function for the agent to override the service
window.enableRealMCPDocking = function(currentService) {
    if (window.realMCPDockingService) {
        console.log('🔄 Switching to real MCP Docking Service...');
        return window.realMCPDockingService;
    } else {
        console.log('ℹ️ Real MCP service not available, using current service');
        return currentService;
    }
};
