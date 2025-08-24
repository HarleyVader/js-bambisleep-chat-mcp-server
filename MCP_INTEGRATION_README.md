# MCP Server & Agent Dr Girlfriend Integration

This setup enables the js-bambisleep-chat-agent-dr-girlfriend to work with the MCP server through Austrian GDPR-compliant endpoints.

## Quick Setup

### 1. Start the MCP Server

```bash
cd f:\js-bambisleep-chat-mcp-server\server
npm install
npm run dev
```

The MCP server will start on `http://localhost:3000` with:
- Austrian-compliant agent docking endpoints
- GDPR data rights processing
- Patron verification system
- Real-time heartbeat monitoring

### 2. Start Agent Dr Girlfriend

```bash
cd f:\js-bambisleep-chat-mcp-server\agent\js-bambisleep-chat-agent-dr-girlfriend
npm install
npm run dev
```

The agent will start on `http://localhost:3004` and automatically detect the MCP server.

## How It Works

### Automatic Integration

1. **Agent Loads**: When the agent starts, it loads the MCP integration script
2. **Server Detection**: The script checks for MCP server availability at `http://localhost:3000`
3. **Service Replacement**: If found, it replaces the mock mcpDockingService with the real HTTP-based one
4. **Austrian Compliance**: All communication follows Austrian GDPR standards

### MCP Endpoints

The server provides these Austrian-compliant endpoints:

- `POST /api/agent-dock/establish-connection` - Create secure MCP connection
- `POST /api/agent-dock/:dockId/patron/verify` - Verify patron credentials
- `POST /api/agent-dock/:dockId/deposit` - Secure data deposit
- `POST /api/agent-dock/:dockId/gdpr` - Process GDPR data rights requests
- `POST /api/agent-dock/:dockId/heartbeat` - Keep connection alive

### Agent Integration Points

- **MCPDockingInterface Component**: UI for connecting to the server
- **useMCPDocking Hook**: React hook for MCP operations
- **mcpDockingService**: Automatically upgraded from mock to real HTTP service

## Testing the Integration

1. Open Agent Dr Girlfriend in your browser: `http://localhost:3004`
2. Navigate to the MCP Docking section
3. The server should auto-populate as `http://localhost:3000`
4. Try establishing a connection
5. Test patron verification with any credentials
6. Attempt data deposit operations

## Features

### Austrian GDPR Compliance
- Data minimization principles
- Right to erasure support
- Right to portability
- Austrian audit logging

### Security Features
- Compartmentalized access (Cold War spy protocols)
- Time-based credential validation
- Encrypted data transfers
- Heartbeat monitoring

### Development Features
- Hot reloading for both server and agent
- Detailed logging for debugging
- CORS configured for local development
- Automatic service detection and upgrade

## Troubleshooting

### Agent Not Connecting
- Ensure MCP server is running on port 3000
- Check browser console for CORS errors
- Verify the integration script loads successfully

### CORS Issues
- Server allows origins: localhost:3004, localhost:3000, localhost:3001
- Check browser network tab for failed requests
- Ensure both services are running on HTTP (not HTTPS) for development

### Service Not Upgrading
- Check browser console for "Real MCP Docking Service" messages
- Verify the integration script loads before the agent app
- Ensure server static files are accessible at `/static/`

## Architecture

```
┌─────────────────┐    HTTP/JSON    ┌──────────────────┐
│  Agent Dr GF    │ ────────────── │  MCP Server      │
│  (Port 3004)    │    Austrian     │  (Port 3000)     │
│                 │    Compliant    │                  │
│ ┌─────────────┐ │                 │ ┌──────────────┐ │
│ │ MCP UI      │ │                 │ │ Agent Dock   │ │
│ │ Component   │ │                 │ │ Routes       │ │
│ └─────────────┘ │                 │ └──────────────┘ │
│ ┌─────────────┐ │                 │ ┌──────────────┐ │
│ │ Real MCP    │ │                 │ │ Patron       │ │
│ │ Service     │ │                 │ │ Registry     │ │
│ └─────────────┘ │                 │ └──────────────┘ │
└─────────────────┘                 └──────────────────┘
```

The integration maintains the agent's Austrian character and GDPR compliance while providing real server connectivity.
