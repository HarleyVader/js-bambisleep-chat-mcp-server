# Development Plan for MCP Server & Agent Docking

This six-week roadmap breaks the project into focused sprints, each leveraging the specified tools. Every sprint ends with a runnable milestone so you can validate progress and iterate.

## Overview Table

| Week | Focus | Key Tools |
|------|-------|-----------|
| 1 | Project Setup & Environment | dotenv, cross-env, concurrently, nodemon |
| 2 | Authentication & OAuth | passport, passport-github2, @oauth-everything/passport-patreon, express-session |
| 3 | MCP Core & Tool Management | modelcontextprotocol, ajv, fs-extra, child_process |
| 4 | GitHub Integration | @octokit/rest, simple-git |
| 5 | Server Routing & Real-Time Communication | express (or koa), cors, body-parser, helmet, socket.io, eventsource |
| 6 | Persistence, Testing & Deployment | sqlite3 (or pg/redis), sequelize (or knex), jest, supertest, eslint, prettier, Docker stack |

## Week 1: Project Setup & Environment

### Initialize monorepo structure

- Create root `package.json` and use `concurrently` to launch server & agent
- Add `cross-env` for cross-platform ENV support

### Environment configuration

- Install `dotenv` and scaffold `.env.example` with placeholders for OAuth keys, DB URL, MCP settings

### Dev workflow automation

- Configure `nodemon` for hot-reload on server code changes
- Add linting & formatting hooks: install `eslint` and `prettier`, set up pre-commit with Husky (optional)

**Milestone:** Running `npm run dev` starts both services with environment variables loaded and code auto-reloading.

## Week 2: Authentication & OAuth

### Session management

- Install and configure `express-session` (or Koa equivalent)
- Secure sessions with `helmet` recommendations from Week 5

### Passport core setup

- Integrate `passport` middleware, initialize in your Express/Koa app

### Strategy implementations

- Add `passport-github2` for GitHub OAuth
- Add `@oauth-everything/passport-patreon` for Patreon OAuth
- Wire up callbacks to read/write session and persist user info

### Environment secret loading

- Use `dotenv` to load client IDs, secrets, callback URLs

**Milestone:** Users can log in via GitHub and Patreon; session persists across requests.

## Week 3: MCP Core & Tool Management

### SDK integration

- Install or fork `modelcontextprotocol` and expose basic tool registry
- Write bootstrap code to register tools at server startup

### Input/output validation

- Define JSON schemas for each tool's interface and compile with `ajv`

### Tool execution layer

- Use `fs-extra` to manage temporary workspaces for tools
- Spawn tool processes via `child_process` and pipe stdout/stderr

**Milestone:** MCP server can list available tools, validate input payloads, and execute a dummy "hello world" tool.

## Week 4: GitHub Integration

### Git operations wrapper

- Install `simple-git` and build utilities to clone, checkout branches, commit, and push

### GitHub API client

- Set up `@octokit/rest` with token from environment
- Implement functions to create PRs, list issues, comment on PRs

### Docking workflow

- In the agent code, use Octokit and simple-git to fetch the MCP repo, branch, and apply patches

**Milestone:** Agent can clone the MCP server repo, make a test change, and open a pull request via GitHub API.

## Week 5: Server Routing & Real-Time Communication

### Core HTTP server

- Finalize either Express or Koa app
- Add `cors`, `body-parser`, and harden with `helmet`

### Dock endpoint & WebSocket

- Implement `POST /api/dock` to validate agent credentials and return handshake token
- Integrate `socket.io` for bi-directional docking events

### SSE fallback

- Provide an EventSource endpoint for agents that can't use WebSocket

**Milestone:** Frontend client and agent can perform a live handshake, exchanging status updates in real time.

## Week 6: Persistence, Testing & Deployment

### Database integration

- Pick `sqlite3` for local dev (or `pg`/`redis` for more advanced needs)
- Use `sequelize` or `knex` to define models: users, sessions, dock requests, tool runs

### Automated testing

- Write unit tests with `jest` for core logic
- Use `supertest` to test HTTP routes and SSE/WebSocket flows
- Enforce code quality with `eslint` and auto-format with `prettier`

### DevOps & Deployment

- Create Dockerfiles for server and agent
- Write `docker-compose.yml` to bring up multi-container stack
- Add a basic CI workflow (GitHub Actions) that lints, tests, and builds images

**Milestone:** Full project runs in Docker, passes CI checks, and preserves state across restarts.

## Next Steps

Once you hit these milestones, you can iterate on:

- Monitoring and metrics
- Advanced contract testing to ensure docking protocol remains rock-solid
- Performance optimization
- Security hardening
- Documentation and API reference

## Project Structure

```text
js-bambisleep-chat-mcp-server/
├── server/                 # MCP Server implementation
│   ├── src/
│   │   ├── auth/          # OAuth strategies and session management
│   │   ├── mcp/           # MCP protocol implementation
│   │   ├── routes/        # Express/Koa routes
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

## Development Guidelines

1. **Code Quality**: Use ESLint and Prettier for consistent code formatting
2. **Testing**: Maintain >80% test coverage for core functionality
3. **Security**: Follow OWASP guidelines, especially for OAuth and session management
4. **Documentation**: Document all APIs and major architectural decisions
5. **Git Workflow**: Use feature branches and pull requests for all changes
6. **Environment**: Never commit secrets; use `.env` files with clear documentation
