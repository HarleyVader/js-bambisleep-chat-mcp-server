# MCP Server & Agent Docking System

A comprehensive Model Context Protocol (MCP) server with GitHub integration and OAuth authentication.

## Quick Start

1. **Clone and setup**:

   ```bash
   git clone <your-repo-url>
   cd js-bambisleep-chat-mcp-server
   npm install
   ```

2. **Configure environment**:

   ```bash
   cp .env.example .env
   # Edit .env with your OAuth credentials and settings
   ```

3. **Start development**:

   ```bash
   npm run dev
   ```

## Project Structure

```
js-bambisleep-chat-mcp-server/
├── server/                 # MCP Server implementation
│   ├── src/
│   │   ├── auth/          # OAuth strategies and session management
│   │   ├── mcp/           # MCP protocol implementation
│   │   ├── routes/        # Express routes
│   │   ├── models/        # Database models
│   │   └── app.js         # Main server entry point
│   ├── tests/
│   └── package.json
├── agent/                 # Agent for GitHub integration
│   ├── src/
│   │   ├── github/        # GitHub API integration
│   │   ├── git/           # Git operations
│   │   └── agent.js       # Main agent entry point
│   ├── tests/
│   └── package.json
├── shared/                # Shared utilities and types
├── docker/                # Docker configurations
├── .env.example
├── docker-compose.yml
├── package.json           # Root package.json for monorepo
└── README.md
```

## Features

- **MCP Protocol Support**: Full implementation of Model Context Protocol
- **OAuth Authentication**: GitHub and Patreon integration
- **GitHub Integration**: Automated PR creation and repository management
- **Real-time Communication**: WebSocket and SSE support
- **Tool Management**: Dynamic tool registration and execution
- **Docker Support**: Complete containerization

## Development

### Scripts

- `npm run dev` - Start both server and agent in development mode
- `npm run build` - Build all workspaces
- `npm run test` - Run tests across all workspaces
- `npm run lint` - Lint all code
- `npm run format` - Format code with Prettier

### Environment Setup

Copy `.env.example` to `.env` and configure:

1. **GitHub OAuth**: Create OAuth app in GitHub settings
2. **Patreon OAuth**: Create OAuth app in Patreon developer console
3. **Database**: Configure your preferred database
4. **Session**: Generate secure session secret

## Architecture

The system consists of three main components:

1. **Server**: Express-based MCP server with OAuth and real-time communication
2. **Agent**: GitHub integration service for automated repository operations
3. **Shared**: Common utilities and type definitions

## Contributing

1. Create feature branch
2. Make changes with tests
3. Ensure lint/format passes
4. Submit pull request

## License

MIT
