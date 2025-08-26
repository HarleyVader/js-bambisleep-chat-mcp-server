# 🤖 BambiSleep Multi-Agent Deployment Guide

## Overview
The BambiSleep MCP Server now supports multiple AI agents with automatic discovery and deployment. This guide covers how to add new agents and deploy them.

## Agent Structure

### Agent Naming Convention
All agents must follow this naming pattern:
```
js-bambisleep-chat-agent-{agent-name}/
```

### Required Files
Each agent must have:
- `package.json` with name, version, description
- `webpack.config.js` or similar build configuration
- `dist/` folder after building (contains built application)
- `public/` folder with static assets (manifest.json, icons, favicons)

### Directory Structure Example
```
agent/
├── js-bambisleep-chat-agent-dr-girlfriend/
│   ├── package.json
│   ├── webpack.config.js
│   ├── src/
│   ├── public/
│   │   ├── manifest.json
│   │   ├── favicon.svg
│   │   ├── favicon.png
│   │   ├── apple-touch-icon.png
│   │   └── icons/
│   └── dist/ (generated after build)
└── js-bambisleep-chat-agent-{new-agent}/
    └── ... (same structure)
```

## Automatic Agent Discovery

The server automatically:
1. Scans `/agent` folder for directories matching `js-bambisleep-chat-agent-*`
2. Checks for `package.json` and `dist/` folder
3. Registers routes at `/agent/{agent-name}`
4. Serves static files with proper MIME types
5. Provides API endpoints for agent information

## Adding New Agents

### Method 1: Git Submodules (Recommended)
```bash
cd agent/
git submodule add https://github.com/your-org/js-bambisleep-chat-agent-newagent.git
cd js-bambisleep-chat-agent-newagent/
npm install
npm run build
```

### Method 2: Direct Git Clone
```bash
cd agent/
git clone https://github.com/your-org/js-bambisleep-chat-agent-newagent.git
cd js-bambisleep-chat-agent-newagent/
npm install
npm run build
```

### Method 3: Local Development
```bash
cd agent/
cp -r js-bambisleep-chat-agent-dr-girlfriend js-bambisleep-chat-agent-newagent
cd js-bambisleep-chat-agent-newagent/
# Modify package.json, src files, etc.
npm install
npm run build
```

## Building Agents

### Build Single Agent
```bash
cd agent/js-bambisleep-chat-agent-{name}/
npm install
npm run build
```

### Build All Agents
```powershell
# Windows PowerShell
.\scripts\build-agents.ps1
```

```bash
# Linux/Mac (create equivalent bash script)
./scripts/build-agents.sh
```

## Agent Configuration

### Webpack PublicPath
Each agent's webpack.config.js must set the correct publicPath:
```javascript
export default {
  output: {
    publicPath: '/agent/{agent-name}/',
  },
};
```

### Static Assets
Ensure your HTML template uses relative paths for favicons and manifest:
```html
<link rel="manifest" href="./manifest.json">
<link rel="icon" type="image/svg+xml" href="./favicon.svg">
```

## Server Routes

### Agent Routes
- `/agent/{agent-name}` - Agent application
- `/agent/{agent-name}/manifest.json` - PWA manifest
- `/agent/{agent-name}/icons/` - Icon assets

### API Routes
- `/api/agents` - List all available agents
- `/api/agents/{agent-name}` - Get specific agent info

### Legacy Routes (Backward Compatibility)
- `/agent-app` - Redirects to dr-girlfriend agent
- `/` - Shows agent selection or redirects to single agent

## Deployment Process

### Production Deployment
1. **Build all agents**:
   ```bash
   cd server/
   npm run build-agents  # or .\scripts\build-agents.ps1
   ```

2. **Commit and push**:
   ```bash
   git add -A
   git commit -m "Add new agent: {agent-name}"
   git push origin main
   ```

3. **Server automatically discovers and serves the new agent**

### Hot Deployment (Without Server Restart)
The server scans for agents on startup. For hot deployment:
1. Build the new agent
2. The agent will be available immediately at `/agent/{agent-name}`

## Agent Development Guidelines

### Package.json Requirements
```json
{
  "name": "js-bambisleep-chat-agent-{name}",
  "version": "1.0.0",
  "description": "Your agent description",
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack serve --mode development"
  }
}
```

### Build Output Requirements
- Must generate `dist/` folder
- Must include `index.html` as entry point
- All assets must be self-contained in dist/
- JavaScript/CSS files served with correct MIME types

### MCP Integration
Include MCP integration script in your HTML:
```html
<script src="/static/mcp-integration.js" defer></script>
```

## Troubleshooting

### Agent Not Discovered
- Check naming convention: `js-bambisleep-chat-agent-*`
- Ensure `package.json` exists and is valid JSON
- Verify `dist/` folder exists after building

### MIME Type Errors
- Ensure webpack publicPath is set correctly
- Check that static files are copied to dist/
- Verify server MIME type headers

### Build Failures
- Check Node.js and npm versions
- Verify all dependencies are installed
- Check webpack configuration
- Review build logs for specific errors

## Security Considerations

- Agents are served with CSP headers
- Static files only from agent's dist/ folder
- No dynamic script execution
- Manifest.json validated before serving

## Performance Optimization

- Assets are compressed in production
- Browser caching enabled for static files
- Bundle splitting for faster loading
- Only built agents are served (development files ignored)
