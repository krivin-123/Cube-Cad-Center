let app;
let initError = null;
try {
    app = require('../server.js');
} catch (err) {
    initError = err;
    console.error('[FATAL SERVER INIT ERROR]', err);
}

module.exports = (req, res) => {
    if (initError) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
    return app(req, res);
};
