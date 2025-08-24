# Contributing to MCP Server & Agent Docking System

Thank you for your interest in contributing to the MCP Server & Agent Docking System! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, please include:

- A clear and descriptive title
- Steps to reproduce the behavior
- Expected behavior
- Actual behavior
- Your environment (OS, Node.js version, etc.)
- Relevant logs or error messages

### Suggesting Features

We welcome feature suggestions! Please:

- Check existing feature requests first
- Provide a clear description of the feature
- Explain why this feature would be useful
- Consider the scope and complexity

### Pull Requests

1. **Fork the repository** and create your feature branch from `main`
2. **Make your changes** following our coding standards
3. **Add tests** for new functionality
4. **Ensure all tests pass** by running `npm test`
5. **Run linting** with `npm run lint:fix`
6. **Update documentation** if needed
7. **Submit a pull request** with a clear description

## Development Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/HarleyVader/js-bambisleep-chat-mcp-server.git
   cd js-bambisleep-chat-mcp-server
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment**:

   ```bash
   cp .env.example .env
   # Configure your environment variables
   ```

4. **Start development**:

   ```bash
   npm run dev
   ```

## Coding Standards

### JavaScript Style

- Use ESLint configuration provided in the project
- Follow Prettier formatting rules
- Use meaningful variable and function names
- Add JSDoc comments for functions and classes
- Prefer `const` over `let`, avoid `var`

### Git Commit Messages

- Use clear and meaningful commit messages
- Start with a verb in present tense (Add, Fix, Update, etc.)
- Include relevant issue numbers
- Keep the first line under 50 characters
- Use the body to explain what and why, not how

Example:

```text
Add WebSocket reconnection logic

- Implement exponential backoff for reconnection attempts
- Add maximum retry limit to prevent infinite loops
- Update agent to handle connection state changes

Fixes #123
```

### Testing

- Write tests for new features and bug fixes
- Maintain or improve code coverage
- Test both happy path and error scenarios
- Use descriptive test names

### Documentation

- Update README.md for significant changes
- Add JSDoc comments for new functions
- Update API documentation if applicable
- Include examples for new features

## Project Structure

```text
js-bambisleep-chat-mcp-server/
├── server/                 # MCP Server implementation
├── agent/                 # GitHub integration agent
├── shared/                # Shared utilities and types
├── docker/                # Docker configurations
├── .github/               # GitHub templates and workflows
└── docs/                  # Additional documentation
```

## Component Guidelines

### MCP Server

- Follow Express.js best practices
- Implement proper error handling
- Use middleware for common functionality
- Validate all inputs

### MCP Agent

- Handle GitHub API rate limits
- Implement proper retry logic
- Use structured logging
- Handle network failures gracefully

### Shared Components

- Keep utilities pure and testable
- Provide comprehensive type definitions
- Maintain backward compatibility
- Add validation for all inputs

## Release Process

1. Update version numbers in package.json files
2. Update CHANGELOG.md with new features and fixes
3. Create a pull request for the release
4. Tag the release after merging
5. Create GitHub release with release notes

## Questions?

If you have questions about contributing, please:

1. Check the existing documentation
2. Search through existing issues
3. Create a new issue with the "question" label
4. Join our discussions in the repository

Thank you for contributing to the MCP Server & Agent Docking System!
