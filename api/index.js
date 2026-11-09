let app;
let initError = null;
try {
    app = require('../server.js');
} catch (err) {
    initError = err;
}

module.exports = (req, res) => {
    if (initError) {
        return res.status(500).json({
            error: 'Server Initialization Failed',
            message: initError.message,
            vercelEnv: process.env.VERCEL_ENV || 'unknown',
            nodeEnv: process.env.NODE_ENV || 'unknown',
            hasSecretKey: Boolean(process.env.SECRET_KEY || process.env.JWT_SECRET || process.env.secret_key || process.env.jwt_secret),
            hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD || process.env.admin_password || process.env.ADMIN_PASS || process.env.admin_pass)
        });
    }
    return app(req, res);
};
