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

// Security imports
const crypto = require('crypto');

const authRoutes = require('./routes/auth');
const mcpRoutes = require('./routes/mcp');
const dockRoutes = require('./routes/dock');
const agentDockRoutes = require('./routes/agent-dock');
const agentIntegrationRoutes = require('./routes/agent-integration');
const patreonRoutes = require('./routes/patreon');

// Import Patreon services
const { PatreonOAuth, PatreonAPIClient, PatreonWebhookHandler, createWebhookMiddleware } = require('./patreon');

// Import Patreon Process Manager
const PatreonProcessManager = require('./services/patreon-process-manager');

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
            scriptSrc: ['\'self\'', '\'unsafe-inline\'', '\'unsafe-eval\''],
            styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com'],
            fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
            imgSrc: ['\'self\'', 'data:', 'https:'],
            connectSrc: ['\'self\'', 'wss:', 'ws:']
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
        maxAge: (() => {
            const maxAge = parseInt(process.env.SESSION_MAX_AGE, 10);
            return !isNaN(maxAge) && maxAge > 0 ? maxAge : 24 * 60 * 60 * 1000; // 24 hours default
        })()
    }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// CSRF Protection for state-changing operations
const generateCSRFToken = () => crypto.randomBytes(32).toString('hex');

app.use((req, res, next) => {
    // Skip CSRF for GET requests, webhooks, and socket.io
    if (req.method === 'GET' ||
        req.path.startsWith('/webhooks/') ||
        req.path.startsWith('/socket.io/') ||
        req.path.startsWith('/auth/')) {
        return next();
    }

    // Generate CSRF token for session if not exists
    if (req.session && !req.session.csrfToken) {
        req.session.csrfToken = generateCSRFToken();
    }

    // Validate CSRF token for state-changing operations
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    if (req.session && req.session.csrfToken && token !== req.session.csrfToken) {
        return res.status(403).json({
            error: 'CSRF token validation failed',
            code: 'CSRF_TOKEN_INVALID'
        });
    }

    next();
});

// Endpoint to get CSRF token
app.get('/api/csrf-token', (req, res) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateCSRFToken();
    }
    res.json({ csrfToken: req.session.csrfToken });
});

// Initialize passport strategies
require('./auth/strategies');

// Initialize Patreon services
const patreonOAuth = new PatreonOAuth({
    clientId: process.env.PATREON_CLIENT_ID,
    clientSecret: process.env.PATREON_CLIENT_SECRET,
    redirectUri: process.env.PATREON_REDIRECT_URI || 'https://fickdichselber.com/auth/patreon/callback',
    userAgent: process.env.PATREON_USER_AGENT || 'BambiSleep-Chat-Patreon/1.0.0'
});

const webhookHandler = new PatreonWebhookHandler({
    secret: process.env.PATREON_WEBHOOK_SECRET || 'default-secret'
});

// Setup webhook event handlers
webhookHandler.on('members:create', async (event) => {
    console.log('📨 New member created:', event.data);
    // Emit to socket.io clients
    io.emit('patreon:member:create', event.data);
});

webhookHandler.on('members:update', async (event) => {
    console.log('📨 Member updated:', event.data);
    io.emit('patreon:member:update', event.data);
});

webhookHandler.on('members:delete', async (event) => {
    console.log('📨 Member deleted:', event.data);
    io.emit('patreon:member:delete', event.data);
});

webhookHandler.on('members:pledge:create', async (event) => {
    console.log('📨 New pledge created:', event.data);
    io.emit('patreon:pledge:create', event.data);
});

webhookHandler.on('members:pledge:update', async (event) => {
    console.log('📨 Pledge updated:', event.data);
    io.emit('patreon:pledge:update', event.data);
});

webhookHandler.on('members:pledge:delete', async (event) => {
    console.log('📨 Pledge deleted:', event.data);
    io.emit('patreon:pledge:delete', event.data);
});

// Store Patreon services in app locals
app.locals.patreonOAuth = patreonOAuth;
app.locals.webhookHandler = webhookHandler;

