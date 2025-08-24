const Ajv = require('ajv');
const { isValidEmail, isEmpty } = require('./utils');

const ajv = new Ajv();

// User validation schema
const userSchema = {
    type: 'object',
    properties: {
        id: { type: 'string', minLength: 1 },
        provider: { type: 'string', enum: ['github', 'patreon'] },
        username: { type: 'string', minLength: 1 },
        displayName: { type: 'string' },
        email: { type: 'string', format: 'email' },
        avatarUrl: { type: 'string', format: 'uri' },
        accessToken: { type: 'string', minLength: 1 }
    },
    required: ['id', 'provider', 'username'],
    additionalProperties: true
};

// Dock session validation schema
const dockSessionSchema = {
    type: 'object',
    properties: {
        agentId: { type: 'string', minLength: 1 },
        capabilities: {
            type: 'array',
            items: { type: 'string' }
        },
        metadata: { type: 'object' }
    },
    required: ['agentId'],
    additionalProperties: true
};

// Tool validation schema
const toolSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', minLength: 1 },
        description: { type: 'string', minLength: 1 },
        parameters: { type: 'object' },
        schema: { type: 'object' }
    },
    required: ['name', 'description', 'parameters'],
    additionalProperties: true
};

// Git operation validation schema
const gitOperationSchema = {
    type: 'object',
    properties: {
        type: {
            type: 'string',
            enum: ['clone', 'checkout', 'create-branch', 'commit', 'push', 'pull', 'status', 'add', 'diff']
        },
        payload: { type: 'object' }
    },
    required: ['type', 'payload'],
    additionalProperties: false
};

// GitHub operation validation schema
const githubOperationSchema = {
    type: 'object',
    properties: {
        type: {
            type: 'string',
            enum: ['create-pr', 'list-repos', 'get-repo', 'create-issue', 'list-issues', 'comment-pr', 'merge-pr']
        },
        payload: { type: 'object' }
    },
    required: ['type', 'payload'],
    additionalProperties: false
};

// Compile validators
const validateUser = ajv.compile(userSchema);
const validateDockSession = ajv.compile(dockSessionSchema);
const validateTool = ajv.compile(toolSchema);
const validateGitOperation = ajv.compile(gitOperationSchema);
const validateGitHubOperation = ajv.compile(githubOperationSchema);

/**
 * Validate user object
 * @param {Object} user - User object to validate
 * @returns {Object} Validation result
 */
function validateUserObject(user) {
    const isValid = validateUser(user);

    // Additional email validation
    if (user.email && !isValidEmail(user.email)) {
        return {
            isValid: false,
            errors: [{ message: 'Invalid email format' }]
        };
    }

    return {
        isValid,
        errors: isValid ? [] : validateUser.errors
    };
}

/**
 * Validate dock session data
 * @param {Object} sessionData - Session data to validate
 * @returns {Object} Validation result
 */
function validateDockSessionData(sessionData) {
    const isValid = validateDockSession(sessionData);
    return {
        isValid,
        errors: isValid ? [] : validateDockSession.errors
    };
}

/**
 * Validate tool object
 * @param {Object} tool - Tool object to validate
 * @returns {Object} Validation result
 */
function validateToolObject(tool) {
    const isValid = validateTool(tool);
    return {
        isValid,
        errors: isValid ? [] : validateTool.errors
    };
}

/**
 * Validate git operation
 * @param {Object} operation - Git operation to validate
 * @returns {Object} Validation result
 */
function validateGitOperationObject(operation) {
    const isValid = validateGitOperation(operation);
    return {
        isValid,
        errors: isValid ? [] : validateGitOperation.errors
    };
}

/**
 * Validate GitHub operation
 * @param {Object} operation - GitHub operation to validate
 * @returns {Object} Validation result
 */
function validateGitHubOperationObject(operation) {
    const isValid = validateGitHubOperation(operation);
    return {
        isValid,
        errors: isValid ? [] : validateGitHubOperation.errors
    };
}

