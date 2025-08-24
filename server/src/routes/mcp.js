const express = require('express');
const Ajv = require('ajv');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const path = require('path');

const router = express.Router();
const ajv = new Ajv();

// Mock MCP tool registry - will be replaced with actual MCP implementation
const toolRegistry = new Map();

// Tool schema for validation
const toolSchema = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        parameters: { type: 'object' },
        schema: { type: 'object' }
    },
    required: ['name', 'description', 'parameters']
};

const validateTool = ajv.compile(toolSchema);

// Middleware to check authentication for MCP operations
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required for MCP operations' });
};

// List all available tools
router.get('/tools', ensureAuthenticated, (req, res) => {
    const tools = Array.from(toolRegistry.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
    }));

    res.json({
        tools,
        count: tools.length
    });
});

// Get specific tool details
router.get('/tools/:name', ensureAuthenticated, (req, res) => {
    const tool = toolRegistry.get(req.params.name);

    if (!tool) {
        return res.status(404).json({ error: 'Tool not found' });
    }

    res.json(tool);
});

// Register a new tool
router.post('/tools', ensureAuthenticated, async (req, res) => {
    const tool = req.body;

    if (!validateTool(tool)) {
        return res.status(400).json({
            error: 'Invalid tool schema',
            details: validateTool.errors
        });
    }

    try {
        // Ensure tool directory exists
        const toolsDir = process.env.MCP_TOOLS_DIR || './tools';
        await fs.ensureDir(toolsDir);

        // Store tool in registry
        toolRegistry.set(tool.name, {
            ...tool,
            registeredAt: new Date().toISOString(),
            registeredBy: req.user.username
        });

        res.status(201).json({
            message: 'Tool registered successfully',
            tool: tool.name
        });
    } catch (error) {
        console.error('Tool registration error:', error);
        res.status(500).json({ error: 'Failed to register tool' });
    }
});

// Execute a tool
router.post('/tools/:name/execute', ensureAuthenticated, async (req, res) => {
    const toolName = req.params.name;
    const tool = toolRegistry.get(toolName);

    if (!tool) {
        return res.status(404).json({ error: 'Tool not found' });
    }

    try {
        // Create workspace for tool execution
        const workspaceDir = process.env.MCP_WORKSPACE_DIR || './workspace';
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const executionPath = path.join(workspaceDir, executionId);

        await fs.ensureDir(executionPath);

        // For now, simulate tool execution with a simple hello world
        const result = await executeToolSafely(tool, req.body, executionPath);

        res.json({
            executionId,
            result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Tool execution error:', error);
        res.status(500).json({
            error: 'Tool execution failed',
            message: error.message
        });
    }
});

// Helper function to safely execute tools
async function executeToolSafely(tool, input, workspacePath) {
    return new Promise((resolve, reject) => {
        // For now, return a mock response
        // In a real implementation, this would execute the actual tool
        setTimeout(() => {
            resolve({
                tool: tool.name,
                input,
                output: `Hello from ${tool.name}! Input received: ${JSON.stringify(input)}`,
                workspace: workspacePath
            });
        }, 100);
    });
}

// Get MCP server status
router.get('/status', ensureAuthenticated, (req, res) => {
    res.json({
        status: 'active',
        toolsRegistered: toolRegistry.size,
        uptime: process.uptime(),
        version: '1.0.0',
        user: req.user.username
    });
});

// Initialize default tools
function initializeDefaultTools() {
    // Register a simple hello world tool
    const helloTool = {
        name: 'hello',
        description: 'A simple hello world tool for testing',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name to greet' }
            }
        },
        schema: {
            input: {
                type: 'object',
                properties: {
                    name: { type: 'string' }
                }
            },
            output: {
                type: 'object',
                properties: {
                    greeting: { type: 'string' }
                }
            }
        }
    };

    toolRegistry.set('hello', helloTool);
    console.log('✅ Default MCP tools initialized');
}

// Initialize default tools on startup
initializeDefaultTools();

module.exports = router;