// Routes
app.use('/auth', authRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/dock', dockRoutes);
app.use('/api/agent-dock', agentDockRoutes);
app.use('/agent', agentIntegrationRoutes);
app.use('/api/agent-integration', agentIntegrationRoutes);
app.use('/api/patreon', patreonRoutes);

// Patreon OAuth routes
app.get('/auth/patreon', (req, res) => {
    const scopes = ['identity', 'identity[email]', 'campaigns', 'campaigns.members'];
    const authUrl = patreonOAuth.getAuthorizationUrl(scopes);
    res.redirect(authUrl);
});

app.get('/auth/patreon/callback', async (req, res) => {
    try {
        const { code, error, error_description } = req.query;

        // Handle OAuth errors
        if (error) {
            const errorMessage = error_description || 'OAuth authentication failed';
            return res.status(400).send(`
                <!DOCTYPE html>
                <html lang="en" class="cyber-terminal">
                <head>
                    <title>🚨 AUTHENTICATION FAILED 🚨</title>
                    <style>
                        :root {
                            /* FICKDICHSELBER.COM NEON CYBER GOTH WAVE PALETTE */
                            --primary-color: #0c2a2ac9;
                            --primary-alt: #15aab5ec;
                            --secondary-color: #40002f;
                            --secondary-alt: #cc0174;
                            --tertiary-color: #cc0174;
                            --tertiary-alt: #01c69eae;
                            --button-color: #df0471;
                            --button-alt: #110000;
                            --nav-color: #0a2626;
                            --nav-alt: #17dbd8;
                            --error: #ff3333;
                            --error-bg: rgba(255, 51, 51, 0.1);

                            /* RGB values for alpha compositing */
                            --primary-color-rgb: 12, 42, 42;
                            --secondary-color-rgb: 64, 0, 47;
                            --tertiary-color-rgb: 204, 1, 116;
                            --nav-color-rgb: 10, 38, 38;
                            --button-color-rgb: 223, 4, 113;
                            --error-rgb: 255, 51, 51;
                        }

                        @import url("https://fonts.googleapis.com/css2?family=Audiowide&family=Fira+Code:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap");

                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }

                        body {
                            font-family: 'Audiowide', 'JetBrains Mono', 'Fira Code', monospace;
                            background: var(--button-alt);
                            color: var(--primary-alt);
                            min-height: 100vh;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            position: relative;
                            overflow-x: hidden;
                        }

                        /* Error scanlines effect */
                        body::before {
                            content: '';
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100vw;
                            height: 100vh;
                            background: repeating-linear-gradient(0deg,
                                transparent,
                                transparent 2px,
                                rgba(var(--error-rgb), 0.05) 2px,
                                rgba(var(--error-rgb), 0.05) 4px);
                            pointer-events: none;
                            z-index: 1000;
                            animation: error-scanlines 0.1s linear infinite;
                        }

                        @keyframes error-scanlines {
                            0% { transform: translateY(0); }
                            100% { transform: translateY(4px); }
                        }

                        .container {
                            max-width: 600px;
                            padding: 2rem;
                            text-align: center;
                            background: var(--error-bg);
                            border: 2px solid var(--error);
                            border-radius: 10px;
                            box-shadow: 0 0 30px var(--error), 0 0 60px var(--error);
                            position: relative;
                            z-index: 10;
                        }

                        .error-icon {
                            font-size: 4rem;
                            color: var(--error);
                            margin-bottom: 1rem;
                            animation: error-pulse 1s ease-in-out infinite alternate;
                        }

                        @keyframes error-pulse {
                            from {
                                text-shadow: 0 0 20px var(--error);
                                transform: scale(1);
                            }
                            to {
                                text-shadow: 0 0 40px var(--error), 0 0 60px var(--error);
                                transform: scale(1.1);
                            }
                        }

                        .title {
                            font-size: 2rem;
                            color: var(--error);
                            text-shadow: 0 0 20px var(--error);
                            margin-bottom: 1rem;
                        }

                        .message {
                            font-size: 1.1rem;
                            color: var(--primary-alt);
                            margin-bottom: 2rem;
                            line-height: 1.6;
                        }

                        .error-details {
                            background: rgba(var(--secondary-color-rgb), 0.2);
                            border: 1px solid var(--secondary-color);
                            border-radius: 5px;
                            padding: 1rem;
                            margin: 1rem 0;
                            font-family: 'JetBrains Mono', monospace;
                        }

                        .btn {
                            padding: 1rem 2rem;
                            font-size: 1.1rem;
                            font-family: inherit;
                            border: 2px solid;
                            border-radius: 5px;
                            cursor: pointer;
                            text-decoration: none;
                            display: inline-block;
                            transition: all 0.3s ease;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            margin: 0.5rem;
                        }

                        .btn-primary {
                            background: var(--tertiary-color);
                            color: white;
                            border-color: var(--tertiary-color);
                            box-shadow: 0 0 20px rgba(var(--tertiary-color-rgb), 0.5);
                        }

                        .btn-primary:hover {
                            background: var(--secondary-alt);
                            border-color: var(--secondary-alt);
                            box-shadow: 0 0 30px var(--secondary-alt);
                            transform: translateY(-2px);
                        }

                        .btn-secondary {
                            background: transparent;
                            color: var(--nav-alt);
                            border-color: var(--nav-alt);
                            box-shadow: 0 0 20px rgba(var(--nav-color-rgb), 0.5);
                        }

                        .btn-secondary:hover {
                            background: var(--nav-alt);
                            color: var(--button-alt);
                            box-shadow: 0 0 30px var(--nav-alt);
                            transform: translateY(-2px);
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="error-icon">🚨</div>
                        <h1 class="title">AUTHENTICATION FAILED</h1>

                        <div class="message">
                            <p>Oops! Something went wrong during the OAuth process.</p>
                        </div>

                        <div class="error-details">
                            <p><strong>Error:</strong> ${error}</p>
                            <p><strong>Description:</strong> ${errorMessage}</p>
                        </div>

                        <div>
                            <a href="/" class="btn btn-secondary">← Back to Home</a>
                        </div>
                    </div>
                </body>
                </html>
            `);
        }

        if (!code || typeof code !== 'string') {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html lang="en" class="cyber-terminal">
                <head>
                    <title>🚨 MISSING AUTH CODE 🚨</title>
                    <style>
                        :root {
                            /* FICKDICHSELBER.COM NEON CYBER GOTH WAVE PALETTE */
                            --primary-color: #0c2a2ac9;
                            --primary-alt: #15aab5ec;
                            --secondary-color: #40002f;
                            --secondary-alt: #cc0174;
                            --tertiary-color: #cc0174;
                            --tertiary-alt: #01c69eae;
                            --button-color: #df0471;
                            --button-alt: #110000;
                            --nav-color: #0a2626;
                            --nav-alt: #17dbd8;
                            --error: #ff3333;
                            --error-bg: rgba(255, 51, 51, 0.1);

                            /* RGB values for alpha compositing */
                            --primary-color-rgb: 12, 42, 42;
                            --secondary-color-rgb: 64, 0, 47;
                            --tertiary-color-rgb: 204, 1, 116;
                            --nav-color-rgb: 10, 38, 38;
                            --button-color-rgb: 223, 4, 113;
                            --error-rgb: 255, 51, 51;
                        }

                        @import url("https://fonts.googleapis.com/css2?family=Audiowide&family=Fira+Code:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap");

                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }

                        body {
                            font-family: 'Audiowide', 'JetBrains Mono', 'Fira Code', monospace;
                            background: var(--button-alt);
                            color: var(--primary-alt);
                            min-height: 100vh;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            position: relative;
                            overflow-x: hidden;
                        }

                        /* Error scanlines effect */
                        body::before {
                            content: '';
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100vw;
                            height: 100vh;
                            background: repeating-linear-gradient(0deg,
                                transparent,
                                transparent 2px,
                                rgba(var(--error-rgb), 0.05) 2px,
                                rgba(var(--error-rgb), 0.05) 4px);
                            pointer-events: none;
                            z-index: 1000;
                            animation: error-scanlines 0.1s linear infinite;
                        }

                        @keyframes error-scanlines {
                            0% { transform: translateY(0); }
                            100% { transform: translateY(4px); }
                        }

                        .container {
                            max-width: 600px;
                            padding: 2rem;
                            text-align: center;
                            background: var(--error-bg);
                            border: 2px solid var(--error);
                            border-radius: 10px;
                            box-shadow: 0 0 30px var(--error), 0 0 60px var(--error);
                            position: relative;
                            z-index: 10;
                        }

                        .error-icon {
                            font-size: 4rem;
                            color: var(--error);
                            margin-bottom: 1rem;
                            animation: error-pulse 1s ease-in-out infinite alternate;
                        }

                        @keyframes error-pulse {
                            from {
                                text-shadow: 0 0 20px var(--error);
                                transform: scale(1);
                            }
                            to {
                                text-shadow: 0 0 40px var(--error), 0 0 60px var(--error);
                                transform: scale(1.1);
                            }
                        }

                        .title {
                            font-size: 2rem;
                            color: var(--error);
                            text-shadow: 0 0 20px var(--error);
                            margin-bottom: 1rem;
                        }

                        .message {
                            font-size: 1.1rem;
                            color: var(--primary-alt);
                            margin-bottom: 2rem;
                            line-height: 1.6;
                        }

                        .btn {
                            padding: 1rem 2rem;
                            font-size: 1.1rem;
                            font-family: inherit;
                            border: 2px solid;
                            border-radius: 5px;
                            cursor: pointer;
                            text-decoration: none;
                            display: inline-block;
                            transition: all 0.3s ease;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            margin: 0.5rem;
                        }

                        .btn-primary {
                            background: var(--tertiary-color);
                            color: white;
                            border-color: var(--tertiary-color);
                            box-shadow: 0 0 20px rgba(var(--tertiary-color-rgb), 0.5);
                        }

                        .btn-primary:hover {
                            background: var(--secondary-alt);
                            border-color: var(--secondary-alt);
                            box-shadow: 0 0 30px var(--secondary-alt);
                            transform: translateY(-2px);
                        }

                        .btn-secondary {
                            background: transparent;
                            color: var(--nav-alt);
                            border-color: var(--nav-alt);
                            box-shadow: 0 0 20px rgba(var(--nav-color-rgb), 0.5);
                        }

                        .btn-secondary:hover {
                            background: var(--nav-alt);
                            color: var(--button-alt);
                            box-shadow: 0 0 30px var(--nav-alt);
                            transform: translateY(-2px);
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="error-icon">🚨</div>
                        <h1 class="title">MISSING AUTHORIZATION CODE</h1>

                        <div class="message">
                            <p>The OAuth callback is missing the required authorization code.</p>
                            <p>This could happen if the authorization was cancelled or there was a technical issue.</p>
                        </div>

                        <div>
                            <a href="/auth/patreon" class="btn btn-primary">🔄 Try Again</a>
                            <a href="/" class="btn btn-secondary">← Back to Home</a>
                        </div>
                    </div>
                </body>
                </html>
            `);
        }

        const tokens = await patreonOAuth.getTokens(code);

        console.log('🔍 OAuth tokens received:', {
            access_token: tokens.access_token ? 'PRESENT' : 'MISSING',
            refresh_token: tokens.refresh_token ? 'PRESENT' : 'MISSING',
            token_type: tokens.token_type,
            scope: tokens.scope,
            expires_in: tokens.expires_in
        });

        // Create API client with the new tokens
        const apiClient = new PatreonAPIClient({
            accessToken: tokens.access_token,
            userAgent: process.env.PATREON_USER_AGENT || 'BambiSleep-Chat-Patreon/1.0.0'
        });

        // Get user info with explicit fields
        const user = await apiClient.getCurrentUser({
            fields: {
                user: ['about', 'created', 'email', 'first_name', 'full_name', 'image_url', 'last_name', 'social_connections', 'thumb_url', 'url', 'vanity', 'is_email_verified']
            },
            include: 'memberships'
        });

        // Debug logging to see what we actually get
        console.log('🔍 Patreon API Response:', JSON.stringify(user, null, 2));

        const userData = Array.isArray(user.data) ? user.data[0] : user.data;

        console.log('🔍 Extracted userData:', JSON.stringify(userData, null, 2));

        if (!userData) {
            throw new Error('No user data received from Patreon API');
        }

        // Store user session data
        req.session.patreonTokens = tokens;
        req.session.patreonUser = userData;

        // Success page
        return res.send(`
            <!DOCTYPE html>
            <html lang="en" class="cyber-terminal">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>🌸 BAMBI PATREON SUCCESS 🌸</title>
                <style>
                    :root {
                        /* FICKDICHSELBER.COM NEON CYBER GOTH WAVE PALETTE */
                        --primary-color: #0c2a2ac9;
                        --primary-alt: #15aab5ec;
                        --secondary-color: #40002f;
                        --secondary-alt: #cc0174;
                        --tertiary-color: #cc0174;
                        --tertiary-alt: #01c69eae;
                        --button-color: #df0471;
                        --button-alt: #110000;
                        --nav-color: #0a2626;
                        --nav-alt: #17dbd8;
                        --transparent: #124141ce;
                        --success: #01c69eae;

                        /* RGB values for alpha compositing */
                        --primary-color-rgb: 12, 42, 42;
                        --secondary-color-rgb: 64, 0, 47;
                        --tertiary-color-rgb: 204, 1, 116;
                        --nav-color-rgb: 10, 38, 38;
                        --button-color-rgb: 223, 4, 113;
                        --success-rgb: 1, 198, 158;
                    }

                    @import url("https://fonts.googleapis.com/css2?family=Audiowide&family=Fira+Code:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap");

                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }

                    body {
                        font-family: 'Audiowide', 'JetBrains Mono', 'Fira Code', monospace;
                        background: var(--button-alt);
                        color: var(--primary-alt);
                        min-height: 100vh;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        position: relative;
                        overflow-x: hidden;
                    }

                    /* Cyber terminal scanlines effect */
                    body::before {
                        content: '';
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100vh;
                        background: repeating-linear-gradient(0deg,
                            transparent,
                            transparent 2px,
                            rgba(var(--success-rgb), 0.03) 2px,
                            rgba(var(--success-rgb), 0.03) 4px);
                        pointer-events: none;
                        z-index: 1000;
                        animation: success-scanlines 0.1s linear infinite;
                    }

                    @keyframes success-scanlines {
                        0% { transform: translateY(0); }
                        100% { transform: translateY(4px); }
                    }

                    .container {
                        max-width: 800px;
                        padding: 2rem;
                        text-align: center;
                        background: rgba(var(--primary-color-rgb), 0.2);
                        border: 2px solid var(--success);
                        border-radius: 10px;
                        box-shadow: 0 0 30px var(--success), 0 0 60px var(--success);
                        position: relative;
                        z-index: 10;
                    }

                    .success-icon {
                        font-size: 4rem;
                        color: var(--success);
                        margin-bottom: 1rem;
                        animation: success-pulse 2s ease-in-out infinite alternate;
                    }

                    @keyframes success-pulse {
                        from {
                            text-shadow: 0 0 20px var(--success);
                            transform: scale(1);
                        }
                        to {
                            text-shadow: 0 0 40px var(--success), 0 0 60px var(--success);
                            transform: scale(1.1);
                        }
                    }

                    .title {
                        font-size: 2rem;
                        color: var(--success);
                        text-shadow: 0 0 20px var(--success);
                        margin-bottom: 1rem;
                        animation: glow-pulse 2s ease-in-out infinite alternate;
                    }

                    @keyframes glow-pulse {
                        from { text-shadow: 0 0 20px var(--success); }
                        to { text-shadow: 0 0 30px var(--success), 0 0 40px var(--success); }
                    }

                    .subtitle {
                        font-size: 1.2rem;
                        color: var(--nav-alt);
                        margin-bottom: 2rem;
                        text-shadow: 0 0 10px var(--nav-alt);
                    }

                    .user-info {
                        background: rgba(var(--secondary-color-rgb), 0.2);
                        border: 1px solid var(--secondary-color);
                        border-radius: 10px;
                        padding: 1.5rem;
                        margin: 1.5rem 0;
                        color: var(--primary-alt);
                    }

                    .user-info h3 {
                        color: var(--tertiary-color);
                        text-shadow: 0 0 10px var(--tertiary-color);
                        margin-bottom: 1rem;
                    }

                    .user-info p {
                        margin: 0.5rem 0;
                        font-family: 'JetBrains Mono', monospace;
                    }

                    .btn {
                        padding: 1rem 2rem;
                        font-size: 1.1rem;
                        font-family: inherit;
                        border: 2px solid;
                        border-radius: 5px;
                        cursor: pointer;
                        text-decoration: none;
                        display: inline-block;
                        transition: all 0.3s ease;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin: 0.5rem;
                        position: relative;
                        overflow: hidden;
                    }

                    .btn-dashboard {
                        background: var(--nav-alt);
                        color: var(--button-alt);
                        border-color: var(--nav-alt);
                        box-shadow: 0 0 20px rgba(var(--nav-color-rgb), 0.5);
                    }

                    .btn-dashboard:hover {
                        background: var(--nav-color);
                        color: var(--nav-alt);
                        box-shadow: 0 0 30px var(--nav-alt);
                        transform: translateY(-2px);
                    }

                    .btn-terminal {
                        background: var(--tertiary-color);
                        color: white;
                        border-color: var(--tertiary-color);
                        box-shadow: 0 0 20px rgba(var(--tertiary-color-rgb), 0.5);
                    }

                    .btn-terminal:hover {
                        background: var(--secondary-alt);
                        border-color: var(--secondary-alt);
                        box-shadow: 0 0 30px var(--secondary-alt);
                        transform: translateY(-2px);
                    }

                    .countdown {
                        margin-top: 2rem;
                        font-size: 0.9rem;
                        color: var(--nav-alt);
                        opacity: 0.8;
                    }

                    /* Glitch effect for title */
                    .glitch {
                        position: relative;
                    }

                    .glitch::before,
                    .glitch::after {
                        content: attr(data-text);
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                    }

                    .glitch::before {
                        animation: glitch-1 2s infinite;
                        color: var(--nav-alt);
                        z-index: -1;
                    }

                    .glitch::after {
                        animation: glitch-2 2s infinite;
                        color: var(--secondary-alt);
                        z-index: -2;
                    }

                    @keyframes glitch-1 {
                        0%, 14%, 15%, 49%, 50%, 99%, 100% {
                            transform: translate(0);
                        }
                        15%, 49% {
                            transform: translate(-2px, 2px);
                        }
                    }

                    @keyframes glitch-2 {
                        0%, 20%, 21%, 62%, 63%, 99%, 100% {
                            transform: translate(0);
                        }
                        21%, 62% {
                            transform: translate(2px, -2px);
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success-icon">✅</div>
                    <h1 class="title glitch" data-text="🌸 PATREON AUTH SUCCESS 🌸">🌸 PATREON AUTH SUCCESS 🌸</h1>
                    <p class="subtitle">Welcome to BambiSleep Chat, ${userData.attributes?.full_name || 'Patron'}!</p>

                    <div class="user-info">
                        <h3>👤 Your Profile</h3>
                        <p><strong>Name:</strong> ${userData.attributes?.full_name || (userData.attributes?.first_name && userData.attributes?.last_name ? userData.attributes.first_name + ' ' + userData.attributes.last_name : 'Not provided')}</p>
                        <p><strong>First Name:</strong> ${userData.attributes?.first_name || 'Not provided'}</p>
                        <p><strong>Last Name:</strong> ${userData.attributes?.last_name || 'Not provided'}</p>
                        <p><strong>Patreon ID:</strong> ${userData.id}</p>
                        <p><strong>Email:</strong> ${userData.attributes?.email || 'Not provided'}</p>
                        <p><strong>Email Verified:</strong> ${userData.attributes?.is_email_verified ? 'Yes' : 'No'}</p>
                        <p><strong>Vanity URL:</strong> ${userData.attributes?.vanity || 'Not provided'}</p>
                        <p><strong>Account Created:</strong> ${userData.attributes?.created ? new Date(userData.attributes.created).toLocaleDateString() : 'Not provided'}</p>
                        <p><strong>About:</strong> ${userData.attributes?.about || 'Not provided'}</p>
                        ${userData.attributes?.image_url ? `<p><strong>Profile Image:</strong> <a href="${userData.attributes.image_url}" target="_blank">View Image</a></p>` : ''}

                        <!-- Debug Info -->
                        <details style="margin-top: 20px; font-family: monospace; font-size: 12px;">
                            <summary style="cursor: pointer; color: var(--nav-alt);">🔍 Debug Data (Click to expand)</summary>
                            <pre style="background: rgba(0,0,0,0.5); padding: 10px; border-radius: 5px; overflow: auto; max-height: 300px; white-space: pre-wrap;">${JSON.stringify(userData, null, 2)}</pre>
                        </details>
                    </div>

                    <div>
                        <a href="/dashboard" class="btn btn-dashboard">🏠 Go to Dashboard</a>
                        <a href="/terminal" class="btn btn-terminal">💬 Open Chat Terminal</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Patreon OAuth callback error:', error);
        return res.status(500).send(`
            <!DOCTYPE html>
            <html lang="en" class="cyber-terminal">
            <head>
                <title>🚨 AUTHENTICATION ERROR 🚨</title>
                <style>
                    :root {
                        /* FICKDICHSELBER.COM NEON CYBER GOTH WAVE PALETTE */
                        --primary-color: #0c2a2ac9;
                        --primary-alt: #15aab5ec;
                        --secondary-color: #40002f;
                        --secondary-alt: #cc0174;
                        --tertiary-color: #cc0174;
                        --tertiary-alt: #01c69eae;
                        --button-color: #df0471;
                        --button-alt: #110000;
                        --nav-color: #0a2626;
                        --nav-alt: #17dbd8;
                        --error: #ff3333;
                        --error-bg: rgba(255, 51, 51, 0.1);

                        /* RGB values for alpha compositing */
                        --primary-color-rgb: 12, 42, 42;
                        --secondary-color-rgb: 64, 0, 47;
                        --tertiary-color-rgb: 204, 1, 116;
                        --nav-color-rgb: 10, 38, 38;
                        --button-color-rgb: 223, 4, 113;
                        --error-rgb: 255, 51, 51;
                    }

                    @import url("https://fonts.googleapis.com/css2?family=Audiowide&family=Fira+Code:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap");

                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }

                    body {
                        font-family: 'Audiowide', 'JetBrains Mono', 'Fira Code', monospace;
                        background: var(--button-alt);
                        color: var(--primary-alt);
                        min-height: 100vh;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        position: relative;
                        overflow-x: hidden;
                    }

                    /* Error scanlines effect */
                    body::before {
                        content: '';
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100vh;
                        background: repeating-linear-gradient(0deg,
                            transparent,
                            transparent 2px,
                            rgba(var(--error-rgb), 0.05) 2px,
                            rgba(var(--error-rgb), 0.05) 4px);
                        pointer-events: none;
                        z-index: 1000;
                        animation: error-scanlines 0.1s linear infinite;
                    }

                    @keyframes error-scanlines {
                        0% { transform: translateY(0); }
                        100% { transform: translateY(4px); }
                    }

                    .container {
                        max-width: 600px;
                        padding: 2rem;
                        text-align: center;
                        background: var(--error-bg);
                        border: 2px solid var(--error);
                        border-radius: 10px;
                        box-shadow: 0 0 30px var(--error), 0 0 60px var(--error);
                        position: relative;
                        z-index: 10;
                    }

                    .error-icon {
                        font-size: 4rem;
                        color: var(--error);
                        margin-bottom: 1rem;
                        animation: error-pulse 1s ease-in-out infinite alternate;
                    }

                    @keyframes error-pulse {
                        from {
                            text-shadow: 0 0 20px var(--error);
                            transform: scale(1);
                        }
                        to {
                            text-shadow: 0 0 40px var(--error), 0 0 60px var(--error);
                            transform: scale(1.1);
                        }
                    }

                    .title {
                        font-size: 2rem;
                        color: var(--error);
                        text-shadow: 0 0 20px var(--error);
                        margin-bottom: 1rem;
                    }

                    .message {
                        font-size: 1.1rem;
                        color: var(--primary-alt);
                        margin-bottom: 2rem;
                        line-height: 1.6;
                    }

                    .error-details {
                        background: rgba(var(--secondary-color-rgb), 0.2);
                        border: 1px solid var(--secondary-color);
                        border-radius: 5px;
                        padding: 1rem;
                        margin: 1rem 0;
                        font-family: 'JetBrains Mono', monospace;
                        text-align: left;
                    }

                    .btn {
                        padding: 1rem 2rem;
                        font-size: 1.1rem;
                        font-family: inherit;
                        border: 2px solid;
                        border-radius: 5px;
                        cursor: pointer;
                        text-decoration: none;
                        display: inline-block;
                        transition: all 0.3s ease;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin: 0.5rem;
                    }

                    .btn-primary {
                        background: var(--tertiary-color);
                        color: white;
                        border-color: var(--tertiary-color);
                        box-shadow: 0 0 20px rgba(var(--tertiary-color-rgb), 0.5);
                    }

                    .btn-primary:hover {
                        background: var(--secondary-alt);
                        border-color: var(--secondary-alt);
                        box-shadow: 0 0 30px var(--secondary-alt);
                        transform: translateY(-2px);
                    }

                    .btn-secondary {
                        background: transparent;
                        color: var(--nav-alt);
                        border-color: var(--nav-alt);
                        box-shadow: 0 0 20px rgba(var(--nav-color-rgb), 0.5);
                    }

                    .btn-secondary:hover {
                        background: var(--nav-alt);
                        color: var(--button-alt);
                        box-shadow: 0 0 30px var(--nav-alt);
                        transform: translateY(-2px);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="error-icon">🚨</div>
                    <h1 class="title">AUTHENTICATION ERROR</h1>

                    <div class="message">
                        <p>A technical error occurred during the authentication process.</p>
                        <p>Please try again or contact support if the problem persists.</p>
                    </div>

                    <div class="error-details">
                        <p><strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error'}</p>
                    </div>

                    <div>
                        <a href="/auth/patreon" class="btn btn-primary">🔄 Try Again</a>
                        <a href="/" class="btn btn-secondary">← Back to Home</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    }
});

// Patreon webhook endpoint
app.use('/webhooks/patreon', createWebhookMiddleware(webhookHandler));

// Serve static files for agent integration
app.use('/static', express.static(path.join(__dirname, '../public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
        }
    }
}));

// Serve agent files directly from the main server
app.use('/agent-app', express.static(path.join(__dirname, '../../agent/js-bambisleep-chat-agent-dr-girlfriend/dist'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
        }
    }
}));

// Serve manifest.json with correct MIME type
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(__dirname, '../../agent/js-bambisleep-chat-agent-dr-girlfriend/public/manifest.json'));
});

// Serve manifest.json from agent-app path too
app.get('/agent-app/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(__dirname, '../../agent/js-bambisleep-chat-agent-dr-girlfriend/public/manifest.json'));
});

// Serve icons
app.use('/icons', express.static(path.join(__dirname, '../../agent/js-bambisleep-chat-agent-dr-girlfriend/public/icons'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.svg')) {
            res.setHeader('Content-Type', 'image/svg+xml');
        } else if (path.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
        }
    }
}));

// Serve landing page at root - redirect to agent terminal
app.get('/', (req, res) => {
    // Direct users to the agent terminal interface
    res.redirect('/agent-app');
});

// Redirect root to agent app for direct access
app.get('/app', (req, res) => {
    res.redirect('/agent-app');
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
        version: process.env.npm_package_version || '1.0.0',
        services: {
            patreon: !!process.env.PATREON_CLIENT_ID,
            github: !!process.env.GITHUB_CLIENT_ID,
            mcp: true,
            socketio: true
        }
    });
});

// API info endpoint
app.get('/api', (_req, res) => {
    res.json({
        name: 'BambiSleep Chat - MCP Server & Patreon Integration',
        version: process.env.npm_package_version || '1.0.0',
        endpoints: {
            health: '/health',
            auth: {
                github: '/auth/github',
                patreon: '/auth/patreon'
            },
            api: {
                mcp: '/api/mcp',
                dock: '/api/dock',
                patreon: '/api/patreon'
            },
            webhooks: {
                patreon: '/webhooks/patreon'
            },
            realtime: 'ws://localhost:6969/socket.io'
        },
        features: [
            'OAuth 2.0 Authentication (GitHub + Patreon)',
            'MCP Server with Agent Docking',
            'Real-time Socket.IO Communication',
            'Patreon Webhook Processing',
            'Austrian GDPR Compliance'
        ]
    });
});

// Socket.IO for real-time communication and MCP docking with error handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Add error handling for socket connections
    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
    });

    // Add connection error handling
    socket.on('connect_error', (error) => {
        console.error(`Connection error for ${socket.id}:`, error);
    });

    // Add disconnection handling with cleanup
    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
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
            // Use the integrated Patreon API client for verification
            if (patronCredentials.accessToken) {
                const apiClient = new PatreonAPIClient({
                    accessToken: patronCredentials.accessToken,
                    userAgent: process.env.PATREON_USER_AGENT
                });

                const user = await apiClient.getCurrentUser();
                const userData = Array.isArray(user.data) ? user.data[0] : user.data;

                socket.emit(`patron-verify-response-${requestId}`, {
                    success: true,
                    patronVerified: true,
                    bambisleepId: userData.id,
                    patronName: userData.attributes?.full_name,
                    patronEmail: userData.attributes?.email
                });
            } else {
                socket.emit(`patron-verify-response-${requestId}`, {
                    success: false,
                    error: 'Access token required for patron verification'
                });
            }
        } catch (error) {
            socket.emit(`patron-verify-response-${requestId}`, {
                success: false,
                error: error.message
            });
        }
    });

    // Patreon OAuth flow via Socket.IO
    socket.on('patreon-auth-request', (data) => {
        const { requestId } = data;
        const scopes = ['identity', 'identity[email]', 'campaigns', 'campaigns.members'];
        const authUrl = patreonOAuth.getAuthorizationUrl(scopes, requestId);

        socket.emit('patreon-auth-response', {
            requestId,
            authUrl,
            instructions: 'Open this URL in your browser to complete Patreon authentication'
        });
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

// Initialize Patreon Process Manager
async function initializePatreonService() {
    try {
        console.log('🔧 Initializing Patreon service...');
        const patreonManager = new PatreonProcessManager();

        // Store in app locals for access in routes
        app.locals.patreonManager = patreonManager;

        // Set up webhook event handlers
        patreonManager.on('webhook', (data) => {
            console.log('📨 Patreon webhook received:', data.type);
            // Emit to socket.io clients if needed
            io.emit('patreon:webhook', data);
        });

        patreonManager.on('error', (error) => {
            console.error('❌ Patreon service error:', error);
        });

        patreonManager.on('exit', (code, signal) => {
            console.log(`⚠️ Patreon service exited with code ${code}, signal ${signal}`);
        });

        // Start the Patreon worker
        await patreonManager.start();
        console.log('✅ Patreon service initialized successfully');

        return patreonManager;
    } catch (error) {
        console.error('❌ Failed to initialize Patreon service:', error);
        // Don't fail the entire server if Patreon service fails
        return null;
    }
}

// Start server
async function startServer() {
    // Initialize Patreon service (non-blocking)
    await initializePatreonService();

    // Start HTTP server
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
}

// Global error handlers for uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    // Graceful shutdown
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('� Unhandled Rejection at:', promise, 'reason:', reason);
    console.error('Stack:', reason?.stack);
    // Don't exit immediately for unhandled rejections in production
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

// Enhanced graceful shutdown
async function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);

    try {
        // Close Patreon manager first
        if (app.locals.patreonManager) {
            await app.locals.patreonManager.stop();
            console.log('🔌 Patreon manager stopped');
        }

        // Close Socket.IO server
        io.close(() => {
            console.log('🔌 Socket.IO server closed');
        });

        // Close HTTP server
        server.close(() => {
            console.log('🔌 HTTP server closed');
            process.exit(0);
        });

        // Force close after 10 seconds
        setTimeout(() => {
            console.error('⏰ Could not close connections in time, forcefully shutting down');
            process.exit(1);
        }, 10000);

    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer();

module.exports = { app, server, io };
