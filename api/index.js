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
            stack: initError.stack
        });
    }
    return app(req, res);
};
