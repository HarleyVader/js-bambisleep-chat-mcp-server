// MCP Protocol Constants
const MCP_PROTOCOL = {
    VERSION: '1.0.0',
    DEFAULT_TIMEOUT: 30000,
    HEARTBEAT_INTERVAL: 30000,
    MAX_TOOL_EXECUTION_TIME: 300000, // 5 minutes
};

// Dock Session States
const DOCK_STATES = {
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    TIMEOUT: 'timeout',
    ERROR: 'error'
};

// OAuth Providers
const OAUTH_PROVIDERS = {
    GITHUB: 'github',
    PATREON: 'patreon'
};

// Git Operations
const GIT_OPERATIONS = {
    CLONE: 'clone',
    CHECKOUT: 'checkout',
    CREATE_BRANCH: 'create-branch',
    COMMIT: 'commit',
    PUSH: 'push',
    PULL: 'pull',
    STATUS: 'status',
    ADD: 'add',
    DIFF: 'diff'
};

// GitHub Operations
const GITHUB_OPERATIONS = {
    CREATE_PR: 'create-pr',
    LIST_REPOS: 'list-repos',
    GET_REPO: 'get-repo',
    CREATE_ISSUE: 'create-issue',
    LIST_ISSUES: 'list-issues',
    COMMENT_PR: 'comment-pr',
    MERGE_PR: 'merge-pr'
};

// WebSocket Message Types
const WS_MESSAGE_TYPES = {
    DOCK_REQUEST: 'dock-request',
    DOCK_RESPONSE: 'dock-response',
    DOCK_HEARTBEAT: 'dock-heartbeat',
    DOCK_COMPLETED: 'dock-completed',
    GIT_OPERATION: 'git-operation',
    GITHUB_OPERATION: 'github-operation',
    TOOL_EXECUTION: 'tool-execution',
    ERROR: 'error'
};

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
};

module.exports = {
    MCP_PROTOCOL,
    DOCK_STATES,
    OAUTH_PROVIDERS,
    GIT_OPERATIONS,
    GITHUB_OPERATIONS,
    WS_MESSAGE_TYPES,
    HTTP_STATUS
};
