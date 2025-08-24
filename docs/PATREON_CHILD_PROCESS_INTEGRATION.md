# Patreon Child Process Integration

## Overview

The Patreon module has been successfully integrated as a child process that runs directly from the main server instead of as a separate Express HTTP server. This approach provides better resource management, unified logging, and easier deployment.

## Architecture

### Components

1. **Main Server (`server/src/server.js`)**
   - Initializes and manages the Patreon child process
   - Provides REST API endpoints for Patreon operations
   - Handles graceful shutdown of child processes

2. **Patreon Process Manager (`server/src/services/patreon-process-manager.js`)**
   - Manages the lifecycle of the Patreon worker process
   - Provides IPC (Inter-Process Communication) between server and worker
   - Handles automatic restarts and error recovery

3. **Patreon Worker (`server/src/services/patreon-worker.js`)**
   - CommonJS worker process that handles actual Patreon API operations
   - Communicates with parent via IPC messages
   - Uses native Node.js HTTP(S) modules for reliability

4. **Patreon Routes (`server/src/routes/patreon.js`)**
   - REST API endpoints for OAuth, API calls, and webhooks
   - Session management for user authentication
   - Error handling and validation

## Configuration

### Environment Variables

The Patreon integration uses the main server's `.env` file:

```env
# Patreon API Configuration
PATREON_CLIENT_ID=your_patreon_client_id_here
PATREON_CLIENT_SECRET=your_patreon_client_secret_here
PATREON_CREATOR_ACCESS_TOKEN=your_patreon_creator_access_token_here
PATREON_CREATOR_REFRESH_TOKEN=your_patreon_creator_refresh_token_here
PATREON_REDIRECT_URI=https://fickdichselber.com/auth/patreon/callback
PATREON_WEBHOOK_SECRET=your_patreon_webhook_secret_here

# Patreon Rate Limiting Configuration
PATREON_RATE_LIMIT_REQUESTS_PER_MINUTE=90
PATREON_RATE_LIMIT_REQUESTS_PER_2_SECONDS=95

# Patreon Application Configuration
PATREON_APP_NAME=BambiSleep-Chat-Patreon
PATREON_USER_AGENT=BambiSleep-Chat-Patreon/1.0.0

# Patreon Server Configuration
PATREON_SERVER_PORT=8888
PATREON_SERVER_HOST=localhost
```

## API Endpoints

All Patreon endpoints are available under `/api/patreon/`:

### Authentication Endpoints

- `GET /api/patreon/auth/url?scopes=identity,campaigns` - Generate OAuth authorization URL
- `POST /api/patreon/auth/token` - Exchange authorization code for tokens
- `POST /api/patreon/auth/refresh` - Refresh access tokens

### API Endpoints (Require Authentication)

- `GET /api/patreon/user` - Get current user information
- `GET /api/patreon/campaigns` - Get user's campaigns
- `GET /api/patreon/campaigns/:campaignId/members` - Get campaign members
- `GET /api/patreon/campaigns/:campaignId/posts` - Get campaign posts

### Webhook Endpoints

- `POST /api/patreon/webhooks/patreon` - Handle Patreon webhooks

### Status Endpoints

- `GET /api/patreon/health` - Health check with ping test
- `GET /api/patreon/status` - Service status information

## Usage Examples

### 1. OAuth Flow

```javascript
// Step 1: Get authorization URL
const response = await fetch('/api/patreon/auth/url?scopes=identity,campaigns');
const { authUrl } = await response.json();

// Step 2: User visits authUrl and authorizes
// Step 3: Exchange code for tokens
const tokenResponse = await fetch('/api/patreon/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'authorization_code_from_callback' })
});
```

### 2. API Calls

```javascript
// Get current user (requires session with tokens)
const userResponse = await fetch('/api/patreon/user');
const { user } = await userResponse.json();

// Get campaigns
const campaignsResponse = await fetch('/api/patreon/campaigns');
const { campaigns } = await campaignsResponse.json();
```

### 3. Webhook Handling

The server automatically handles webhook signature verification and processing. Webhook events are emitted to Socket.IO clients:

```javascript
// Client-side Socket.IO listener
socket.on('patreon:webhook', (data) => {
    console.log('Patreon webhook received:', data.type);
    // Handle different webhook types
    switch (data.type) {
        case 'members:create':
            // Handle new member
            break;
        case 'members:update':
            // Handle member update
            break;
        // ... other webhook types
    }
});
```

## Process Management

### Startup

The Patreon service is automatically initialized when the main server starts:

```text
🔧 Initializing Patreon service...
Patreon worker is ready, PID: 12444
✅ Patreon service initialized successfully
```

### Health Monitoring

The process manager includes:

- Automatic restart on failure (up to 3 attempts)
- Health check via ping/pong messages
- Graceful shutdown handling

### Error Handling

- Failed API requests return proper HTTP status codes
- Process crashes are logged and trigger automatic restarts
- Service unavailability returns 503 status with appropriate error messages

## Benefits of Child Process Architecture

1. **Resource Isolation**: Patreon operations run in a separate process
2. **Fault Tolerance**: Worker crashes don't affect the main server
3. **Scalability**: Easy to scale by spawning multiple workers
4. **Unified Configuration**: Uses the same `.env` file as the main server
5. **Integrated Logging**: All logs appear in the main server console
6. **Simplified Deployment**: No need to manage multiple HTTP servers

## Development

### Running the Server

```bash
cd server
npm run dev
```

The Patreon service will automatically start as a child process.

### Testing Endpoints

```bash
# Test service status
curl http://localhost:6969/api/patreon/status

# Test health check
curl http://localhost:6969/api/patreon/health

# Test OAuth URL generation
curl "http://localhost:6969/api/patreon/auth/url?scopes=identity,campaigns"
```

## Troubleshooting

### Common Issues

1. **Service Not Starting**: Check that all required environment variables are set
2. **Worker Process Fails**: Check the console logs for specific error messages
3. **API Errors**: Verify Patreon credentials and check rate limits

### Logs

All Patreon-related logs appear in the main server console with appropriate prefixes:

- `🔧 Initializing Patreon service...`
- `✅ Patreon service initialized successfully`
- `❌ Patreon service error:` (for errors)
- `📨 Patreon webhook received:` (for webhooks)

## Migration Notes

- The standalone Patreon server (`patreon/src/server.ts`) is no longer used in production
- All Patreon functionality is now accessed through the main server's API routes
- Webhook endpoints have moved from the Patreon server to the main server
- OAuth callbacks should be updated to point to the main server's domain
