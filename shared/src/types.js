// Type definitions for MCP Server & Agent

/**
 * @typedef {Object} User
 * @property {string} id - User unique identifier
 * @property {string} provider - OAuth provider (github, patreon)
 * @property {string} username - Username
 * @property {string} displayName - Display name
 * @property {string} email - Email address
 * @property {string} avatarUrl - Avatar URL
 * @property {string} accessToken - OAuth access token
 */

/**
 * @typedef {Object} DockSession
 * @property {string} dockId - Unique dock session identifier
 * @property {string} agentId - Agent identifier
 * @property {string} userId - User identifier
 * @property {string} username - Username
 * @property {string} handshakeToken - Handshake token for authentication
 * @property {string[]} capabilities - Agent capabilities
 * @property {Object} metadata - Additional metadata
 * @property {string} status - Session status
 * @property {string} createdAt - Creation timestamp
 * @property {string} lastHeartbeat - Last heartbeat timestamp
 * @property {string} [completedAt] - Completion timestamp
 * @property {Object} [result] - Operation result
 */

/**
 * @typedef {Object} MCPTool
 * @property {string} name - Tool name
 * @property {string} description - Tool description
 * @property {Object} parameters - Tool parameters schema
 * @property {Object} [schema] - Input/output schema
 * @property {string} [registeredAt] - Registration timestamp
 * @property {string} [registeredBy] - Registered by user
 */

/**
 * @typedef {Object} GitOperation
 * @property {string} type - Operation type
 * @property {Object} payload - Operation payload
 * @property {string} [repoName] - Repository name
 * @property {string} [branch] - Branch name
 * @property {string} [message] - Commit message
 * @property {string[]} [files] - Files to operate on
 */

/**
 * @typedef {Object} GitHubOperation
 * @property {string} type - Operation type
 * @property {Object} payload - Operation payload
 * @property {string} [owner] - Repository owner
 * @property {string} [repo] - Repository name
 * @property {string} [title] - Title (for PR/issue)
 * @property {string} [body] - Body content
 */

/**
 * @typedef {Object} WebSocketMessage
 * @property {string} type - Message type
 * @property {Object} data - Message data
 * @property {string} [requestId] - Request identifier
 * @property {string} [error] - Error message
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Success status
 * @property {Object} [data] - Response data
 * @property {string} [error] - Error message
 * @property {string} [message] - Response message
 * @property {number} status - HTTP status code
 */

module.exports = {
    // Export type definitions for JSDoc
};
