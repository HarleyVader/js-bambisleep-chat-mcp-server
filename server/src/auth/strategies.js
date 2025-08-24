const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
// const PatreonStrategy = require('@oauth-everything/passport-patreon').Strategy;

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, {
        id: user.id,
        provider: user.provider,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl
    });
});

// Deserialize user from session
passport.deserializeUser((user, done) => {
    done(null, user);
});

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || "/auth/github/callback"
    },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const user = {
                    id: profile.id,
                    provider: 'github',
                    username: profile.username,
                    displayName: profile.displayName,
                    email: profile.emails?.[0]?.value,
                    avatarUrl: profile.photos?.[0]?.value,
                    accessToken: accessToken,
                    profileUrl: profile.profileUrl
                };

                // TODO: Save user to database
                console.log('GitHub user authenticated:', user.username);

                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }));
} else {
    console.warn('⚠️  GitHub OAuth not configured - missing CLIENT_ID or CLIENT_SECRET');
}

// Patreon OAuth Strategy
/*
if (process.env.PATREON_CLIENT_ID && process.env.PATREON_CLIENT_SECRET) {
  passport.use(new PatreonStrategy({
    clientID: process.env.PATREON_CLIENT_ID,
    clientSecret: process.env.PATREON_CLIENT_SECRET,
    callbackURL: process.env.PATREON_CALLBACK_URL || "/auth/patreon/callback",
    scope: 'identity'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = {
        id: profile.id,
        provider: 'patreon',
        username: profile.username,
        displayName: profile.displayName,
        email: profile.email,
        avatarUrl: profile.avatar_url,
        accessToken: accessToken
      };

      // TODO: Save user to database
      console.log('Patreon user authenticated:', user.username);

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
} else {
  console.warn('⚠️  Patreon OAuth not configured - missing CLIENT_ID or CLIENT_SECRET');
}
*/

module.exports = passport;
