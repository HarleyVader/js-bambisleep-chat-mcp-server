// MCP Integration Endpoint for Agent
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Serve the real MCP docking service for agents
router.get('/mcp-docking-service.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, '../public/realMCPDockingService.js'));
});

// Agent integration info endpoint
router.get('/agent-integration', (req, res) => {
    res.json({
        available: true,
        serverUrl: `http://localhost:${process.env.PORT || 3000}`,
        mcpServiceUrl: `/static/realMCPDockingService.js`,
        austrianCompliance: true,
        gdprCompliant: true,
        endpoints: {
            establishConnection: '/api/agent-dock/establish-connection',
            patronVerify: '/api/agent-dock/:dockId/patron/verify',
            deposit: '/api/agent-dock/:dockId/deposit',
            gdpr: '/api/agent-dock/:dockId/gdpr',
            heartbeat: '/api/agent-dock/:dockId/heartbeat'
        },
        instructions: {
            setup: 'Import the real MCP service from the provided URL',
            usage: 'Replace the mock mcpDockingService with the real one',
            note: 'Austrian GDPR compliance maintained'
        }
    });
});

// Proxy endpoint for CORS-free agent access
router.all('/proxy/*', (req, res) => {
    const targetPath = req.params[0];

    // Set CORS headers for agent access
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }

    // Forward the request to the appropriate API endpoint
    req.url = `/api/${targetPath}`;
    req.app.handle(req, res);
});

module.exports = router;
