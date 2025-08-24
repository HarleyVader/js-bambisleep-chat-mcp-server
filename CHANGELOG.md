# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Initial project setup and repository creation

## [1.0.0] - 2025-08-24

### Added

- Complete monorepo structure with server, agent, and shared workspaces
- Express-based MCP server with comprehensive routing
- OAuth authentication system with GitHub integration
- GitHub API integration agent with full repository management
- Real-time WebSocket communication for docking protocol
- Tool registry and execution system with validation
- Docker containerization with multi-service setup
- Comprehensive testing framework with Jest
- Code quality tools (ESLint, Prettier)
- Development workflow with hot-reload using nodemon
- Environment configuration with detailed .env.example
- Security middleware and best practices implementation
- Session management with express-session
- Input validation using AJV JSON schema
- Git operations service with simple-git integration
- Shared utilities and type definitions
- GitHub repository configuration with issue templates
- Contributing guidelines and security policy
- CI/CD pipeline with automated testing and security scanning

### Technical Details

#### MCP Server Features

- OAuth 2.0 integration (GitHub ready, Patreon placeholder)
- Session-based authentication with secure cookies
- RESTful API endpoints for authentication, MCP operations, and docking
- WebSocket support for real-time communication
- Tool registry with dynamic registration and execution
- Comprehensive error handling and logging
- Health check endpoints for monitoring

#### MCP Agent Features

- GitHub API client with full repository operations
- Git operations for code manipulation and version control
- WebSocket client for server communication
- Docking protocol with handshake and heartbeat system
- Graceful startup and shutdown handling
- Retry logic and error recovery

#### Infrastructure

- Docker multi-container setup with Redis
- Development and production configurations
- Automated dependency management
- Security scanning and vulnerability checking
- Code quality enforcement with linting and formatting
- Comprehensive test coverage setup

### Dependencies

- Express.js 4.18.2 for web server
- Socket.IO 4.7.5 for real-time communication
- Passport.js with GitHub OAuth strategy
- @octokit/rest 20.0.2 for GitHub API integration
- simple-git 3.20.0 for Git operations
- AJV 8.12.0 for JSON schema validation
- fs-extra 11.2.0 for file system operations
- SQLite3 5.1.6 for database (with PostgreSQL option)
- Jest 29.7.0 for testing framework
- ESLint 8.57.0 and Prettier 3.2.5 for code quality

### Security Features

- Helmet.js for security headers
- CORS configuration for cross-origin requests
- Input sanitization and validation
- Environment variable protection for secrets
- Session security with secure cookies
- Docker security with non-root users

### Development Experience

- Hot-reload development environment
- Comprehensive error handling and logging
- Structured project organization
- Detailed documentation and setup guides
- Automated code formatting and linting
- Git hooks for code quality enforcement

[Unreleased]: https://github.com/HarleyVader/js-bambisleep-chat-mcp-server/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/HarleyVader/js-bambisleep-chat-mcp-server/releases/tag/v1.0.0
