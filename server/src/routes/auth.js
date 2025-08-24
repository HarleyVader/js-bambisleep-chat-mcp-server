const express = require('express');
const passport = require('passport');
const router = express.Router();

// Middleware to check if user is authenticated
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
};

// GitHub OAuth routes
router.get('/github', passport.authenticate('github', {
    scope: ['user:email', 'repo', 'write:repo_hook']
}));

router.get('/github/callback',
    passport.authenticate('github', { failureRedirect: '/auth/failure' }),
    (req, res) => {
        // Successful authentication
        res.redirect(process.env.CLIENT_SUCCESS_REDIRECT || 'http://localhost:3000/dashboard');
    }
);

// Patreon OAuth routes
router.get('/patreon', passport.authenticate('patreon'));

router.get('/patreon/callback',
    passport.authenticate('patreon', { failureRedirect: '/auth/failure' }),
    (req, res) => {
        // Successful authentication
        res.redirect(process.env.CLIENT_SUCCESS_REDIRECT || 'http://localhost:3000/dashboard');
    }
);

// Get current user
router.get('/user', ensureAuthenticated, (req, res) => {
    res.json({
        user: req.user,
        isAuthenticated: true
    });
});

// Logout
router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Session destruction failed' });
            }
            res.clearCookie(process.env.SESSION_NAME || 'mcp-session');
            res.json({ message: 'Logged out successfully' });
        });
    });
});

// Check authentication status
router.get('/status', (req, res) => {
    res.json({
        isAuthenticated: req.isAuthenticated(),
        user: req.isAuthenticated() ? req.user : null
    });
});

// Authentication failure page
router.get('/failure', (req, res) => {
    res.status(401).json({
        error: 'Authentication failed',
        message: 'OAuth authentication was unsuccessful'
    });
});

module.exports = router;
