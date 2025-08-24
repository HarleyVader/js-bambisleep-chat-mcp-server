const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Store active dock sessions
const activeDocks = new Map();

// Cleanup expired dock sessions (prevent memory leaks)
const DOCK_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const cleanupExpiredDocks = () => {
    const now = Date.now();
    for (const [dockId, dock] of activeDocks.entries()) {
        const lastActivity = new Date(dock.lastHeartbeat).getTime();
        if (now - lastActivity > DOCK_TIMEOUT) {
            console.log(`🧹 Cleaning up expired dock session: ${dockId}`);
            activeDocks.delete(dockId);
        }
    }
};

// Run cleanup every 10 minutes
setInterval(cleanupExpiredDocks, 10 * 60 * 1000);

// Enhanced middleware to check authentication with session validation
const ensureAuthenticated = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({
            error: 'Authentication required for docking operations',
            code: 'AUTHENTICATION_REQUIRED'
        });
    }

    // Additional session validation
    if (!req.user || !req.user.id) {
        return res.status(401).json({
            error: 'Invalid user session',
            code: 'INVALID_SESSION'
        });
    }

    // Check session expiry if available
    if (req.session && req.session.cookie && req.session.cookie.expires) {
        if (new Date() > new Date(req.session.cookie.expires)) {
            return res.status(401).json({
                error: 'Session expired',
                code: 'SESSION_EXPIRED'
            });
        }
    }

    return next();
};

// Input validation helper
const validateInput = (input, type = 'string', maxLength = 255) => {
    if (typeof input !== type) {
        return false;
    }
    if (type === 'string' && (input.length === 0 || input.length > maxLength)) {
        return false;
    }
    if (type === 'string' && !/^[a-zA-Z0-9_-]+$/.test(input)) {
        return false;
    }
    return true;
};

// Initiate docking process
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const { agentId, capabilities, metadata } = req.body;

        // Enhanced input validation
        if (!agentId || !validateInput(agentId, 'string', 100)) {
            return res.status(400).json({
                error: 'Agent ID is required and must be a valid alphanumeric string (max 100 chars)',
                code: 'INVALID_AGENT_ID'
            });
        }

        // Validate capabilities array if provided
        if (capabilities && (!Array.isArray(capabilities) || capabilities.length > 50)) {
            return res.status(400).json({
                error: 'Capabilities must be an array with maximum 50 items',
                code: 'INVALID_CAPABILITIES'
            });
        }

        // Validate metadata size if provided
        if (metadata && typeof metadata === 'object') {
            const metadataStr = JSON.stringify(metadata);
            if (metadataStr.length > 10000) {
                return res.status(400).json({
                    error: 'Metadata size too large (max 10KB)',
                    code: 'METADATA_TOO_LARGE'
                });
            }
        }

        // Generate handshake token
        const handshakeToken = crypto.randomBytes(32).toString('hex');
        const dockId = `dock_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

        // Store dock session
        activeDocks.set(dockId, {
            dockId,
            agentId,
            userId: req.user.id,
            username: req.user.username,
            handshakeToken,
            capabilities: capabilities || [],
            metadata: metadata || {},
            status: 'pending',
            createdAt: new Date().toISOString(),
            lastHeartbeat: new Date().toISOString()
        });

        // Emit dock event via Socket.IO if available
        const io = req.app.get('io');
        if (io) {
            io.emit('dock-initiated', {
                dockId,
                agentId,
                username: req.user.username,
                timestamp: new Date().toISOString()
            });
        }

        res.status(201).json({
            dockId,
            handshakeToken,
            status: 'pending',
            message: 'Docking initiated successfully',
            endpoints: {
                status: `/api/dock/${dockId}/status`,
                heartbeat: `/api/dock/${dockId}/heartbeat`,
                complete: `/api/dock/${dockId}/complete`
            }
        });
    } catch (error) {
        console.error('Docking initiation error:', error);
        res.status(500).json({ error: 'Failed to initiate docking' });
    }
});

// Get dock status
router.get('/:dockId/status', ensureAuthenticated, (req, res) => {
    const dock = activeDocks.get(req.params.dockId);

    if (!dock) {
        return res.status(404).json({ error: 'Dock session not found' });
    }

    // Check if user owns this dock session
    if (dock.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
        dockId: dock.dockId,
        status: dock.status,
        agentId: dock.agentId,
        createdAt: dock.createdAt,
        lastHeartbeat: dock.lastHeartbeat,
        capabilities: dock.capabilities,
        metadata: dock.metadata
    });
});

// Heartbeat endpoint for keeping dock session alive
router.post('/:dockId/heartbeat', ensureAuthenticated, (req, res) => {
    const dock = activeDocks.get(req.params.dockId);

    if (!dock) {
        return res.status(404).json({ error: 'Dock session not found' });
    }

    // Verify handshake token
    const { handshakeToken } = req.body;
    if (dock.handshakeToken !== handshakeToken) {
        return res.status(401).json({ error: 'Invalid handshake token' });
    }

    // Update heartbeat
    dock.lastHeartbeat = new Date().toISOString();
    dock.status = 'active';

    // Emit heartbeat event
    const io = req.app.get('io');
    if (io) {
        io.emit('dock-heartbeat', {
            dockId: dock.dockId,
            timestamp: dock.lastHeartbeat
        });
    }

    res.json({
        status: 'ok',
        message: 'Heartbeat received',
        nextHeartbeat: new Date(Date.now() + 30000).toISOString() // 30 seconds
    });
});

// Complete docking process
router.post('/:dockId/complete', ensureAuthenticated, (req, res) => {
    const dock = activeDocks.get(req.params.dockId);

    if (!dock) {
        return res.status(404).json({ error: 'Dock session not found' });
    }

    // Verify handshake token
    const { handshakeToken, result } = req.body;
    if (dock.handshakeToken !== handshakeToken) {
        return res.status(401).json({ error: 'Invalid handshake token' });
    }

    // Update dock status
    dock.status = 'completed';
    dock.completedAt = new Date().toISOString();
    dock.result = result;

    // Emit completion event
    const io = req.app.get('io');
    if (io) {
        io.emit('dock-completed', {
            dockId: dock.dockId,
            result,
            timestamp: dock.completedAt
        });
    }

    res.json({
        status: 'completed',
        message: 'Docking completed successfully',
        result: dock.result
    });
});

// List all dock sessions for current user
router.get('/', ensureAuthenticated, (req, res) => {
    const userDocks = Array.from(activeDocks.values())
        .filter(dock => dock.userId === req.user.id)
        .map(dock => ({
            dockId: dock.dockId,
            agentId: dock.agentId,
            status: dock.status,
            createdAt: dock.createdAt,
            lastHeartbeat: dock.lastHeartbeat,
            ...(dock.completedAt && { completedAt: dock.completedAt })
        }));

    res.json({
        docks: userDocks,
        count: userDocks.length
    });
});

// Cleanup inactive dock sessions
function cleanupInactiveDocks() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    for (const [dockId, dock] of activeDocks.entries()) {
        const lastHeartbeat = new Date(dock.lastHeartbeat).getTime();
        if (now - lastHeartbeat > timeout && dock.status !== 'completed') {
            dock.status = 'timeout';
            console.log(`🕐 Dock session ${dockId} timed out`);
        }
    }
}

// Run cleanup every minute
setInterval(cleanupInactiveDocks, 60000);

module.exports = router;
