/**
 * Universal Database Adapter for Cube Cad Center
 * Supports native sqlite3 when compiled, with built-in node:sqlite (Node 22+)
 * and in-memory/temp fallback for serverless environments.
 */

const fs = require('fs');
const path = require('path');

function createDb(dbPath = './database.sqlite') {
    // 1. Try native sqlite3 if available
    try {
        const sqlite3 = require('sqlite3').verbose();
        const nativeDb = new sqlite3.Database(dbPath, (err) => {
            if (err) console.error('Error opening SQLite with sqlite3:', err.message);
        });
        return nativeDb;
    } catch (nativeErr) {
        // Native sqlite3 not available; fall through to built-in node:sqlite
    }

    // 2. Try Node.js built-in node:sqlite (Node 22+)
    try {
        const { DatabaseSync } = require('node:sqlite');
        
        // Handle serverless / read-only environment: use /tmp if ./ is read-only
        let targetPath = dbPath;
        if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
            targetPath = path.join('/tmp', path.basename(dbPath));
            // If source file exists in bundle, copy to /tmp for read/write
            if (fs.existsSync(dbPath) && !fs.existsSync(targetPath)) {
                try {
                    fs.copyFileSync(dbPath, targetPath);
                } catch (cpErr) {
                    // Ignore copy failure, will create fresh
                }
            }
        }

        const rawDb = new DatabaseSync(targetPath);
        rawDb.exec('PRAGMA journal_mode = WAL;');
        rawDb.exec('PRAGMA foreign_keys = ON;');

        return {
            rawDb,
            run: function(sql, params, cb) {
                let callback = cb;
                let bindParams = params;
                if (typeof params === 'function') {
                    callback = params;
                    bindParams = [];
                }
                bindParams = bindParams || [];
                try {
                    const stmt = rawDb.prepare(sql);
                    const info = stmt.run(...bindParams);
                    const context = {
                        lastID: Number(info.lastInsertRowid || 0),
                        changes: Number(info.changes || 0)
                    };
                    if (callback) callback.call(context, null);
                } catch (err) {
                    if (callback) callback(err);
                }
            },
            get: function(sql, params, cb) {
                let callback = cb;
                let bindParams = params;
                if (typeof params === 'function') {
                    callback = params;
                    bindParams = [];
                }
                bindParams = bindParams || [];
                try {
                    const stmt = rawDb.prepare(sql);
                    const row = stmt.get(...bindParams);
                    if (callback) callback(null, row || null);
                } catch (err) {
                    if (callback) callback(err);
                }
            },
            all: function(sql, params, cb) {
                let callback = cb;
                let bindParams = params;
                if (typeof params === 'function') {
                    callback = params;
                    bindParams = [];
                }
                bindParams = bindParams || [];
                try {
                    const stmt = rawDb.prepare(sql);
                    const rows = stmt.all(...bindParams);
                    if (callback) callback(null, rows || []);
                } catch (err) {
                    if (callback) callback(err);
                }
            },
            exec: function(sql, cb) {
                try {
                    rawDb.exec(sql);
                    if (cb) cb(null);
                } catch (err) {
                    if (cb) cb(err);
                }
            },
            serialize: function(fn) {
                if (fn) fn();
            },
            close: function(cb) {
                try {
                    rawDb.close();
                    if (cb) cb(null);
                } catch (err) {
                    if (cb) cb(err);
                }
            }
        };
    } catch (nodeSqliteErr) {
        console.warn('node:sqlite initialization error:', nodeSqliteErr.message);
    }

    // 3. Fallback dummy adapter if no sqlite engine available
    console.warn('Running with in-memory dummy DB adapter.');
    return {
        run: function(sql, params, cb) {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback.call({ lastID: Date.now(), changes: 1 }, null);
        },
        get: function(sql, params, cb) {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback(null, null);
        },
        all: function(sql, params, cb) {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback(null, []);
        },
        serialize: function(fn) { if (fn) fn(); },
        close: function(cb) { if (cb) cb(null); }
    };
}

module.exports = { createDb };
