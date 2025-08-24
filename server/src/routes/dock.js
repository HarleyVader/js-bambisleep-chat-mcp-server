const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Store active dock sessions
const activeDocks = new Map();

// Middleware to check authentication
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required for docking operations' });
};

// Initiate docking process
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const { agentId, capabilities, metadata } = req.body;

        if (!agentId) {
            return res.status(400).json({ error: 'Agent ID is required' });
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