/**
 * Validate environment variables
 * @param {Object} env - Environment variables object
 * @returns {Object} Validation result
 */
function validateEnvironment(env) {
    const errors = [];

    // Required environment variables
    const required = [
        'SESSION_SECRET',
        'GITHUB_CLIENT_ID',
        'GITHUB_CLIENT_SECRET'
    ];

    for (const key of required) {
        if (isEmpty(env[key])) {
            errors.push({ message: `Missing required environment variable: ${key}` });
        }
    }

    // Validate URLs if provided
    const urlVars = ['GITHUB_CALLBACK_URL', 'PATREON_CALLBACK_URL', 'CORS_ORIGIN'];
    for (const key of urlVars) {
        if (env[key] && !isValidUrl(env[key])) {
            errors.push({ message: `Invalid URL format for ${key}: ${env[key]}` });
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} Is valid URL
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Generic input validation function
 * @param {object} data - Data to validate
 * @param {object} schema - Validation schema with field requirements
 * @returns {object} Validation result with isValid boolean and errors array
 */
function validateInput(data, schema) {
    const errors = [];

    if (!data || typeof data !== 'object') {
        return {
            isValid: false,
            errors: ['Input data must be an object']
        };
    }

    for (const [field, rules] of Object.entries(schema)) {
        const value = data[field];

        // Check required fields
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(`Field '${field}' is required`);
            continue;
        }

        // Skip validation if field is not required and not provided
        if (!rules.required && (value === undefined || value === null)) {
            continue;
        }

        // Type validation
        if (rules.type) {
            const actualType = typeof value;
            if (rules.type === 'array' && !Array.isArray(value)) {
                errors.push(`Field '${field}' must be an array`);
                continue;
            } else if (rules.type !== 'array' && actualType !== rules.type) {
                errors.push(`Field '${field}' must be of type ${rules.type}`);
                continue;
            }
        }

        // String validations
        if (typeof value === 'string') {
            if (rules.minLength && value.length < rules.minLength) {
                errors.push(`Field '${field}' must be at least ${rules.minLength} characters long`);
            }
            if (rules.maxLength && value.length > rules.maxLength) {
                errors.push(`Field '${field}' must be no more than ${rules.maxLength} characters long`);
            }
            if (rules.pattern && !rules.pattern.test(value)) {
                errors.push(`Field '${field}' does not match the required pattern`);
            }
        }

        // Number validations
        if (typeof value === 'number') {
            if (rules.min && value < rules.min) {
                errors.push(`Field '${field}' must be at least ${rules.min}`);
            }
            if (rules.max && value > rules.max) {
                errors.push(`Field '${field}' must be no more than ${rules.max}`);
            }
        }

        // Boolean validations
        if (typeof value === 'boolean' && rules.value !== undefined) {
            if (value !== rules.value) {
                errors.push(`Field '${field}' must be ${rules.value}`);
            }
        }

        // Custom validation function
        if (rules.validate && typeof rules.validate === 'function') {
            const customResult = rules.validate(value);
            if (customResult !== true) {
                errors.push(customResult || `Field '${field}' failed custom validation`);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Sanitize and validate input data
 * @param {Object} data - Data to sanitize
 * @param {string[]} allowedFields - Allowed fields
 * @returns {Object} Sanitized data
 */
function sanitizeInput(data, allowedFields = []) {
    if (!data || typeof data !== 'object') return {};

    const sanitized = {};
    for (const field of allowedFields) {
        if (data.hasOwnProperty(field)) {
            sanitized[field] = data[field];
        }
    }

    return sanitized;
}

module.exports = {
    validateUser: validateUserObject,
    validateDockSession: validateDockSessionData,
    validateTool: validateToolObject,
    validateGitOperation: validateGitOperationObject,
    validateGitHubOperation: validateGitHubOperationObject,
    validateEnvironment,
    validateInput,
    isValidUrl,
    sanitizeInput
};
