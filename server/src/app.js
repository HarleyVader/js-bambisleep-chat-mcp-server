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
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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

// CORS configuration - Allow agent and development access
const allowedOrigins = [
    'http://localhost:3004', // Agent Dr Girlfriend
    'http://localhost:3000', // MCP Server
    'http://localhost:3001', // Alternative development port
    process.env.CORS_ORIGIN || 'http://localhost:3004'
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

// Socket.IO for real-time communication
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('dock-request', (data) => {
        console.log('Dock request received:', data);
        // Handle docking requests
        socket.emit('dock-response', { status: 'processing', requestId: data.requestId });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
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

const PORT = process.env.PORT || 8888;
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
