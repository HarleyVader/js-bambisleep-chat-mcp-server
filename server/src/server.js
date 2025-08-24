/* eslint-disable indent */
require('dotenv').config({ path: '../.env' });

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const { createServer } = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const mcpRoutes = require('./routes/mcp');
const dockRoutes = require('./routes/dock');
const agentDockRoutes = require('./routes/agent-dock');
const agentIntegrationRoutes = require('./routes/agent-integration');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'https://fickdichselber.com',
        methods: ['GET', 'POST']
    }
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ['\'self\''],
            scriptSrc: ['\'self\'', '\'unsafe-inline\''],
            styleSrc: ['\'self\'', '\'unsafe-inline\''],
            imgSrc: ['\'self\'', 'data:', 'https:']
        }
    }
}));

// CORS configuration - Use /api/ routes and socket.io instead of direct ports
const allowedOrigins = [
    'https://fickdichselber.com', // Production domain
    process.env.CORS_ORIGIN || 'https://fickdichselber.com'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'User-Agent']
}));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
    name: process.env.SESSION_NAME || 'mcp-session',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Initialize passport strategies
require('./auth/strategies');

// Routes
app.use('/auth', authRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/dock', dockRoutes);
app.use('/api/agent-dock', agentDockRoutes);
app.use('/agent', agentIntegrationRoutes);

// Serve static files for agent integration
app.use('/static', express.static(path.join(__dirname, '../public')));

// Serve agent files directly from the main server
app.use('/agent-app', express.static(path.join(__dirname, '../../agent/js-bambisleep-chat-agent-dr-girlfriend/dist')));

// Serve landing page at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve agent terminal interface
app.get('/terminal', (req, res) => {
    res.sendFile(path.join(__dirname, '../../agent/js-bambisleep-chat-agent-dr-girlfriend/dist/index.html'));
});

// Dashboard route (after successful auth)
app.get('/dashboard', (req, res) => {
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, '../../agent/js-bambisleep-chat-agent-dr-girlfriend/dist/index.html'));
    } else {
        res.redirect('/');
    }
});

// Catch all for unmatched routes (excluding API routes)
app.get('*', (req, res, next) => {
    // Skip API routes, auth routes, health, static assets
    if (req.path.startsWith('/api') ||
        req.path.startsWith('/auth') ||
        req.path.startsWith('/health') ||
        req.path.startsWith('/static') ||
        req.path.startsWith('/agent-app')) {
        return next();
    }
    // Redirect to landing page for unknown routes
    res.redirect('/');
});

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        name: 'MCP Server & Agent Docking System',
        version: process.env.npm_package_version || '1.0.0',
        endpoints: {
            health: '/health',
            auth: '/auth',
            mcp: '/api/mcp',
            dock: '/api/dock'
        }
    });
});

// Socket.IO for real-time communication and MCP docking
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // MCP Docking via Socket.IO
    socket.on('mcp-dock-request', async (data) => {
        console.log('MCP dock request received via Socket.IO:', data);
        try {
            const { requestId, serverConfig, agentId } = data;

            // Use the same logic as HTTP endpoint but via Socket.IO
            const crypto = require('crypto');
            const handshakeToken = crypto.randomBytes(32).toString('hex');
            const dockId = `socket_dock_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
            const secureChannelId = crypto.randomBytes(16).toString('hex');

            const dockSession = {
                dockId,
                agentId: agentId || 'bambisleep-agent-dr-girlfriend',
                handshakeToken,
                secureChannelId,
                austrianCompliance: true,
                gdprCompliant: true,
                status: 'CONNECTED',
                createdAt: new Date().toISOString(),
                lastHeartbeat: new Date().toISOString(),
                dataProtectionLevel: 'AUSTRIAN_ENHANCED',
                complianceVersion: '1.0.0',
                socketId: socket.id
            };

            // Store session (you'll need to import the activeAgentDocks from agent-dock.js)
            // For now, we'll use a simple in-memory store
            if (!global.socketDocks) global.socketDocks = new Map();
            global.socketDocks.set(dockId, dockSession);

            socket.emit('mcp-dock-response', {
                requestId,
                success: true,
                port: {
                    dockId,
                    handshakeToken,
                    secureChannelId,
                    status: 'CONNECTED',
                    austrianCompliance: true,
                    endpoints: {
                        heartbeat: 'socket-heartbeat',
                        deposit: 'socket-deposit',
                        withdraw: 'socket-withdraw',
                        patron: 'socket-patron',
                        gdpr: 'socket-gdpr'
                    }
                }
            });

        } catch (error) {
            console.error('🚨 Socket MCP docking failed:', error);
            socket.emit('mcp-dock-response', {
                requestId: data.requestId,
                success: false,
                error: error.message
            });
        }
    });

    // Socket.IO heartbeat
    socket.on('mcp-heartbeat', (data) => {
        console.log('💓 Socket heartbeat received:', data);
        if (global.socketDocks && global.socketDocks.has(data.dockId)) {
            const dock = global.socketDocks.get(data.dockId);
            dock.lastHeartbeat = new Date().toISOString();
            global.socketDocks.set(data.dockId, dock);
        }
    });

    // Patron verification via Socket.IO
    socket.on('patron-verify', async (data) => {
        const { requestId, dockId, patronCredentials } = data;
        try {
            // Implement patron verification logic here
            // For now, we'll simulate success
            socket.emit(`patron-verify-response-${requestId}`, {
                success: true,
                patronVerified: true,
                bambisleepId: patronCredentials.bambisleepId
            });
        } catch (error) {
            socket.emit(`patron-verify-response-${requestId}`, {
                success: false,
                error: error.message
            });
        }
    });

    socket.on('dock-request', (data) => {
        console.log('Legacy dock request received:', data);
        // Handle legacy docking requests
        socket.emit('dock-response', { status: 'processing', requestId: data.requestId });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Clean up any socket-specific dock sessions
        if (global.socketDocks) {
            for (const [dockId, dock] of global.socketDocks.entries()) {
                if (dock.socketId === socket.id) {
                    console.log(`🧹 Cleaning up socket dock session: ${dockId}`);
                    global.socketDocks.delete(dockId);
                }
            }
        }
    });
});

// Error handling middleware
app.use((err, _req, res, _next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: {
            message: 'Not Found',
            path: req.path
        }
    });
});

const PORT = process.env.PORT || 6969;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`🚀 MCP Server running on http://${HOST}:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
}).on('error', (err) => {
    if (err.code === 'EADDRNOTAVAIL') {
        console.log(`❌ Address ${HOST}:${PORT} not available, trying 0.0.0.0:${PORT}`);
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 MCP Server running on http://0.0.0.0:${PORT}`);
        });
    } else if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} in use, trying ${PORT + 1}`);
        server.listen(PORT + 1, HOST, () => {
            console.log(`🚀 MCP Server running on http://${HOST}:${PORT + 1}`);
        });
    } else {
        console.error('Server error:', err);
        process.exit(1);
    }
});

module.exports = { app, server, io };
