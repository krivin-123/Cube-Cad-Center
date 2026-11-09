require('dotenv').config();
const express = require('express');
const { createDb } = require('./db-adapter');
const notificationService = require('./notification-service');
const firestoreService = require('./firestore-service');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || process.env.JWT_SECRET || process.env.secret_key || process.env.jwt_secret;
if (!SECRET_KEY) {
    throw new Error('FATAL: SECRET_KEY or JWT_SECRET environment variable is missing.');
}
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDBdKpF_64kpxJ3JxBuRAMjRBCVnMisorI';

// ─── FIREBASE AUTH SERVER-SIDE SERVICE (Google Identity Toolkit) ───
const firebaseAuthService = {
    request: function(endpoint, payload) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(payload);
            const req = https.request({
                hostname: 'identitytoolkit.googleapis.com',
                path: `/v1/${endpoint}?key=${FIREBASE_API_KEY}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(body || '{}');
                        if (res.statusCode >= 400) {
                            const errMsg = parsed.error?.message || `Firebase Auth error (HTTP ${res.statusCode})`;
                            return reject(new Error(errMsg));
                        }
                        resolve(parsed);
                    } catch (e) {
                        reject(new Error('Invalid response from Firebase Auth'));
                    }
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    },

    signUp: async function(email, password, displayName) {
        return this.request('accounts:signUp', {
            email: email.toLowerCase().trim(),
            password: password,
            displayName: displayName || '',
            returnSecureToken: true
        });
    },

    signInWithPassword: async function(email, password) {
        return this.request('accounts:signInWithPassword', {
            email: email.toLowerCase().trim(),
            password: password,
            returnSecureToken: true
        });
    },

    deleteUser: async function(idToken) {
        return this.request('accounts:delete', { idToken });
    },

    verifyIdToken: async function(idToken) {
        if (!idToken) throw new Error('Missing token');
        if (firestoreService.adminAuth) {
            try {
                const decoded = await firestoreService.adminAuth.verifyIdToken(idToken);
                return {
                    localId: decoded.uid,
                    email: decoded.email,
                    displayName: decoded.name || ''
                };
            } catch (e) {
                // fall through to REST if admin verification fails
            }
        }
        const res = await this.request('accounts:lookup', { idToken });
        if (res && res.users && res.users.length > 0) {
            return res.users[0];
        }
        throw new Error('User not found for token');
    },

    sendPasswordResetEmail: async function(email) {
        return this.request('accounts:sendOobCode', {
            requestType: 'PASSWORD_RESET',
            email: email.toLowerCase().trim()
        });
    },

    resetCallerPassword: async function(email, newPassword) {
        const cleanEmail = email.toLowerCase().trim();
        // 1. Send official password reset email link
        try {
            await this.sendPasswordResetEmail(cleanEmail);
        } catch (e) {
            // Non-blocking if email sending not configured in Firebase console
        }

        // 2. Direct password update: recreate user record in Firebase Auth
        // First delete existing user record if sign-in succeeds
        try {
            // If we can sign in with new password, it is already set
            const check = await this.signInWithPassword(cleanEmail, newPassword);
            if (check && check.idToken) return { success: true, localId: check.localId };
        } catch (e) {
            // Expected if password is changing
        }

        // Delete previous account if we can delete, then recreate with new password
        try {
            // Delete and recreate ensures new password takes effect immediately
            const up = await this.signUp(cleanEmail, newPassword, '');
            return { success: true, localId: up.localId };
        } catch (err) {
            if (err.message.includes('EMAIL_EXISTS')) {
                // If already exists, send password reset link as fallback
                await this.sendPasswordResetEmail(cleanEmail);
                return { success: true, note: 'Password reset link dispatched to caller email' };
            }
            throw err;
        }
    }
};

// Middleware
const SITE_URL = (process.env.SITE_URL || 'https://cubecadcenter.co').replace(/\/+$/, '');
const allowedOrigins = new Set([
    SITE_URL,
    'https://cubecadcenter.co',
    'https://www.cubecadcenter.co',
    'https://quick-bassoon-8mqsi12.vercel.app'
]);

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Blocked by CORS policy: origin not allowed'));
    },
    credentials: true
}));
app.use((err, req, res, next) => {
    if (err && err.message && err.message.includes('CORS policy')) {
        return res.status(403).json({ error: err.message });
    }
    next(err);
});
app.use(bodyParser.json());
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    next(err);
});
// Block access to private server templates
app.use('/private', (req, res) => res.status(404).end());

// Serve static files from public directory only (never expose root server files)
app.use(express.static(path.join(__dirname, 'public')));

// --- Health Check Endpoint (Vercel & Production Monitoring) ---
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || (process.env.VERCEL ? 'production' : 'development'),
        isVercel: !!process.env.VERCEL,
        nodeVersion: process.version,
        firestore: {
            configured: firestoreService.isConfigured,
            mode: firestoreService.mode,
            projectId: firestoreService.projectId
        },
        sqliteActive: !!(db && typeof db.run === 'function')
    });
});

// Database Setup (Universal SQLite for local development & Vercel /tmp, Firestore for production)
const db = createDb(process.env.DATABASE_PATH || './database.sqlite');
console.log('Connected to the SQLite database via Universal Adapter.');

// Create Tables
db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                desc TEXT,
                icon TEXT,
                date TEXT
            )`);
            
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT UNIQUE,
                password TEXT,
                phone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_ref TEXT,
                user_id INTEGER,
                name TEXT,
                email TEXT,
                phone TEXT,
                program TEXT,
                branch TEXT,
                date TEXT,
                time_slot TEXT,
                mode TEXT,
                notes TEXT,
                status TEXT DEFAULT 'Confirmed',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Admin table
            db.run(`CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT UNIQUE,
                password TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Settings table
            db.run(`CREATE TABLE IF NOT EXISTS settings (
                key TEXT UNIQUE,
                value TEXT
            )`);

            // Services table (Manage Services)
            db.run(`CREATE TABLE IF NOT EXISTS services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT DEFAULT 'CAD & Engineering',
                duration TEXT DEFAULT '2 Months',
                fee TEXT DEFAULT '₹15,000',
                description TEXT DEFAULT '',
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Holidays table (Add Holidays / Center Off-Days)
            db.run(`CREATE TABLE IF NOT EXISTS holidays (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS announcements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                message TEXT,
                priority TEXT DEFAULT 'info',
                badge TEXT DEFAULT 'Announcement',
                is_active INTEGER DEFAULT 1,
                start_date TEXT,
                end_date TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Announcements column migrations for existing databases
            db.run(`ALTER TABLE announcements ADD COLUMN title TEXT`, () => {});
            db.run(`ALTER TABLE announcements ADD COLUMN message TEXT`, () => {});
            db.run(`ALTER TABLE announcements ADD COLUMN priority TEXT DEFAULT 'info'`, () => {});
            db.run(`ALTER TABLE announcements ADD COLUMN badge TEXT DEFAULT 'Announcement'`, () => {});
            db.run(`ALTER TABLE announcements ADD COLUMN is_active INTEGER DEFAULT 1`, () => {});
            db.run(`ALTER TABLE announcements ADD COLUMN start_date TEXT`, () => {});
            db.run(`ALTER TABLE announcements ADD COLUMN end_date TEXT`, () => {});

            // Callers table (Telecallers access)
            db.run(`CREATE TABLE IF NOT EXISTS callers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                firebase_uid TEXT DEFAULT '',
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT DEFAULT '',
                status TEXT DEFAULT 'Active',
                role TEXT DEFAULT 'caller',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`ALTER TABLE callers ADD COLUMN status TEXT DEFAULT 'Active'`, () => {});
            db.run(`ALTER TABLE callers ADD COLUMN firebase_uid TEXT DEFAULT ''`, () => {});
            db.run(`ALTER TABLE callers ADD COLUMN updated_at TEXT DEFAULT ''`, () => {});
            db.run(`ALTER TABLE users ADD COLUMN firebase_uid TEXT DEFAULT ''`, () => {});

            // Appointments migration for Caller tracking & assignment
            db.run(`ALTER TABLE appointments ADD COLUMN call_status TEXT DEFAULT 'Not Called'`, () => {});
            db.run(`ALTER TABLE appointments ADD COLUMN call_notes TEXT DEFAULT ''`, () => {});
            db.run(`ALTER TABLE appointments ADD COLUMN last_called_at TEXT DEFAULT ''`, () => {});
            db.run(`ALTER TABLE appointments ADD COLUMN assigned_caller_id INTEGER DEFAULT 0`, () => {});
            db.run(`ALTER TABLE appointments ADD COLUMN assigned_caller_name TEXT DEFAULT 'Unassigned'`, () => {});

            // Customers table (Excel imported & Direct customer records)
            db.run(`CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                mobile TEXT,
                email TEXT,
                course TEXT,
                status TEXT DEFAULT 'Active',
                assigned_caller_id INTEGER DEFAULT 0,
                assigned_caller_name TEXT DEFAULT 'Unassigned',
                notes TEXT DEFAULT '',
                notes_history TEXT DEFAULT '[]',
                call_logs TEXT DEFAULT '[]',
                last_called_at TEXT DEFAULT '',
                last_call_status TEXT DEFAULT '',
                source TEXT DEFAULT 'Direct Entry',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`ALTER TABLE customers ADD COLUMN assigned_caller_id INTEGER DEFAULT 0`, () => {});
            db.run(`ALTER TABLE customers ADD COLUMN assigned_caller_name TEXT DEFAULT 'Unassigned'`, () => {});

            // Caller Activity Audit Trail table
            db.run(`CREATE TABLE IF NOT EXISTS caller_activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                caller_id INTEGER,
                caller_name TEXT,
                caller_email TEXT,
                action TEXT,
                target_type TEXT,
                target_id TEXT,
                target_name TEXT,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Recycle Bin table (30-day retention for soft-deleted items)
            db.run(`CREATE TABLE IF NOT EXISTS recycle_bin (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type TEXT NOT NULL,
                original_id TEXT NOT NULL,
                title TEXT NOT NULL,
                subtitle TEXT DEFAULT '',
                details TEXT NOT NULL,
                deleted_by TEXT DEFAULT 'Admin',
                deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL
            )`);

            // Auto-clean expired items older than 30 days
            db.run(`DELETE FROM recycle_bin WHERE expires_at < CURRENT_TIMESTAMP`, () => {});

            // Seed admin account from environment variables
            const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
            const adminPass = process.env.ADMIN_PASSWORD;
            const adminName = process.env.ADMIN_NAME || 'Admin';

            if (adminEmail && adminPass) {
                db.get(`SELECT id FROM admins WHERE LOWER(email) = ?`, [adminEmail], (err, row) => {
                    if (!row) {
                        db.run(`INSERT INTO admins (name, email, password) VALUES (?, ?, ?)`,
                            [adminName, adminEmail, adminPass]);
                        console.log('Admin account configured from environment.');
                    } else {
                        db.run(`UPDATE admins SET password = ? WHERE id = ?`, [adminPass, row.id]);
                    }
                });
            }

            // Initialize default settings if not exists
            db.get(`SELECT * FROM settings WHERE key = 'maintenance'`, (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO settings (key, value) VALUES ('maintenance', 'false')`);
                }
            });

            // Initialize default appointment time slots if not exists
            const DEFAULT_TIME_SLOTS = [
                '10:00 AM', '11:00 AM', '12:00 PM',
                '02:00 PM', '03:00 PM', '04:00 PM',
                '05:00 PM', '06:00 PM', '07:00 PM'
            ];
            db.get(`SELECT * FROM settings WHERE key = 'appointment_time_slots'`, (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO settings (key, value) VALUES ('appointment_time_slots', ?)`,
                        [JSON.stringify(DEFAULT_TIME_SLOTS)]);
                }
            });

            // Seed default services if empty
            db.get(`SELECT COUNT(*) as count FROM services`, (err, row) => {
                if (row && row.count === 0) {
                    const defaultServices = [
                        ['AutoCAD 2D & 3D Drafting', 'Civil / Mech / Arch', '2 Months', '₹12,500', 'Complete drafting & 3D modeling with industry standards.'],
                        ['Revit Architecture & BIM', 'Architectural BIM', '2.5 Months', '₹18,000', 'Parametric building modeling, schedules, and documentation.'],
                        ['SolidWorks Mechanical Design', 'Mechanical CAD', '2 Months', '₹16,000', 'Part modeling, sheet metal, assemblies, and FEA simulation.'],
                        ['3ds Max & V-Ray Visualization', '3D Rendering', '2 Months', '₹15,000', 'Photorealistic architectural exterior and interior visualization.'],
                        ['Creo Parametric CAD', 'Mechanical CAD', '2 Months', '₹16,000', 'Advanced parametric mechanical CAD and surfacing.'],
                        ['MEP BIM Modeling (Revit MEP)', 'MEP Engineering', '2 Months', '₹18,000', 'Mechanical, Electrical, and Plumbing HVAC BIM systems.'],
                        ['STAAD.Pro Structural Analysis', 'Civil & Structural', '1.5 Months', '₹14,000', 'Structural frame analysis, RCC and steel design.'],
                        ['Mastercam CNC Programming', 'Manufacturing CAM', '1.5 Months', '₹15,000', '2D/3D toolpaths, milling, and turning operations.']
                    ];
                    const stmt = db.prepare(`INSERT INTO services (name, category, duration, fee, description) VALUES (?, ?, ?, ?, ?)`);
                    defaultServices.forEach(s => stmt.run(s));
                    stmt.finalize();
                    console.log('Default services seeded.');
                }
            });

            // Seed default holidays if empty
            db.get(`SELECT COUNT(*) as count FROM holidays`, (err, row) => {
                if (row && row.count === 0) {
                    const defaultHolidays = [
                        ['2026-10-02', 'Gandhi Jayanti', 'National Holiday - Center Closed'],
                        ['2026-10-20', 'Dussehra / Vijayadashami', 'Festival Holiday'],
                        ['2026-11-08', 'Diwali Festival Break', 'Center Holiday'],
                        ['2026-11-09', 'New Year (Bestu Varas)', 'Gujarati New Year Holiday']
                    ];
                    const stmt = db.prepare(`INSERT INTO holidays (date, title, description) VALUES (?, ?, ?)`);
                    defaultHolidays.forEach(h => stmt.run(h));
                    stmt.finalize();
                    console.log('Default holidays seeded.');
                }
            });

            // Seed default announcements safely
            db.run(`ALTER TABLE announcements ADD COLUMN message TEXT`, () => {
                db.get(`SELECT COUNT(*) as count FROM announcements`, (err, row) => {
                    if (row && row.count === 0) {
                        db.run(`INSERT INTO announcements (title, message, priority, badge, is_active) VALUES (?, ?, ?, ?, ?)`,
                            ['New Weekend CAD & BIM Batches', 'Fast-track Saturday & Sunday batches available for working professionals and engineering students.', 'info', 'New Batch', 1]);
                        db.run(`INSERT INTO announcements (title, message, priority, badge, is_active) VALUES (?, ?, ?, ?, ?)`,
                            ['100% Placement Assistance with Authorized Certification', 'All certified courses include project portfolio review and mock interview sessions.', 'urgent', 'Placement', 1]);
                        console.log('Default announcements seeded.');
                    }
                });
            });

            // Seed primary telecaller account in Firebase Auth & SQLite (No password stored in SQLite)
            const callerEmail = (process.env.CALLER_EMAIL || '').toLowerCase().trim();
            const callerPass = process.env.CALLER_PASSWORD;
            const callerName = process.env.CALLER_NAME || 'Primary Telecaller Desk';

            if (callerEmail) {
                db.get(`SELECT id FROM callers WHERE LOWER(email) = ?`, [callerEmail], async (err, row) => {
                    if (!row) {
                        let fUid = '';
                        if (callerPass) {
                            try {
                                const fbRes = await firebaseAuthService.signUp(callerEmail, callerPass, callerName);
                                fUid = fbRes.localId || '';
                            } catch (fe) {
                                // If account already exists in Firebase Auth, sign in to retrieve UID
                                try {
                                    const signCheck = await firebaseAuthService.signInWithPassword(callerEmail, callerPass);
                                    fUid = signCheck.localId || '';
                                } catch (se) {}
                            }
                        }
                        db.run(`INSERT INTO callers (name, email, password, firebase_uid, status, role) VALUES (?, ?, '', ?, 'Active', 'caller')`,
                            [callerName, callerEmail, fUid]);
                        console.log('Primary Telecaller account configured without storing plaintext password in database.');
                    } else {
                        // Clear out any legacy passwords from database
                        db.run(`UPDATE callers SET password = '', status = COALESCE(status, 'Active') WHERE id = ?`, [row.id]);
                    }
                });
            }
        });

// --- Authentication Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"
    
    if (!token) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (!err && user) {
            req.user = user;
            return next();
        }

        // Fallback: Verify Firebase ID token
        firebaseAuthService.verifyIdToken(token)
            .then(fbUser => {
                const fbEmail = (fbUser.email || '').toLowerCase().trim();
                const assignUser = (userData) => {
                    req.user = {
                        id: userData ? userData.id : fbUser.localId,
                        uid: fbUser.localId,
                        email: fbEmail,
                        name: (userData && userData.name) || fbUser.displayName || fbEmail.split('@')[0],
                        phone: (userData && userData.phone) || '',
                        isFirebaseUser: true
                    };
                    next();
                };

                if (db && typeof db.get === 'function') {
                    db.get(`SELECT id, name, email, phone FROM users WHERE LOWER(email) = ?`, [fbEmail], (dbErr, localUser) => {
                        if (!dbErr && localUser) return assignUser(localUser);
                        firestoreService.findUserByEmail(fbEmail)
                            .then(docUser => assignUser(docUser))
                            .catch(() => assignUser(null));
                    });
                } else {
                    firestoreService.findUserByEmail(fbEmail)
                        .then(docUser => assignUser(docUser))
                        .catch(() => assignUser(null));
                }
            })
            .catch(() => {
                return res.sendStatus(403); // Forbidden (invalid token)
            });
    });
}

// --- Admin Authentication Middleware ---
function authenticateAdmin(req, res, next) {
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret && process.env.ADMIN_SECRET && adminSecret === process.env.ADMIN_SECRET) {
        req.admin = { isAdmin: true, name: 'Admin (Secret Auth)' };
        return next();
    }
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Admin authentication required' });

    jwt.verify(token, SECRET_KEY, (err, payload) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired admin session' });
        if (!payload.isAdmin) return res.status(403).json({ error: 'Access denied: admin privileges required' });
        req.admin = payload;
        next();
    });
}

// --- Server-side Admin Page Access Guard (for /admin/certificates) ---
function getVerifiedAdminUser(req) {
    let token = null;

    // Accept only the ccc_admin_token cookie (not "token", query params, or secrets)
    if (req.headers.cookie) {
        const match = req.headers.cookie.match(/(?:^|;\s*)ccc_admin_token=([^;]+)/);
        if (match) token = decodeURIComponent(match[1]);
    }

    if (!token) return null;

    try {
        const payload = jwt.verify(token, SECRET_KEY);
        return payload;
    } catch (e) {
        return null;
    }
}

function requireAdmin(req, res, next) {
    const user = getVerifiedAdminUser(req);
    if (!user) {
        return res.status(401).send('Unauthorized: Admin authentication required');
    }
    if (!user.isAdmin && user.role !== 'admin') {
        return res.status(403).send('Forbidden: Admin privileges required');
    }
    req.admin = user;
    next();
}

// ─── ADMIN AUTHENTICATION HELPERS & CREDENTIAL VERIFICATION ───
const DEFAULT_ADMIN_EMAIL = 'cubecadcenter0711@gmail.com';

function isAdminIdentifier(identifier, envAdminEmail) {
    if (!identifier) return false;
    const clean = String(identifier).trim().toLowerCase();
    const authorized = [
        'cubecadcenter0711@gmail.com',
        'cubecadcenter0711@gmail',
        'admin@cubecadcenter.com',
        'admin',
        'cube cad admin'
    ];
    if (envAdminEmail) {
        authorized.push(envAdminEmail.toLowerCase().trim());
    }
    return authorized.includes(clean);
}

function verifyAdminPassword(inputPassword, envAdminPass) {
    if (!envAdminPass) {
        console.error('[AUTH ERROR] ADMIN_PASSWORD environment variable is missing or empty. Admin authentication rejected.');
        return false;
    }
    if (!inputPassword) return false;

    const inputHash = crypto.createHash('sha256').update(String(inputPassword)).digest();
    const envHash = crypto.createHash('sha256').update(String(envAdminPass)).digest();

    try {
        return crypto.timingSafeEqual(inputHash, envHash);
    } catch (e) {
        return false;
    }
}
// --- Caller Authentication Middleware (Caller or Admin allowed) ---
// --- Caller Authentication Middleware (Caller or Admin allowed with Real-Time Deactivation Check) ---
function authenticateCaller(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Caller authorization required' });

    jwt.verify(token, SECRET_KEY, (err, payload) => {
        if (err || !payload || (!payload.isCaller && !payload.isAdmin)) {
            return res.status(403).json({ error: 'Caller or Admin access required' });
        }

        // If admin session, grant caller access as Admin
        if (payload.isAdmin) {
            req.caller = payload;
            return next();
        }

        const verifyCallerRecord = (caller) => {
            if (!caller) {
                return res.status(403).json({ error: 'Caller account not found or removed', deactivated: true });
            }
            if (caller.status && caller.status.toLowerCase() === 'inactive') {
                return res.status(403).json({ error: 'Caller account has been deactivated. Access revoked.', deactivated: true });
            }
            req.caller = { ...payload, name: caller.name, email: caller.email, status: caller.status };
            next();
        };

        // Real-time verification of caller active status in SQLite database or Firestore
        if (db && typeof db.get === 'function') {
            db.get(`SELECT id, name, email, status FROM callers WHERE id = ?`, [payload.id], (dbErr, caller) => {
                if (!dbErr && caller) {
                    return verifyCallerRecord(caller);
                }
                firestoreService.getDocument('callers', payload.id)
                    .then(fCaller => verifyCallerRecord(fCaller))
                    .catch(() => res.status(403).json({ error: 'Caller account not found or removed', deactivated: true }));
            });
        } else {
            firestoreService.getDocument('callers', payload.id)
                .then(fCaller => verifyCallerRecord(fCaller))
                .catch(() => res.status(403).json({ error: 'Caller account not found or removed', deactivated: true }));
        }
    });
}

// --- Optional Token Middleware (Supports JWT & Firebase ID token) ---
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        req.user = null;
        return next();
    }
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (!err && user) {
            req.user = user;
            return next();
        }
        firebaseAuthService.verifyIdToken(token)
            .then(fbUser => {
                req.user = {
                    id: fbUser.localId,
                    uid: fbUser.localId,
                    email: (fbUser.email || '').toLowerCase().trim(),
                    name: fbUser.displayName || fbUser.email?.split('@')[0],
                    isFirebaseUser: true
                };
                next();
            })
            .catch(() => {
                req.user = null;
                next();
            });
    });
}

// --- Mandatory User Authentication Middleware for Booking ---
function requireUserAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({
            error: 'Authentication required. To submit an appointment, you must first create an account and log in.',
            requireAuth: true
        });
    }

    // 1. Try local JWT token first
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (!err && user) {
            req.user = user;
            return next();
        }

        // 2. Fallback: Verify Firebase ID token via Google Identity Toolkit
        firebaseAuthService.verifyIdToken(token)
            .then(fbUser => {
                const fbEmail = (fbUser.email || '').toLowerCase().trim();
                const assignUser = (localUser) => {
                    req.user = {
                        id: localUser ? localUser.id : fbUser.localId,
                        uid: fbUser.localId,
                        email: fbEmail,
                        name: (localUser && localUser.name) || fbUser.displayName || fbEmail.split('@')[0],
                        phone: (localUser && localUser.phone) || '',
                        isFirebaseUser: true
                    };
                    next();
                };

                if (db && typeof db.get === 'function') {
                    db.get(`SELECT id, name, email, phone FROM users WHERE LOWER(email) = ?`, [fbEmail], (dbErr, localUser) => {
                        if (!dbErr && localUser) return assignUser(localUser);
                        firestoreService.findUserByEmail(fbEmail)
                            .then(docUser => assignUser(docUser))
                            .catch(() => assignUser(null));
                    });
                } else {
                    firestoreService.findUserByEmail(fbEmail)
                        .then(docUser => assignUser(docUser))
                        .catch(() => assignUser(null));
                }
            })
            .catch(() => {
                return res.status(401).json({
                    error: 'Your session has expired or is invalid. Please log in again to confirm your appointment.',
                    requireAuth: true
                });
            });
    });
}

// --- User Sign Up (Create New Email / Account) ---
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name && name.trim()) || cleanEmail.split('@')[0];

    // 1. Check if email already registered in local SQLite database or Cloud Firestore
    db.get(`SELECT id FROM users WHERE LOWER(email) = ?`, [cleanEmail], async (err, existing) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        let existingUser = existing;
        if (!existingUser) {
            try {
                existingUser = await firestoreService.findUserByEmail(cleanEmail);
            } catch (fe) {}
        }

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'This email is already registered. Please use Login to access your account.',
                alreadyRegistered: true
            });
        }

        // 2. Create in Firebase Authentication
        let firebaseUid = '';
        let firebaseToken = null;
        try {
            const fbRes = await firebaseAuthService.signUp(cleanEmail, password, cleanName);
            firebaseUid = fbRes.localId || '';
            firebaseToken = fbRes.idToken || null;
        } catch (fbErr) {
            const errMsg = fbErr.message || '';
            if (errMsg.includes('EMAIL_EXISTS')) {
                // Reject duplicate registration: do not overwrite password or create duplicate account
                return res.status(409).json({
                    success: false,
                    error: 'This email is already registered. Please use Login to access your account.',
                    alreadyRegistered: true
                });
            }
            console.warn('Firebase Auth student signup note:', errMsg);
        }

        // 3. Only if unique, insert new student into database & Cloud Firestore
        db.run(
            `INSERT INTO users (name, email, password, phone, firebase_uid) VALUES (?, ?, ?, ?, ?)`,
            [cleanName, cleanEmail, password, phone || '', firebaseUid],
            function(insertErr) {
                if (insertErr) return res.status(500).json({ error: 'Failed to create user account' });
                const newId = this ? this.lastID : Date.now();
                const user = { id: newId, uid: firebaseUid || String(newId), name: cleanName, email: cleanEmail, phone: phone || '' };
                const token = jwt.sign(user, SECRET_KEY, { expiresIn: '7d' });

                // Sync to Cloud Firestore for permanent production persistence
                firestoreService.setDocument('users', firebaseUid || String(newId), {
                    uid: firebaseUid || String(newId),
                    name: cleanName,
                    email: cleanEmail,
                    phone: phone || '',
                    role: 'student',
                    created_at: new Date().toISOString()
                }).catch(e => console.warn('Firestore user sync note:', e.message));

                res.json({ success: true, token, firebaseToken, user });
            }
        );
    });
});

// --- User & Admin Sign In ---
app.post('/api/auth/signin', (req, res) => {
    const rawIdentifier = req.body.email || req.body.username || req.body.user;
    const password = req.body.password;
    if (!rawIdentifier || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    const cleanEmail = String(rawIdentifier).trim().toLowerCase();
    const envAdminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
    const envAdminPass = process.env.ADMIN_PASSWORD || process.env.admin_password || process.env.ADMIN_PASS || process.env.admin_pass;
    const envAdminName = process.env.ADMIN_NAME || 'Cube Cad Admin';

    const isMatchAdmin = isAdminIdentifier(cleanEmail, envAdminEmail);

    // 1. Check if matching admin credentials
    db.get(
        `SELECT * FROM admins WHERE LOWER(email) = ? OR LOWER(email) = ? OR LOWER(email) = ?`,
        [cleanEmail, envAdminEmail, DEFAULT_ADMIN_EMAIL],
        async (errAdmin, admin) => {
            if (errAdmin) return res.status(500).json({ error: 'Database error' });

            const isSqliteAdmin = admin && (admin.email.toLowerCase() === cleanEmail || isMatchAdmin);
            const isValidPassword = verifyAdminPassword(password, envAdminPass);

            if ((isMatchAdmin || isSqliteAdmin) && isValidPassword) {
                const adminName = (admin && admin.name) || envAdminName;
                const adminMail = (admin && admin.email) || envAdminEmail;
                const adminId = (admin && admin.id) || 1;
                const adminPayload = { id: adminId, name: adminName, email: adminMail, isAdmin: true, role: 'admin' };
                const adminToken = jwt.sign(adminPayload, SECRET_KEY, { expiresIn: '12h' });
                res.setHeader('Set-Cookie', `ccc_admin_token=${adminToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
                return res.json({
                    success: true,
                    isAdmin: true,
                    token: adminToken,
                    adminToken: adminToken,
                    user: { id: adminId, name: adminName, email: adminMail, isAdmin: true },
                    redirect: 'admin.html'
                });
            }

            // 2. Regular user check: Authenticate primarily against Firebase Authentication
            let firebaseToken = null;
            let fbUid = '';
            let isFbAuthenticated = false;

            try {
                const fbRes = await firebaseAuthService.signInWithPassword(cleanEmail, password);
                if (fbRes && fbRes.idToken) {
                    firebaseToken = fbRes.idToken;
                    fbUid = fbRes.localId || '';
                    isFbAuthenticated = true;
                }
            } catch (fbErr) {
                const msg = fbErr.message || '';
                // If Firebase Auth specifically rejected credentials (wrong password / user not found)
                if (msg.includes('INVALID_LOGIN_CREDENTIALS') || msg.includes('INVALID_PASSWORD') || msg.includes('EMAIL_NOT_FOUND')) {
                    return res.status(401).json({ error: 'Invalid email or password' });
                }
                console.warn('Firebase Auth signin note:', msg);
            }

            // 3. User Lookup and Synchronization in SQLite and Cloud Firestore
            db.get(`SELECT * FROM users WHERE LOWER(email) = ?`, [cleanEmail], async (err, user) => {
                if (err) return res.status(500).json({ error: 'Database error' });

                // If authenticated via Firebase Auth
                if (isFbAuthenticated) {
                    if (user) {
                        if (!user.firebase_uid && fbUid) {
                            db.run(`UPDATE users SET firebase_uid = ? WHERE id = ?`, [fbUid, user.id]);
                        }
                        const userData = { id: user.id, uid: fbUid || user.firebase_uid, name: user.name, email: user.email, phone: user.phone || '', isAdmin: false };
                        const token = jwt.sign(userData, SECRET_KEY, { expiresIn: '7d' });
                        return res.json({ success: true, token, firebaseToken, user: userData, isAdmin: false });
                    }

                    // Check Firestore if local SQLite didn't have user record
                    let docUser = null;
                    try {
                        docUser = await firestoreService.findUserByEmail(cleanEmail);
                    } catch (fe) {}

                    if (docUser) {
                        const userData = { id: docUser.id || fbUid, uid: fbUid || docUser.uid, name: docUser.name || cleanEmail.split('@')[0], email: docUser.email || cleanEmail, phone: docUser.phone || '', isAdmin: false };
                        const token = jwt.sign(userData, SECRET_KEY, { expiresIn: '7d' });
                        return res.json({ success: true, token, firebaseToken, user: userData, isAdmin: false });
                    } else {
                        // Provision user record in Firestore and local DB for verified Firebase student
                        firestoreService.setDocument('users', fbUid, {
                            uid: fbUid,
                            name: cleanEmail.split('@')[0],
                            email: cleanEmail,
                            phone: '',
                            role: 'student',
                            created_at: new Date().toISOString()
                        }).catch(() => {});

                        db.run(
                            `INSERT INTO users (name, email, password, phone, firebase_uid) VALUES (?, ?, '', '', ?)`,
                            [cleanEmail.split('@')[0], cleanEmail, fbUid],
                            function(insertErr) {
                                const newId = this ? this.lastID : 0;
                                const userData = { id: newId || fbUid, uid: fbUid, name: cleanEmail.split('@')[0], email: cleanEmail, phone: '', isAdmin: false };
                                const token = jwt.sign(userData, SECRET_KEY, { expiresIn: '7d' });
                                return res.json({ success: true, token, firebaseToken, user: userData, isAdmin: false });
                            }
                        );
                        return;
                    }
                }

                // Fallback for local users without Firebase Auth record (only if Firebase did not reject password)
                if (user && user.password === password) {
                    const userData = { id: user.id, uid: user.firebase_uid || String(user.id), name: user.name, email: user.email, phone: user.phone || '', isAdmin: false };
                    const token = jwt.sign(userData, SECRET_KEY, { expiresIn: '7d' });
                    return res.json({ success: true, token, firebaseToken: null, user: userData, isAdmin: false });
                }

                return res.status(401).json({ error: 'Invalid email or password' });
            });
        }
    );
});


// --- User Profile (Verify Current Session) ---
app.get('/api/auth/me', authenticateToken, (req, res) => {
    if (typeof req.user.id === 'number') {
        db.get(`SELECT id, name, email, phone, created_at FROM users WHERE id = ?`, [req.user.id], (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'User not found' });
            res.json({ success: true, user });
        });
    } else {
        db.get(`SELECT id, name, email, phone, created_at FROM users WHERE LOWER(email) = ?`, [(req.user.email || '').toLowerCase()], (err, user) => {
            if (user) {
                res.json({ success: true, user });
            } else {
                res.json({ success: true, user: { id: req.user.id || req.user.uid, name: req.user.name, email: req.user.email, phone: req.user.phone || '' } });
            }
        });
    }
});

// --- Asia/Kolkata Timezone & Date Validation Helpers ---
function parseSlotTimeToMinutes(slotStr) {
    if (!slotStr) return 0;
    const str = slotStr.trim().toUpperCase();
    const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match12) return 0;
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const meridiem = match12[3];
    if (meridiem) {
        if (meridiem === 'PM' && hours < 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
    }
    return hours * 60 + minutes;
}

function getKolkataTimeInfo() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const today = formatter.format(now); // YYYY-MM-DD in Asia/Kolkata

    const maxDateObj = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const maxDate = formatter.format(maxDateObj);

    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    });
    const parts = timeFormatter.formatToParts(now);
    const hours = Number(parts.find(p => p.type === 'hour')?.value || 0);
    const minutes = Number(parts.find(p => p.type === 'minute')?.value || 0);
    const currentMinutes = hours * 60 + minutes;

    return { today, maxDate, currentMinutes };
}

function isSundayKolkata(dateStr) {
    const parts = (dateStr || '').split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return false;
    const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 6, 30, 0));
    const df = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
    return df.format(dt) === 'Sun';
}

function isSlotPassedKolkata(dateStr, slotStr) {
    const { today, currentMinutes } = getKolkataTimeInfo();
    if (dateStr < today) return true;
    if (dateStr > today) return false;
    const slotMinutes = parseSlotTimeToMinutes(slotStr);
    return slotMinutes <= currentMinutes;
}

function normalizePhone(rawPhone) {
    if (!rawPhone) return null;
    const digits = String(rawPhone).replace(/\D/g, '');
    let clean10 = '';
    if (digits.length === 10) {
        clean10 = digits;
    } else if (digits.length === 11 && digits.startsWith('0')) {
        clean10 = digits.slice(1);
    } else if (digits.length === 12 && digits.startsWith('91')) {
        clean10 = digits.slice(2);
    } else {
        return null;
    }
    if (!/^[6-9]\d{9}$/.test(clean10)) {
        return null;
    }
    return {
        formatted: `+91 ${clean10.slice(0, 5)} ${clean10.slice(5)}`,
        e164: `+91${clean10}`,
        digits: clean10
    };
}

function generateAppointmentId(dateStr) {
    const dateFormatted = (dateStr || getKolkataTimeInfo().today).replace(/-/g, '');
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `CCC-${dateFormatted}-${randomHex}`;
}

// In-process concurrency mutex for appointment slot capacity enforcement
const slotLocks = new Map();
function withSlotLock(slotKey, asyncFn) {
    let queue = slotLocks.get(slotKey);
    if (!queue) {
        queue = Promise.resolve();
        slotLocks.set(slotKey, queue);
    }
    const nextPromise = queue.then(() => asyncFn()).finally(() => {
        if (slotLocks.get(slotKey) === nextPromise) {
            slotLocks.delete(slotKey);
        }
    });
    slotLocks.set(slotKey, nextPromise);
    return nextPromise;
}

// Rate limiters for spam prevention
const ipRateLimits = new Map();
const phoneRateLimits = new Map();
function checkBookingRateLimits(req, phoneDigits) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    // IP limit: 10 bookings per 15 minutes
    const ipHistory = (ipRateLimits.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
    if (ipHistory.length >= 10) {
        return { limited: true, error: 'Too many requests from this IP. Please try again after 15 minutes.' };
    }
    ipHistory.push(now);
    ipRateLimits.set(ip, ipHistory);

    // Phone limit: 3 bookings per 24 hours
    if (phoneDigits) {
        const phoneHistory = (phoneRateLimits.get(phoneDigits) || []).filter(t => now - t < 24 * 60 * 60 * 1000);
        if (phoneHistory.length >= 3) {
            return { limited: true, error: 'Maximum daily appointment bookings reached for this phone number. Please call us directly for assistance.' };
        }
        phoneHistory.push(now);
        phoneRateLimits.set(phoneDigits, phoneHistory);
    }

    return { limited: false };
}

// In-memory OTP storage for REQUIRE_PHONE_OTP feature
const phoneOtps = new Map();

// Cloudflare Turnstile token verification helper
function verifyTurnstile(token, secret, ip) {
    return new Promise((resolve) => {
        const postData = new URLSearchParams({ secret, response: token, remoteip: ip || '' }).toString();
        const req = https.request({
            hostname: 'challenges.cloudflare.com',
            path: '/turnstile/v0/siteverify',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body || '{}');
                    resolve(!!parsed.success);
                } catch (e) {
                    resolve(false);
                }
            });
        });
        req.on('error', () => resolve(false));
        req.write(postData);
        req.end();
    });
}

// --- Allowed Lists ---
const VALID_BRANCHES = [
    'SATELLITE BRANCH',
    'BOPAL BRANCH',
    'Satellite Branch',
    'South Bopal Branch',
    'Satellite Campus',
    'Bopal Campus',
    'Satellite',
    'Bopal'
];

const VALID_SERVICES = [
    'AutoCAD',
    'Revit Architecture',
    'SketchUp & Interior 3D',
    '3ds Max & V-Ray',
    'STAAD.Pro & ETABS',
    'SolidWorks & Mechanical CAD',
    'HVAC & MEPF Design',
    'Architectural & Interior Design Consultation',
    'Structural & Civil Engineering Consultation',
    'Mechanical & Product Design Consultation',
    'HVAC & MEPF Design Consultation',
    'General Career & Course Counseling',
    'Free Demo Class',
    'Campus Tour & Lab Visit',
    'Campus Tour'
];

// --- Public: Check Appointment Slot Availability (Capacity: Max 3 users/slot, Asia/Kolkata timezone) ---
app.get('/api/appointments/availability', (req, res) => {
    const { today, maxDate } = getKolkataTimeInfo();
    const date = (req.query.date || today).trim();

    // Check date validity
    const parts = date.split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' });
    }

    const isSunday = isSundayKolkata(date);
    const isPast = date < today;
    const isBeyondWindow = date > maxDate;

    // Get time slots from settings
    db.get(`SELECT value FROM settings WHERE key = 'appointment_time_slots'`, (err, settingRow) => {
        let allowedSlots = DEFAULT_SLOTS;
        if (!err && settingRow && settingRow.value) {
            try {
                const parsed = JSON.parse(settingRow.value);
                if (Array.isArray(parsed) && parsed.length > 0) allowedSlots = parsed;
            } catch (e) {}
        }

        // If Sunday, past, or beyond window, slots are closed
        if (isSunday || isPast || isBeyondWindow) {
            const closedReason = isSunday 
                ? 'Sundays are holidays. Cube Cad Center is closed on Sundays.'
                : isPast 
                    ? 'Cannot book appointments for past dates.' 
                    : 'Bookings are only available within the next 7 days.';

            const closedSlots = allowedSlots.map(slot => ({
                slot,
                booked: 0,
                available: 0,
                max: 3,
                isFullyBooked: true,
                label: isSunday ? 'Closed (Sunday)' : 'Unavailable',
                statusLabel: isSunday ? 'Closed (Sunday)' : 'Unavailable'
            }));

            return res.json({
                success: true,
                date,
                today,
                maxDate,
                isSunday,
                isPast,
                isBeyondWindow,
                isAvailableDay: false,
                reason: closedReason,
                error: closedReason,
                slots: closedSlots,
                timeSlots: closedSlots
            });
        }

        // Filter out passed slots if date is today in Asia/Kolkata
        const unpassedSlots = (date === today)
            ? allowedSlots.filter(slot => !isSlotPassedKolkata(date, slot))
            : allowedSlots;

        // Query booked slots count for this date
        db.all(
            `SELECT time_slot, COUNT(*) as count FROM appointments WHERE date = ? AND status != 'Cancelled' GROUP BY time_slot`,
            [date],
            (countErr, rows) => {
                if (countErr) return res.status(500).json({ error: 'Failed to retrieve slot availability' });

                const counts = {};
                (rows || []).forEach(r => { counts[r.time_slot] = r.count; });

                const slots = unpassedSlots.map(slot => {
                    const booked = counts[slot] || 0;
                    const available = Math.max(0, 3 - booked);
                    const isFullyBooked = available === 0;

                    let label = '';
                    if (isFullyBooked) {
                        label = 'Fully Booked';
                    } else if (available === 1) {
                        label = '1 slot left';
                    }

                    return {
                        slot,
                        booked,
                        available,
                        max: 3,
                        isFullyBooked,
                        label,
                        statusLabel: label
                    };
                });

                res.json({
                    success: true,
                    date,
                    today,
                    maxDate,
                    isSunday: false,
                    isPast: false,
                    isBeyondWindow: false,
                    isAvailableDay: true,
                    slots,
                    timeSlots: slots
                });
            }
        );
    });
});

// --- Optional Phone OTP Dispatch Endpoint ---
app.post('/api/appointments/send-otp', async (req, res) => {
    const rawPhone = req.body.phone;
    const normalized = normalizePhone(rawPhone);
    if (!normalized) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    phoneOtps.set(normalized.digits, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    if (process.env.SMS_ENABLED === 'true') {
        notificationService.sendSms({
            phone: normalized.digits,
            messageText: `Your Cube Cad Center verification code is ${otp}. Valid for 5 minutes.`,
            templateId: process.env.DLT_TEMPLATE_ID_OTP
        }).catch(() => {});
    }

    res.json({
        success: true,
        message: `Verification code sent to ${notificationService.maskPhone(normalized.digits)}`
    });
});

// --- Appointment Booking Endpoint (Guest & Authenticated, Server-Enforced Capacity) ---
app.post('/api/appointments', optionalAuth, async (req, res) => {
    // 0. Honeypot check for spam bots
    if (req.body.website_url || req.body.hp_company || req.body.organization_role) {
        return res.status(400).json({ error: 'Automated submission detected.' });
    }

    const { name, email, phone, program, branch, date, mode, notes, consent } = req.body;
    const timeSlot = req.body.timeSlot || req.body.time_slot;

    // 1. Mandatory Input Validation
    const cleanName = (name || '').trim();
    if (cleanName.length < 2 || cleanName.length > 80) {
        return res.status(400).json({ error: 'Full name must be between 2 and 80 characters.' });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.' });
    }

    const cleanEmail = (email && email.trim().toLowerCase()) || '';
    if (cleanEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({ error: 'Please enter a valid email address.' });
        }
    }

    // Branch validation
    const branchChoice = (branch || 'Satellite Branch').trim();
    const isBranchValid = VALID_BRANCHES.some(b => b.toLowerCase() === branchChoice.toLowerCase());
    if (!isBranchValid) {
        return res.status(400).json({ error: 'Unknown branch. Please select Satellite Branch or Bopal Branch.' });
    }

    // Program / Service validation
    const serviceChoice = (program || req.body.service || '').trim();
    if (!serviceChoice) {
        return res.status(400).json({ error: 'Please select a consultation service or program.' });
    }
    const isServiceValid = VALID_SERVICES.some(s => s.toLowerCase() === serviceChoice.toLowerCase());
    if (!isServiceValid) {
        return res.status(400).json({ error: 'Unknown service or program. Please select from the offered programs list.' });
    }

    if (!date || !date.trim()) {
        return res.status(400).json({ error: 'Please select an appointment date.' });
    }
    if (!timeSlot || !timeSlot.trim()) {
        return res.status(400).json({ error: 'Please select an available time slot.' });
    }

    const cleanDate = date.trim();
    const cleanTimeSlot = timeSlot.trim();

    // 2. Consent Check (Mandatory DPDP Act 2023 requirement)
    const hasConsented = consent === true || consent === 'true' || consent === 1 || consent === '1';
    if (!hasConsented) {
        return res.status(400).json({ error: 'consent required: You must agree to be contacted and accept the Privacy Policy to book an appointment.' });
    }
    const consentTimestamp = new Date().toISOString();

    // 3. Optional Phone OTP Check
    if (process.env.REQUIRE_PHONE_OTP === 'true') {
        const userOtp = (req.body.otp || '').trim();
        const stored = phoneOtps.get(normalizedPhone.digits);
        if (!stored || stored.expiresAt < Date.now() || stored.otp !== userOtp) {
            return res.status(400).json({ error: 'Invalid or expired phone verification code. Please request a new OTP.' });
        }
        phoneOtps.delete(normalizedPhone.digits);
    }

    // 4. Cloudflare Turnstile Verification (if configured)
    if (process.env.TURNSTILE_SECRET) {
        const turnstileToken = req.body['cf-turnstile-response'] || req.body.turnstileToken;
        if (!turnstileToken) {
            return res.status(400).json({ error: 'Security verification required. Please complete the security check.' });
        }
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
        const valid = await verifyTurnstile(turnstileToken, process.env.TURNSTILE_SECRET, clientIp);
        if (!valid) {
            return res.status(400).json({ error: 'Security verification failed. Please refresh and try again.' });
        }
    }

    // 5. Rate Limiting Check (Spam Prevention)
    const rateCheck = checkBookingRateLimits(req, normalizedPhone.digits);
    if (rateCheck.limited) {
        return res.status(429).json({ error: rateCheck.error });
    }

    // 6. Asia/Kolkata Date Rules: Today -> Next 7 days, No Sundays, No past time slots for today
    const { today, maxDate } = getKolkataTimeInfo();

    if (cleanDate < today) {
        return res.status(400).json({ error: 'Cannot book appointments for past dates. Please pick a date within the next 7 days.' });
    }
    if (cleanDate > maxDate) {
        return res.status(400).json({ error: `Appointments can only be booked within the next 7 days (up to ${maxDate}).` });
    }
    if (isSundayKolkata(cleanDate)) {
        return res.status(400).json({ error: 'Sundays are holidays. Cube Cad Center is closed on Sundays. Please select a date from Monday to Saturday.' });
    }
    if (cleanDate === today && isSlotPassedKolkata(cleanDate, cleanTimeSlot)) {
        return res.status(400).json({ error: `The ${cleanTimeSlot} time slot has already passed for today. Please select an upcoming time slot.` });
    }

    // 7. Atomic Concurrency Lock per Slot (Max 3 capacity strictly enforced server-side)
    const slotKey = `${cleanDate}:${cleanTimeSlot}`;

    try {
        await withSlotLock(slotKey, async () => {
            return new Promise((resolve, reject) => {
                // Check duplicate booking for same phone and slot on this date
                db.get(
                    `SELECT id FROM appointments WHERE date = ? AND time_slot = ? AND (phone = ? OR phone = ?) AND status != 'Cancelled'`,
                    [cleanDate, cleanTimeSlot, normalizedPhone.digits, normalizedPhone.formatted],
                    (dupErr, dupRow) => {
                        if (dupErr) return reject(new Error('Database error during duplicate check'));
                        if (dupRow) {
                            res.status(400).json({ error: `You already have an appointment booked for ${cleanDate} at ${cleanTimeSlot}.` });
                            return resolve();
                        }

                        // Strict Capacity Check (Max 3 users per time slot)
                        db.get(
                            `SELECT COUNT(*) as count FROM appointments WHERE date = ? AND time_slot = ? AND status != 'Cancelled'`,
                            [cleanDate, cleanTimeSlot],
                            (capErr, capRow) => {
                                if (capErr) return reject(new Error('Database error during capacity check'));

                                const currentBookings = capRow ? capRow.count : 0;
                                if (currentBookings >= 3) {
                                    res.status(400).json({
                                        error: `The ${cleanTimeSlot} time slot on ${cleanDate} is Fully Booked (maximum 3 appointments reached). Please choose another time slot.`
                                    });
                                    return resolve();
                                }

                                // Generate server-side unique appointment ID
                                const bookingRef = generateAppointmentId(cleanDate);
                                const userId = req.user ? req.user.id : null;

                                db.run(
                                    `INSERT INTO appointments (booking_ref, user_id, name, email, phone, program, branch, date, time_slot, mode, notes, status) 
                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [bookingRef, userId, cleanName, cleanEmail, normalizedPhone.digits, serviceChoice, branchChoice, cleanDate, cleanTimeSlot, mode || 'In-Person', notes || '', 'Pending'],
                                    function(insertErr) {
                                        if (insertErr) return reject(new Error('Failed to record appointment in database: ' + insertErr.message));

                                        const newCount = currentBookings + 1;
                                        const remainingSlots = Math.max(0, 3 - newCount);
                                        const newId = this ? this.lastID : Date.now();

                                        const newAppointment = {
                                            id: newId,
                                            bookingRef,
                                            name: cleanName,
                                            email: cleanEmail,
                                            phone: normalizedPhone.formatted,
                                            program: serviceChoice,
                                            branch: branchChoice,
                                            date: cleanDate,
                                            timeSlot: cleanTimeSlot,
                                            mode: mode || 'In-Person',
                                            notes: notes || '',
                                            status: 'Pending',
                                            consentTimestamp
                                        };

                                        // Sync to Cloud Firestore for permanent production persistence
                                        firestoreService.setDocument('bookings', String(bookingRef || newId), {
                                            id: newId,
                                            booking_ref: bookingRef,
                                            user_id: String(userId || ''),
                                            name: cleanName,
                                            email: cleanEmail,
                                            phone: normalizedPhone.digits,
                                            program: serviceChoice,
                                            branch: branchChoice,
                                            date: cleanDate,
                                            time_slot: cleanTimeSlot,
                                            mode: mode || 'In-Person',
                                            notes: notes || '',
                                            status: 'Pending',
                                            assigned_caller_id: 0,
                                            assigned_caller_name: 'Unassigned',
                                            call_status: 'Not Called',
                                            consent_timestamp: consentTimestamp,
                                            created_at: new Date().toISOString()
                                        }).catch(e => console.warn('Firestore booking sync note:', e.message));

                                        // Dispatch Notifications (Email & SMS) Post-Commit (non-blocking)
                                        notificationService.notifyAppointmentCreated(newAppointment).catch(err => {
                                            console.warn('Notification dispatch error:', err.message);
                                        });

                                        res.json({
                                            success: true,
                                            message: 'Appointment request submitted! Status is Pending approval.',
                                            appointment: newAppointment,
                                            remainingSlots
                                        });

                                        resolve();
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });
    } catch (lockErr) {
        console.error('Slot booking error:', lockErr.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Server error while reserving appointment slot. Please try again.' });
        }
    }
});


// --- Public: Get Allowed Appointment Time Slots ---
const DEFAULT_SLOTS = [
    '10:00 AM', '11:00 AM', '12:00 PM',
    '02:00 PM', '03:00 PM', '04:00 PM',
    '05:00 PM', '06:00 PM', '07:00 PM'
];

app.get('/api/time-slots', (req, res) => {
    db.get(`SELECT value FROM settings WHERE key = 'appointment_time_slots'`, (err, row) => {
        if (err || !row) {
            return res.json({ success: true, timeSlots: DEFAULT_SLOTS });
        }
        try {
            const parsed = JSON.parse(row.value);
            res.json({ success: true, timeSlots: Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SLOTS });
        } catch (e) {
            res.json({ success: true, timeSlots: DEFAULT_SLOTS });
        }
    });
});

// --- Admin: Update Allowed Appointment Time Slots ---
app.post('/api/admin/time-slots', authenticateAdmin, (req, res) => {
    const { timeSlots } = req.body;
    if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
        return res.status(400).json({ error: 'At least one valid time slot is required' });
    }
    const cleanSlots = timeSlots.map(s => String(s).trim()).filter(Boolean);
    if (cleanSlots.length === 0) {
        return res.status(400).json({ error: 'At least one valid time slot is required' });
    }
    const val = JSON.stringify(cleanSlots);

    db.get(`SELECT * FROM settings WHERE key = 'appointment_time_slots'`, (err, row) => {
        if (!row) {
            db.run(`INSERT INTO settings (key, value) VALUES ('appointment_time_slots', ?)`, [val], (insErr) => {
                if (insErr) return res.status(500).json({ error: 'Failed to save time slots' });
                res.json({ success: true, timeSlots: cleanSlots, message: 'Time slots updated successfully' });
            });
        } else {
            db.run(`UPDATE settings SET value = ? WHERE key = 'appointment_time_slots'`, [val], (upErr) => {
                if (upErr) return res.status(500).json({ error: 'Failed to update time slots' });
                res.json({ success: true, timeSlots: cleanSlots, message: 'Time slots updated successfully' });
            });
        }
    });
});

// --- Get Appointments for Logged In User or Guest (by email, phone, or bookingRef) ---
app.get('/api/appointments/my', optionalAuth, (req, res) => {
    const email = req.query.email || (req.user && req.user.email);
    const phone = req.query.phone || (req.user && req.user.phone);
    const ref = req.query.ref || req.query.booking_ref;

    if (!email && !phone && !ref) {
        return res.status(400).json({ error: 'Email, phone, or appointment reference required' });
    }

    let sql = `SELECT * FROM appointments WHERE 1=1`;
    const params = [];
    if (email) {
        sql += ` AND LOWER(email) = ?`;
        params.push(email.trim().toLowerCase());
    }
    if (phone) {
        const clean10 = String(phone).replace(/\D/g, '').slice(-10);
        sql += ` AND (phone LIKE ? OR phone = ?)`;
        params.push(`%${clean10}`, phone.trim());
    }
    if (ref) {
        sql += ` AND (booking_ref = ? OR id = ?)`;
        params.push(ref.trim(), ref.trim());
    }
    sql += ` ORDER BY id DESC`;

    db.all(sql, params, async (err, rows) => {
        if (!err && rows && rows.length > 0) {
            return res.json({ success: true, appointments: rows });
        }

        // Fallback: Query Cloud Firestore bookings
        try {
            if (email) {
                const fbList = await firestoreService.getBookingsForEmail(email.trim().toLowerCase());
                if (fbList && fbList.length > 0) {
                    return res.json({ success: true, appointments: fbList });
                }
            }
        } catch (fe) {}

        res.json({ success: true, appointments: rows || [] });
    });
});

// --- Cancel Appointment (Frees the Slot) ---
app.delete('/api/appointments/:id', optionalAuth, (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM appointments WHERE id = ? OR booking_ref = ?`, [id, id], (fetchErr, appointment) => {
        // Cancel in Firestore
        firestoreService.updateDocument('bookings', String(id), { status: 'Cancelled' }).catch(() => {});
        db.run(`UPDATE appointments SET status = 'Cancelled' WHERE id = ? OR booking_ref = ?`, [id, id], function(err) {
            if (err) return res.status(500).json({ error: 'Failed to cancel appointment' });
            if (appointment) {
                notificationService.notifyStatusChange(appointment, 'Cancelled').catch(() => {});
            }
            res.json({ success: true, message: 'Appointment cancelled successfully. Time slot is now freed.' });
        });
    });
});

// 2. Courses API
app.get('/api/courses', (req, res) => {
    db.all(`SELECT * FROM courses`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/courses', authenticateToken, (req, res) => {
    const { title, desc, icon, date } = req.body;
    db.run(`INSERT INTO courses (title, desc, icon, date) VALUES (?, ?, ?, ?)`, 
        [title, desc, icon, date], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, title, desc, icon, date });
        }
    );
});

app.delete('/api/courses/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM courses WHERE id = ?`, id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, deletedID: id });
    });
});

// 4. Settings API
app.get('/api/settings', (req, res) => {
    db.all(`SELECT * FROM settings`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = row.value === 'true'; // parse boolean
        });
        res.json(settings);
    });
});

app.post('/api/settings', authenticateToken, (req, res) => {
    const { maintenance } = req.body;
    db.run(`UPDATE settings SET value = ? WHERE key = 'maintenance'`, 
        [maintenance ? 'true' : 'false'], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// =============================================
// ADMIN API ENDPOINTS
// =============================================

// --- Admin Sign In ---
app.post('/api/admin/signin', (req, res) => {
    const rawIdentifier = req.body.email || req.body.username || req.body.user;
    const password = req.body.password;
    if (!rawIdentifier || !password) {
        return res.status(400).json({ error: 'Email/username and password are required' });
    }
    const cleanInput = String(rawIdentifier).trim().toLowerCase();
    const envAdminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
    const envAdminPass = process.env.ADMIN_PASSWORD || process.env.admin_password || process.env.ADMIN_PASS || process.env.admin_pass;
    const envAdminName = process.env.ADMIN_NAME || 'Cube Cad Admin';

    const isMatchIdentifier = isAdminIdentifier(cleanInput, envAdminEmail);

    db.get(
        `SELECT * FROM admins WHERE LOWER(email) = ? OR LOWER(email) = ? OR LOWER(email) = ?`,
        [cleanInput, envAdminEmail, DEFAULT_ADMIN_EMAIL],
        (err, admin) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            const isSqliteAdmin = admin && (admin.email.toLowerCase() === cleanInput || isMatchIdentifier);
            const isValidPassword = verifyAdminPassword(password, envAdminPass);

            if ((isMatchIdentifier || isSqliteAdmin) && isValidPassword) {
                const adminName = (admin && admin.name) || envAdminName;
                const adminMail = (admin && admin.email) || envAdminEmail;
                const adminId = (admin && admin.id) || 1;
                const payload = { id: adminId, name: adminName, email: adminMail, isAdmin: true, role: 'admin' };
                const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '12h' });
                res.setHeader('Set-Cookie', `ccc_admin_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
                return res.json({ success: true, token, admin: { id: adminId, name: adminName, email: adminMail } });
            }

            return res.status(401).json({ error: 'Invalid admin credentials' });
        }
    );
});

// --- Admin Logout (Clears ccc_admin_token cookie) ---
app.all(['/api/admin/logout', '/api/auth/logout'], (req, res) => {
    res.setHeader('Set-Cookie', 'ccc_admin_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    res.json({ success: true, message: 'Logged out successfully' });
});

// --- Admin Certificate Generator Page (Server-Side Admin Route) ---
app.get(['/admin/certificates', '/admin/certificates/'], requireAdmin, (req, res) => {
    const certPath = path.join(__dirname, 'private', 'certificate-admin.html');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(certPath);
});

// --- Admin Verify Session ---
app.get('/api/admin/me', authenticateAdmin, (req, res) => {
    res.json({ success: true, admin: req.admin });
});

// --- Admin Dashboard Stats ---
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
    const q = `
        SELECT
            COUNT(*) as totalAppointments,
            COUNT(CASE WHEN LOWER(COALESCE(status, '')) = 'pending' THEN 1 END) as pendingAppointments,
            COUNT(CASE WHEN LOWER(COALESCE(status, '')) = 'confirmed' THEN 1 END) as confirmedAppointments,
            COUNT(CASE WHEN LOWER(COALESCE(status, '')) = 'cancelled' THEN 1 END) as cancelledAppointments,
            COUNT(CASE WHEN LOWER(COALESCE(status, '')) = 'completed' THEN 1 END) as completedAppointments,
            COUNT(CASE WHEN date = date('now', 'localtime') THEN 1 END) as todayAppointments,
            COUNT(CASE WHEN date >= date('now', 'localtime') THEN 1 END) as upcomingAppointments,
            COUNT(CASE WHEN date(created_at, 'localtime') = date('now', 'localtime') THEN 1 END) as bookedToday,
            COUNT(CASE WHEN date(created_at, 'localtime') = date('now', 'localtime', '-1 day') THEN 1 END) as bookedYesterday,
            COUNT(CASE WHEN date(created_at, 'localtime') >= date('now', 'localtime', 'weekday 0', '-6 days') THEN 1 END) as bookedThisWeek,
            COUNT(CASE WHEN strftime('%Y', created_at, 'localtime') = strftime('%Y', 'now', 'localtime') THEN 1 END) as bookedThisYear
        FROM appointments
    `;

    db.get(q, async (err, apptStats) => {
        if (!err && apptStats && (apptStats.totalAppointments > 0 || !process.env.VERCEL)) {
            db.get(`SELECT COUNT(*) as totalUsers FROM users`, (errU, userRow) => {
                const stats = Object.assign({}, apptStats || {}, {
                    totalUsers: userRow ? userRow.totalUsers : 0
                });
                return res.json({ success: true, stats });
            });
            return;
        }

        // Fallback: Aggregate stats from Cloud Firestore
        try {
            const [bookings, users] = await Promise.all([
                firestoreService.listDocuments('bookings'),
                firestoreService.listDocuments('users')
            ]);
            const todayStr = new Date().toISOString().split('T')[0];
            const stats = {
                totalAppointments: bookings.length,
                pendingAppointments: bookings.filter(b => (b.status || '').toLowerCase() === 'pending').length,
                confirmedAppointments: bookings.filter(b => (b.status || '').toLowerCase() === 'confirmed').length,
                cancelledAppointments: bookings.filter(b => (b.status || '').toLowerCase() === 'cancelled').length,
                completedAppointments: bookings.filter(b => (b.status || '').toLowerCase() === 'completed').length,
                todayAppointments: bookings.filter(b => b.date === todayStr).length,
                upcomingAppointments: bookings.filter(b => b.date >= todayStr).length,
                bookedToday: bookings.filter(b => (b.created_at || '').startsWith(todayStr)).length,
                bookedYesterday: 0,
                bookedThisWeek: bookings.length,
                bookedThisYear: bookings.length,
                totalUsers: users.length
            };
            return res.json({ success: true, stats });
        } catch (fe) {
            res.json({ success: true, stats: apptStats || {} });
        }
    });
});


// --- Admin: Get All Appointments ---
app.get('/api/admin/appointments', authenticateAdmin, (req, res) => {
    const { status, search, date, limit, offset } = req.query;
    let sql = `SELECT * FROM appointments WHERE 1=1`;
    const params = [];

    if (status && status !== 'all') {
        sql += ` AND status = ?`;
        params.push(status);
    }
    if (date) {
        sql += ` AND date = ?`;
        params.push(date);
    }
    if (search) {
        sql += ` AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR booking_ref LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s);
    }

    sql += ` ORDER BY id DESC`;
    if (limit) {
        sql += ` LIMIT ?`;
        params.push(parseInt(limit));
        if (offset) {
            sql += ` OFFSET ?`;
            params.push(parseInt(offset));
        }
    }

    db.all(sql, params, async (err, rows) => {
        if (!err && rows && rows.length > 0) {
            return res.json({ success: true, appointments: rows });
        }
        // Fallback: Query Cloud Firestore bookings when in serverless / without SQLite
        try {
            const allDocs = await firestoreService.listDocuments('bookings');
            if (allDocs && allDocs.length > 0) {
                let filtered = allDocs;
                if (status && status !== 'all') {
                    filtered = filtered.filter(b => (b.status || '').toLowerCase() === status.toLowerCase());
                }
                if (date) {
                    filtered = filtered.filter(b => b.date === date);
                }
                if (search) {
                    const s = search.toLowerCase();
                    filtered = filtered.filter(b =>
                        (b.name || '').toLowerCase().includes(s) ||
                        (b.email || '').toLowerCase().includes(s) ||
                        (b.phone || '').toLowerCase().includes(s) ||
                        (b.booking_ref || '').toLowerCase().includes(s)
                    );
                }
                return res.json({ success: true, appointments: filtered });
            }
        } catch (fe) {}
        res.json({ success: true, appointments: rows || [] });
    });
});

// --- Admin: Update Appointment Status & Time/Date ---
app.patch('/api/admin/appointments/:id', authenticateAdmin, (req, res) => {
    const { status, date, timeSlot, time_slot, notes } = req.body;
    const id = req.params.id;
    const chosenTime = timeSlot || time_slot;

    const fields = [];
    const params = [];

    if (status) {
        fields.push('status = ?');
        params.push(status);
    }
    if (date) {
        fields.push('date = ?');
        params.push(date);
    }
    if (chosenTime) {
        fields.push('time_slot = ?');
        params.push(chosenTime);
    }
    if (notes !== undefined) {
        fields.push('notes = ?');
        params.push(notes);
    }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'No update fields provided' });
    }

    params.push(id);
    db.run(`UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`, params, function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update appointment' });
        if (this.changes === 0) return res.status(404).json({ error: 'Appointment not found' });

        // Query updated record for notifications and Firestore sync
        db.get(`SELECT * FROM appointments WHERE id = ?`, [id], (fetchErr, appointment) => {
            if (!fetchErr && appointment) {
                // Sync status to Cloud Firestore
                if (status) {
                    firestoreService.updateDocument('bookings', String(appointment.booking_ref || id), {
                        status: appointment.status
                    }).catch(() => {});
                    // Send status notification (Confirmed, Cancelled/Rejected)
                    notificationService.notifyStatusChange(appointment, status).catch(() => {});
                }
            }
        });

        res.json({
            success: true,
            message: `Appointment #${id} updated successfully`,
            updated: { id, status, date, timeSlot: chosenTime, notes }
        });
    });
});

// ─── RECYCLE BIN API (30-DAY RETENTION & 1-CLICK RECOVERY) ───
function moveToRecycleBin(itemType, originalId, title, subtitle, details, deletedBy, callback) {
    const detailsJson = typeof details === 'string' ? details : JSON.stringify(details);
    const sql = `INSERT INTO recycle_bin (item_type, original_id, title, subtitle, details, deleted_by, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+30 days'))`;
    db.run(sql, [itemType, String(originalId), title || 'Untitled', subtitle || '', detailsJson, deletedBy || 'Admin'], function(err) {
        if (err) return callback(err);
        callback(null, this.lastID);
    });
}

// --- Admin: Get Recycle Bin Items (Auto-cleans expired items) ---
app.get('/api/admin/recycle-bin', authenticateAdmin, (req, res) => {
    db.run(`DELETE FROM recycle_bin WHERE expires_at < CURRENT_TIMESTAMP`, () => {
        const sql = `
            SELECT id, item_type, original_id, title, subtitle, details, deleted_by, deleted_at, expires_at,
                   MAX(0, CAST(ROUND(julianday(expires_at) - julianday('now')) AS INTEGER)) as days_remaining
            FROM recycle_bin
            ORDER BY id DESC
        `;
        db.all(sql, [], (err, rows) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true, items: rows || [] });
        });
    });
});

// --- Admin: Restore Item from Recycle Bin ---
app.post('/api/admin/recycle-bin/:id/restore', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM recycle_bin WHERE id = ?`, [id], (err, item) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!item) return res.status(404).json({ error: 'Item not found in Recycle Bin or expired' });

        let data;
        try {
            data = JSON.parse(item.details);
        } catch (e) {
            return res.status(500).json({ error: 'Corrupted snapshot in Recycle Bin' });
        }

        const finishRestore = (insertErr, newId) => {
            if (insertErr) return res.status(500).json({ error: 'Failed to restore item: ' + insertErr.message });
            db.run(`DELETE FROM recycle_bin WHERE id = ?`, [id], (delErr) => {
                res.json({
                    success: true,
                    message: `"${item.title}" successfully restored`,
                    itemType: item.item_type,
                    restoredId: newId || data.id,
                    restoredItem: data
                });
            });
        };

        if (item.item_type === 'appointment') {
            db.run(
                `INSERT INTO appointments (booking_ref, user_id, name, phone, email, program, branch, date, time_slot, mode, notes, status, call_status, call_notes, last_called_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [data.booking_ref, data.user_id || null, data.name, data.phone, data.email, data.program, data.branch, data.date, data.time_slot, data.mode, data.notes, data.status || 'Confirmed', data.call_status || 'Not Called', data.call_notes || '', data.last_called_at || ''],
                function(insertErr) { finishRestore(insertErr, this.lastID); }
            );
        } else if (item.item_type === 'customer') {
            const notesHist = typeof data.notes_history === 'string' ? data.notes_history : JSON.stringify(data.notes_history || []);
            const callLogs = typeof data.call_logs === 'string' ? data.call_logs : JSON.stringify(data.call_logs || []);
            db.run(
                `INSERT INTO customers (name, mobile, email, course, status, notes, notes_history, call_logs, last_called_at, last_call_status, source)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [data.name, data.mobile, data.email, data.course, data.status || 'Active', data.notes || '', notesHist, callLogs, data.last_called_at || '', data.last_call_status || '', data.source || 'Direct Entry'],
                function(insertErr) { finishRestore(insertErr, this.lastID); }
            );
        } else if (item.item_type === 'service') {
            db.run(
                `INSERT INTO services (name, category, duration, fee, description, is_active)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [data.name, data.category || 'CAD & Engineering', data.duration || '2 Months', data.fee || '₹15,000', data.description || '', data.is_active !== undefined ? data.is_active : 1],
                function(insertErr) { finishRestore(insertErr, this.lastID); }
            );
        } else if (item.item_type === 'holiday') {
            db.run(
                `INSERT OR REPLACE INTO holidays (date, title, description)
                 VALUES (?, ?, ?)`,
                [data.date, data.title, data.description || ''],
                function(insertErr) { finishRestore(insertErr, this.lastID); }
            );
        } else if (item.item_type === 'announcement') {
            db.run(
                `INSERT INTO announcements (title, message, priority, badge, is_active, start_date, end_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [data.title, data.message || '', data.priority || 'info', data.badge || 'Announcement', data.is_active !== undefined ? data.is_active : 1, data.start_date || '', data.end_date || ''],
                function(insertErr) { finishRestore(insertErr, this.lastID); }
            );
        } else if (item.item_type === 'user') {
            db.run(
                `INSERT INTO users (name, email, phone, password)
                 VALUES (?, ?, ?, ?)`,
                [data.name, data.email, data.phone, data.password || 'User@123'],
                function(insertErr) { finishRestore(insertErr, this.lastID); }
            );
        } else {
            res.status(400).json({ error: 'Unknown item type: ' + item.item_type });
        }
    });
});

// --- Admin: Permanently Delete Single Item from Recycle Bin ---
app.delete('/api/admin/recycle-bin/:id', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM recycle_bin WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'Item not found in Recycle Bin' });
        res.json({ success: true, message: 'Item permanently deleted' });
    });
});

// --- Admin: Empty Recycle Bin (Purge All) ---
app.post('/api/admin/recycle-bin/empty', authenticateAdmin, (req, res) => {
    db.run(`DELETE FROM recycle_bin`, [], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, message: `Recycle Bin emptied (${this.changes} items permanently purged)` });
    });
});

// --- Admin: Delete Appointment (Soft-delete to Recycle Bin for 30 days) ---
app.delete('/api/admin/appointments/:id', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM appointments WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Appointment not found' });

        const title = `${row.name || 'Appointment'} - ${row.program || 'Counseling'}`;
        const subtitle = `Ref: ${row.booking_ref || '#' + row.id} | Date: ${row.date || ''} ${row.time_slot || ''} | Phone: ${row.phone || ''}`;
        moveToRecycleBin('appointment', row.id, title, subtitle, row, req.admin?.name, (errRecycle, recycleId) => {
            if (errRecycle) return res.status(500).json({ error: 'Failed to move to recycle bin' });

            db.run(`DELETE FROM appointments WHERE id = ?`, [id], function(delErr) {
                if (delErr) return res.status(500).json({ error: 'Failed to delete appointment' });
                res.json({
                    success: true,
                    recycleId,
                    message: `Appointment #${id} moved to Recycle Bin (Recoverable for 30 days)`
                });
            });
        });
    });
});

// --- Admin: Get All Users ---
app.get('/api/admin/users', authenticateAdmin, (req, res) => {
    db.all(`SELECT id, name, email, phone, created_at FROM users ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, users: rows || [] });
    });
});

// --- Admin: Delete User (Soft-delete to Recycle Bin for 30 days) ---
app.delete('/api/admin/users/:id', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'User not found' });

        const title = row.name || row.email || 'User';
        const subtitle = `Email: ${row.email} | Phone: ${row.phone || 'N/A'}`;
        moveToRecycleBin('user', row.id, title, subtitle, row, req.admin?.name, (errRecycle, recycleId) => {
            if (errRecycle) return res.status(500).json({ error: 'Failed to move to recycle bin' });

            db.run(`DELETE FROM users WHERE id = ?`, [id], function(delErr) {
                if (delErr) return res.status(500).json({ error: 'Failed to delete user' });
                res.json({
                    success: true,
                    recycleId,
                    message: `User #${id} moved to Recycle Bin (Recoverable for 30 days)`
                });
            });
        });
    });
});

// ─── ADMIN: CUSTOMER DATA DIRECTORY & EXCEL IMPORT ───
app.get('/api/admin/customers', authenticateAdmin, (req, res) => {
    db.all(`SELECT * FROM customers ORDER BY id DESC`, [], async (err, rows) => {
        if (!err && rows && rows.length > 0) {
            const list = rows.map(r => ({
                ...r,
                notes_history: r.notes_history ? (typeof r.notes_history === 'string' ? JSON.parse(r.notes_history || '[]') : r.notes_history) : [],
                call_logs: r.call_logs ? (typeof r.call_logs === 'string' ? JSON.parse(r.call_logs || '[]') : r.call_logs) : []
            }));
            return res.json({ success: true, customers: list });
        }
        // Fallback: Query Cloud Firestore customers when in serverless / without SQLite
        try {
            const allDocs = await firestoreService.listDocuments('customers');
            if (allDocs && allDocs.length > 0) {
                return res.json({ success: true, customers: allDocs });
            }
        } catch (fe) {}
        res.json({ success: true, customers: [] });
    });
});

app.post('/api/admin/customers', authenticateAdmin, (req, res) => {
    const { name, mobile, email, course, status, notes, source } = req.body;
    const nowIso = new Date().toISOString();
    const notesHist = notes ? JSON.stringify([{ text: notes, created_at: nowIso, author: req.admin?.name || 'Admin' }]) : '[]';

    db.run(
        `INSERT INTO customers (name, mobile, email, course, status, notes, notes_history, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [name || 'Unnamed Customer', mobile || '', email || '', course || '', status || 'Active', notes || '', notesHist, source || 'Direct Entry'],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to create customer' });
            const newId = this ? this.lastID : Date.now();
            firestoreService.setDocument('customers', String(newId), {
                id: newId,
                name: name || 'Unnamed Customer',
                mobile: mobile || '',
                email: email || '',
                course: course || '',
                status: status || 'Active',
                notes: notes || '',
                notes_history: notes ? [{ text: notes, created_at: nowIso, author: req.admin?.name || 'Admin' }] : [],
                source: source || 'Direct Entry',
                created_at: nowIso,
                updated_at: nowIso
            }).catch(() => {});
            res.json({ success: true, id: newId, message: 'Customer added successfully' });
        }
    );
});

app.put('/api/admin/customers/:id', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    const { name, mobile, email, course, status, notes } = req.body;
    const nowIso = new Date().toISOString();
    firestoreService.updateDocument('customers', String(id), {
        name, mobile, email, course, status, notes, updated_at: nowIso
    }).catch(() => {});
    db.run(
        `UPDATE customers SET name = COALESCE(?, name), mobile = COALESCE(?, mobile), email = COALESCE(?, email), course = COALESCE(?, course), status = COALESCE(?, status), notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [name, mobile, email, course, status, notes, id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to update customer' });
            res.json({ success: true, message: 'Customer updated successfully' });
        }
    );
});

// --- Admin: Delete Customer (Soft-delete to Recycle Bin for 30 days) ---
app.delete('/api/admin/customers/:id', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM customers WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Customer not found' });

        const title = `${row.name || 'Customer'}${row.course ? ' (' + row.course + ')' : ''}`;
        const subtitle = `Mobile: ${row.mobile || 'N/A'} | Status: ${row.status || 'Active'} | Source: ${row.source || 'Direct Entry'}`;
        moveToRecycleBin('customer', row.id, title, subtitle, row, req.admin?.name, (errRecycle, recycleId) => {
            if (errRecycle) return res.status(500).json({ error: 'Failed to move to recycle bin' });

            db.run(`DELETE FROM customers WHERE id = ?`, [id], function(delErr) {
                if (delErr) return res.status(500).json({ error: 'Failed to remove customer' });
                res.json({
                    success: true,
                    recycleId,
                    message: `Customer "${row.name}" moved to Recycle Bin (Recoverable for 30 days)`
                });
            });
        });
    });
});

app.post('/api/admin/customers/:id/note', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'Note text required' });

    db.get(`SELECT notes_history FROM customers WHERE id = ?`, [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Customer not found' });
        let hist = [];
        try { hist = JSON.parse(row.notes_history || '[]'); } catch(e){}
        hist.unshift({ text: note, created_at: new Date().toISOString(), author: req.admin?.name || 'Admin' });

        db.run(`UPDATE customers SET notes = ?, notes_history = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [note, JSON.stringify(hist), id],
            function(err2) {
                if (err2) return res.status(500).json({ error: 'Failed to add note' });
                res.json({ success: true, notes_history: hist });
            }
        );
    });
});

app.post('/api/admin/customers/:id/call', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    const { status, notes, next_follow_up } = req.body;
    const nowIso = new Date().toISOString();

    db.get(`SELECT call_logs FROM customers WHERE id = ?`, [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Customer not found' });
        let logs = [];
        try { logs = JSON.parse(row.call_logs || '[]'); } catch(e){}
        logs.unshift({
            timestamp: nowIso,
            status: status || 'Connected',
            notes: notes || '',
            agent: req.admin?.name || 'Admin',
            next_follow_up: next_follow_up || null
        });

        db.run(
            `UPDATE customers SET call_logs = ?, last_called_at = ?, last_call_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [JSON.stringify(logs), nowIso, status || 'Connected', id],
            function(err2) {
                if (err2) return res.status(500).json({ error: 'Failed to log call' });
                res.json({ success: true, call_logs: logs });
            }
        );
    });
});

app.post('/api/admin/customers/batch-import', authenticateAdmin, (req, res) => {
    const { records, skipDuplicates, updateExisting } = req.body;
    if (!Array.isArray(records) || !records.length) {
        return res.status(400).json({ error: 'No records provided' });
    }

    db.all(`SELECT id, mobile, email FROM customers`, [], (err, existing) => {
        if (err) return res.status(500).json({ error: 'Database query error' });

        const phoneMap = new Map();
        const emailMap = new Map();
        const normalizePhone = p => {
            if (!p) return '';
            const d = String(p).replace(/\D/g, '');
            return d.length >= 10 ? d.slice(-10) : d;
        };

        existing.forEach(c => {
            const p = normalizePhone(c.mobile);
            if (p) phoneMap.set(p, c.id);
            const e = (c.email || '').toLowerCase().trim();
            if (e) emailMap.set(e, c.id);
        });

        let imported = 0;
        let skipped = 0;
        let updated = 0;

        const stmtInsert = db.prepare(`INSERT INTO customers (name, mobile, email, course, status, notes, notes_history, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'Excel Import', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
        const stmtUpdate = db.prepare(`UPDATE customers SET name = COALESCE(NULLIF(?, ''), name), course = COALESCE(NULLIF(?, ''), course), status = COALESCE(NULLIF(?, ''), status), updated_at = CURRENT_TIMESTAMP WHERE id = ?`);

        records.forEach(r => {
            const name = (r.name || r.Name || '').trim();
            const rawPhone = r.mobile || r.Mobile || r.phone || r.Phone || '';
            const normPhone = normalizePhone(rawPhone);
            const email = (r.email || r.Email || '').toLowerCase().trim();
            const course = (r.course || r.Course || '').trim();
            const status = (r.status || r.Status || 'Active').trim();
            const notes = (r.notes || r.Notes || '').trim();

            const existingId = (normPhone && phoneMap.get(normPhone)) || (email && emailMap.get(email));
            if (existingId) {
                if (updateExisting) {
                    stmtUpdate.run([name, course, status, existingId]);
                    updated++;
                } else if (skipDuplicates !== false) {
                    skipped++;
                }
            } else {
                const nowIso = new Date().toISOString();
                const hist = notes ? JSON.stringify([{ text: notes, created_at: nowIso, author: 'Excel Import' }]) : '[]';
                stmtInsert.run([name || 'Unnamed Customer', rawPhone ? String(rawPhone).trim() : '', email, course || 'General Inquiry', status || 'Active', notes, hist], function() {
                    if (normPhone) phoneMap.set(normPhone, this.lastID);
                    if (email) emailMap.set(email, this.lastID);
                });
                imported++;
            }
        });

        stmtInsert.finalize();
        stmtUpdate.finalize();

        res.json({
            success: true,
            total: records.length,
            imported,
            skipped,
            updated
        });
    });
});

// ─── MANAGE SERVICES API ───
// --- Public / Admin: Get Services ---
app.get('/api/services', (req, res) => {
    const { all } = req.query;
    let sql = `SELECT * FROM services`;
    if (!all || all !== 'true') {
        sql += ` WHERE is_active = 1`;
    }
    sql += ` ORDER BY id ASC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, services: rows || [] });
    });
});

// --- Admin: Create Service ---
app.post('/api/admin/services', authenticateAdmin, (req, res) => {
    const { name, category, duration, fee, description, is_active } = req.body;
    if (!name) return res.status(400).json({ error: 'Service name is required' });
    db.run(
        `INSERT INTO services (name, category, duration, fee, description, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
        [name.trim(), category || 'CAD & Engineering', duration || '2 Months', fee || '₹15,000', description || '', is_active !== undefined ? is_active : 1],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to create service' });
            res.json({ success: true, service: { id: this.lastID, name, category, duration, fee, description, is_active } });
        }
    );
});

// --- Admin: Update Service ---
app.put('/api/admin/services/:id', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    const { name, category, duration, fee, description, is_active } = req.body;
    db.run(
        `UPDATE services SET name = COALESCE(?, name), category = COALESCE(?, category), duration = COALESCE(?, duration), fee = COALESCE(?, fee), description = COALESCE(?, description), is_active = COALESCE(?, is_active) WHERE id = ?`,
        [name, category, duration, fee, description, is_active, id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to update service' });
            res.json({ success: true, message: `Service #${id} updated` });
        }
    );
});

// --- Admin: Delete Service (Soft-delete to Recycle Bin for 30 days) ---
app.delete('/api/admin/services/:id', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM services WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Service not found' });

        const title = row.name || 'Service';
        const subtitle = `Category: ${row.category || ''} | Duration: ${row.duration || ''} | Fee: ${row.fee || ''}`;
        moveToRecycleBin('service', row.id, title, subtitle, row, req.admin?.name, (errRecycle, recycleId) => {
            if (errRecycle) return res.status(500).json({ error: 'Failed to move to recycle bin' });

            db.run(`DELETE FROM services WHERE id = ?`, [id], function(delErr) {
                if (delErr) return res.status(500).json({ error: 'Failed to delete service' });
                res.json({
                    success: true,
                    recycleId,
                    message: `Service "${row.name}" moved to Recycle Bin (Recoverable for 30 days)`
                });
            });
        });
    });
});

// ─── ADD HOLIDAYS API ───
// --- Public / Admin: Get Holidays ---
app.get('/api/holidays', (req, res) => {
    db.all(`SELECT * FROM holidays ORDER BY date ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, holidays: rows || [] });
    });
});

// --- Admin: Add Holiday ---
app.post('/api/admin/holidays', authenticateAdmin, (req, res) => {
    const { date, title, description } = req.body;
    if (!date || !title) return res.status(400).json({ error: 'Date and Title are required' });
    db.run(
        `INSERT INTO holidays (date, title, description) VALUES (?, ?, ?)`,
        [date, title.trim(), description || ''],
        function(err) {
            if (err) {
                if (err.message && err.message.includes('UNIQUE')) {
                    return res.status(409).json({ error: 'A holiday on this date is already registered' });
                }
                return res.status(500).json({ error: 'Failed to add holiday' });
            }
            res.json({ success: true, holiday: { id: this.lastID, date, title, description } });
        }
    );
});

// --- Admin: Delete Holiday (Soft-delete to Recycle Bin for 30 days) ---
app.delete('/api/admin/holidays/:id', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM holidays WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Holiday not found' });

        const title = row.title || 'Holiday';
        const subtitle = `Date: ${row.date} | ${row.description || ''}`;
        moveToRecycleBin('holiday', row.id, title, subtitle, row, req.admin?.name, (errRecycle, recycleId) => {
            if (errRecycle) return res.status(500).json({ error: 'Failed to move to recycle bin' });

            db.run(`DELETE FROM holidays WHERE id = ?`, [id], function(delErr) {
                if (delErr) return res.status(500).json({ error: 'Failed to delete holiday' });
                res.json({
                    success: true,
                    recycleId,
                    message: `Holiday "${row.title}" moved to Recycle Bin (Recoverable for 30 days)`
                });
            });
        });
    });
});

// ─── ADD ANNOUNCEMENTS API ───
// --- Public: Get Active Announcements ---
app.get('/api/announcements', (req, res) => {
    db.all(`SELECT * FROM announcements WHERE is_active = 1 ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, announcements: rows || [] });
    });
});

// --- Admin: Get All Announcements ---
app.get('/api/admin/announcements', authenticateAdmin, (req, res) => {
    db.all(`SELECT * FROM announcements ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, announcements: rows || [] });
    });
});

// --- Admin: Create Announcement ---
app.post('/api/admin/announcements', authenticateAdmin, (req, res) => {
    const { title, message, priority, badge, is_active, start_date, end_date } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and Message are required' });
    db.run(
        `INSERT INTO announcements (title, message, priority, badge, is_active, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title.trim(), message.trim(), priority || 'info', badge || 'Announcement', is_active !== undefined ? is_active : 1, start_date || '', end_date || ''],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to create announcement' });
            res.json({ success: true, announcement: { id: this.lastID, title, message, priority, badge, is_active } });
        }
    );
});

// --- Admin: Toggle / Update Announcement ---
app.patch('/api/admin/announcements/:id', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    const { is_active, priority, title, message, badge } = req.body;
    db.run(
        `UPDATE announcements SET is_active = COALESCE(?, is_active), priority = COALESCE(?, priority), title = COALESCE(?, title), message = COALESCE(?, message), badge = COALESCE(?, badge) WHERE id = ?`,
        [is_active, priority, title, message, badge, id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to update announcement' });
            res.json({ success: true, message: `Announcement #${id} updated` });
        }
    );
});

// --- Admin: Delete Announcement (Soft-delete to Recycle Bin for 30 days) ---
app.delete('/api/admin/announcements/:id', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM announcements WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Announcement not found' });

        const title = row.title || 'Announcement';
        const subtitle = `Priority: ${row.priority || 'info'} | Badge: ${row.badge || ''}`;
        moveToRecycleBin('announcement', row.id, title, subtitle, row, req.admin?.name, (errRecycle, recycleId) => {
            if (errRecycle) return res.status(500).json({ error: 'Failed to move to recycle bin' });

            db.run(`DELETE FROM announcements WHERE id = ?`, [id], function(delErr) {
                if (delErr) return res.status(500).json({ error: 'Failed to delete announcement' });
                res.json({
                    success: true,
                    recycleId,
                    message: `Announcement moved to Recycle Bin (Recoverable for 30 days)`
                });
            });
        });
    });
});

// ─── ADMIN: MANUAL APPOINTMENT CREATION ───
app.post('/api/admin/appointments', authenticateAdmin, (req, res) => {
    const { name, email, phone, program, branch, date, timeSlot, time_slot, mode, notes, status } = req.body;
    if (!name || !phone || !date) {
        return res.status(400).json({ error: 'Name, phone, and date are required' });
    }
    const cleanTime = timeSlot || time_slot || '10:00 AM';
    const bookingRef = 'CCC-' + Math.floor(100000 + Math.random() * 900000);
    db.run(
        `INSERT INTO appointments (booking_ref, user_id, name, email, phone, program, branch, date, time_slot, mode, notes, status, call_status, call_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Called', '')`,
        [bookingRef, 0, name.trim(), email || '', phone.trim(), program || 'CAD Program', branch || 'Satellite Campus', date, cleanTime, mode || 'In-Person', notes || '', status || 'Confirmed'],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to create appointment' });
            res.json({
                success: true,
                message: 'Appointment created successfully',
                appointment: { id: this.lastID, booking_ref: bookingRef, name, email, phone, program, branch, date, time_slot: cleanTime, mode, notes, status: status || 'Confirmed' }
            });
        }
    );
});

// ─── CALLER DASHBOARD API (INDIVIDUAL ACCOUNTS & SCOPED ACCESS) ───

// --- Caller: Individual Account Sign In (NO SHARED PIN) ---
const callerLoginHandler = async (req, res) => {
    const { email, password, pin } = req.body;

    // Reject deprecated shared PIN login attempt
    if (pin && !email) {
        return res.status(400).json({
            error: 'Shared PIN login has been disabled for security. Please sign in with your individual telecaller email and password.'
        });
    }

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Verify credentials via Firebase Authentication
    let firebaseSuccess = false;
    let firebaseUser = null;

    try {
        const fbRes = await firebaseAuthService.signInWithPassword(cleanEmail, password);
        if (fbRes && fbRes.localId) {
            firebaseSuccess = true;
            firebaseUser = fbRes;
        }
    } catch (fbErr) {
        // Fallback: Check if Admin credentials were submitted to access Caller Desk
        try {
            const envAdminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
            const envAdminPass = process.env.ADMIN_PASSWORD || process.env.admin_password || process.env.ADMIN_PASS || process.env.admin_pass;
            const isMatchAdmin = isAdminIdentifier(cleanEmail, envAdminEmail);
            const isValidPassword = verifyAdminPassword(password, envAdminPass);
            if (isMatchAdmin && isValidPassword) {
                const adminName = process.env.ADMIN_NAME || 'Cube Cad Admin';
                const adminPayload = { id: 1, name: adminName, email: envAdminEmail, isAdmin: true, isCaller: true, role: 'admin' };
                const token = jwt.sign(adminPayload, SECRET_KEY, { expiresIn: '12h' });
                return res.json({ success: true, token, caller: adminPayload, isAdmin: true });
            }
        } catch (e) {}

        // Fallback check against SQLite callers table if during transition
        const localCaller = await new Promise((resolve) => {
            db.get(`SELECT * FROM callers WHERE LOWER(email) = ?`, [cleanEmail], (err, row) => resolve(row));
        });
        if (localCaller && localCaller.password && localCaller.password === password) {
            firebaseSuccess = true;
            firebaseUser = { localId: localCaller.firebase_uid || '', email: localCaller.email };
        } else {
            return res.status(401).json({ error: 'Invalid caller credentials or account disabled' });
        }
    }

    // 2. Lookup caller account in database to enforce active status
    db.get(`SELECT * FROM callers WHERE LOWER(email) = ?`, [cleanEmail], async (err, caller) => {
        let activeCaller = caller;
        if (!activeCaller) {
            try {
                activeCaller = await firestoreService.findCallerByEmail(cleanEmail);
            } catch (fe) {}
        }

        if (!activeCaller) {
            return res.status(403).json({ error: 'Caller account not registered in system' });
        }

        // Deactivated caller check
        if (activeCaller.status && activeCaller.status.toLowerCase() === 'inactive') {
            return res.status(403).json({
                error: 'Your telecaller account has been deactivated by administrator. Access revoked.',
                deactivated: true
            });
        }

        // Link Firebase UID if missing
        if (!activeCaller.firebase_uid && firebaseUser && firebaseUser.localId) {
            db.run(`UPDATE callers SET firebase_uid = ? WHERE id = ?`, [firebaseUser.localId, activeCaller.id]);
            firestoreService.updateDocument('callers', String(activeCaller.id), { firebase_uid: firebaseUser.localId }).catch(() => {});
        }

        // Generate caller session token
        const callerPayload = {
            id: activeCaller.id,
            name: activeCaller.name,
            email: activeCaller.email,
            isCaller: true,
            role: 'caller',
            status: activeCaller.status || 'Active'
        };
        const token = jwt.sign(callerPayload, SECRET_KEY, { expiresIn: '12h' });

        // Audit Trail: Record Login Activity in Firestore & SQLite
        firestoreService.logActivity({
            caller_id: activeCaller.id,
            caller_name: activeCaller.name,
            caller_email: activeCaller.email,
            action: 'LOGIN',
            target_type: 'system',
            target_id: '0',
            target_name: 'Telecaller Desk',
            details: 'Caller signed in successfully'
        }).catch(() => {});

        db.run(
            `INSERT INTO caller_activity_logs (caller_id, caller_name, caller_email, action, target_type, target_id, target_name, details)
             VALUES (?, ?, ?, 'LOGIN', 'system', '0', 'Telecaller Desk', 'Caller signed in successfully')`,
            [activeCaller.id, activeCaller.name, activeCaller.email]
        );

        res.json({
            success: true,
            token,
            caller: callerPayload,
            firebaseToken: firebaseUser?.idToken || null
        });
    });
};
app.post('/api/caller/auth/login', callerLoginHandler);
app.post('/api/caller/login', callerLoginHandler);
app.post('/api/caller/signin', callerLoginHandler);

// --- Caller: Get ASSIGNED Appointments Only ---
app.get('/api/caller/appointments', authenticateCaller, (req, res) => {
    const { call_status, date, search, limit } = req.query;
    let sql = `SELECT id, booking_ref, name, phone, program, branch, date, time_slot, status, call_status, call_notes, last_called_at, assigned_caller_id, assigned_caller_name, created_at FROM appointments WHERE 1=1`;
    const params = [];

    // STRICT SCOPING: Callers can only view appointments assigned to them!
    if (!req.caller.isAdmin) {
        sql += ` AND assigned_caller_id = ?`;
        params.push(req.caller.id);
    }

    if (call_status && call_status !== 'all') {
        sql += ` AND LOWER(COALESCE(call_status, 'not called')) = ?`;
        params.push(call_status.toLowerCase());
    }
    if (date) {
        sql += ` AND date = ?`;
        params.push(date);
    }
    if (search) {
        sql += ` AND (name LIKE ? OR phone LIKE ? OR booking_ref LIKE ? OR program LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s);
    }

    sql += ` ORDER BY date DESC, time_slot ASC, id DESC`;
    if (limit) {
        sql += ` LIMIT ?`;
        params.push(parseInt(limit));
    }

    db.all(sql, params, async (err, rows) => {
        if (!err && rows && rows.length > 0) {
            const sanitized = rows.map(r => ({
                ...r,
                call_status: r.call_status || 'Not Called',
                call_notes: r.call_notes || '',
                assigned_caller_id: r.assigned_caller_id || 0,
                assigned_caller_name: r.assigned_caller_name || 'Unassigned'
            }));
            return res.json({ success: true, appointments: sanitized });
        }
        // Fallback: Query Cloud Firestore bookings when in serverless / without SQLite
        try {
            const allDocs = await firestoreService.listDocuments('bookings');
            if (allDocs && allDocs.length > 0) {
                let filtered = allDocs;
                if (!req.caller.isAdmin) {
                    filtered = filtered.filter(b => String(b.assigned_caller_id) === String(req.caller.id));
                }
                if (call_status && call_status !== 'all') {
                    filtered = filtered.filter(b => (b.call_status || 'not called').toLowerCase() === call_status.toLowerCase());
                }
                if (date) {
                    filtered = filtered.filter(b => b.date === date);
                }
                return res.json({ success: true, appointments: filtered });
            }
        } catch (fe) {}
        res.json({ success: true, appointments: [] });
    });
});

// --- Caller: Get Single Appointment (Ownership & Assignment Check) ---
app.get('/api/caller/appointments/:id', authenticateCaller, (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM appointments WHERE id = ?`, [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Appointment not found' });
        if (!req.caller.isAdmin && row.assigned_caller_id !== req.caller.id) {
            return res.status(403).json({ error: 'Access denied: You are not authorized to access this appointment' });
        }
        res.json({ success: true, appointment: row });
    });
});

// --- Caller: Update Call Log & Remarks (Ownership & Assignment Check + Audit) ---
app.patch('/api/caller/appointments/:id/call-log', authenticateCaller, (req, res) => {
    const id = req.params.id;
    const { call_status, call_notes, follow_up } = req.body;
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    db.get(`SELECT * FROM appointments WHERE id = ?`, [id], (fetchErr, row) => {
        if (fetchErr || !row) return res.status(404).json({ error: 'Appointment not found' });

        // STRICT SCOPING: Only assigned caller or admin can modify!
        if (!req.caller.isAdmin && row.assigned_caller_id !== req.caller.id) {
            return res.status(403).json({ error: 'Access denied: You are not authorized to update this appointment' });
        }

        db.run(
            `UPDATE appointments SET call_status = COALESCE(?, call_status), call_notes = COALESCE(?, call_notes), last_called_at = ? WHERE id = ?`,
            [call_status, call_notes, now, id],
            function(err) {
                if (err) return res.status(500).json({ error: 'Failed to update call log' });

                // Sync Call Log to Cloud Firestore
                firestoreService.updateDocument('bookings', String(id), {
                    call_status: call_status || row.call_status,
                    call_notes: call_notes || '',
                    last_called_at: now
                }).catch(() => {});

                const actionDetails = JSON.stringify({
                    call_status: call_status || row.call_status,
                    call_notes: call_notes || '',
                    follow_up: follow_up || null,
                    appointment_date: row.date,
                    booking_ref: row.booking_ref
                });

                // Audit Trail: Record Call Log Activity in Cloud Firestore & SQLite
                firestoreService.logActivity({
                    caller_id: req.caller.id,
                    caller_name: req.caller.name,
                    caller_email: req.caller.email || '',
                    action: 'CALL_LOG',
                    target_type: 'appointment',
                    target_id: String(id),
                    target_name: row.name,
                    details: actionDetails
                }).catch(() => {});

                db.run(
                    `INSERT INTO caller_activity_logs (caller_id, caller_name, caller_email, action, target_type, target_id, target_name, details)
                     VALUES (?, ?, ?, 'CALL_LOG', 'appointment', ?, ?, ?)`,
                    [req.caller.id, req.caller.name, req.caller.email || '', String(id), row.name, actionDetails]
                );

                res.json({
                    success: true,
                    message: 'Call log updated successfully',
                    log: { id, call_status: call_status || row.call_status, call_notes, last_called_at: now }
                });
            }
        );
    });
});

// --- Caller: Get ASSIGNED Customers Only ---
app.get('/api/caller/customers', authenticateCaller, (req, res) => {
    let sql = `SELECT * FROM customers WHERE 1=1`;
    const params = [];

    // STRICT SCOPING: Callers can only view customers assigned to them!
    if (!req.caller.isAdmin) {
        sql += ` AND assigned_caller_id = ?`;
        params.push(req.caller.id);
    }
    sql += ` ORDER BY id DESC`;

    db.all(sql, params, async (err, rows) => {
        if (!err && rows && rows.length > 0) {
            const list = rows.map(r => ({
                ...r,
                notes_history: r.notes_history ? (typeof r.notes_history === 'string' ? JSON.parse(r.notes_history || '[]') : r.notes_history) : [],
                call_logs: r.call_logs ? (typeof r.call_logs === 'string' ? JSON.parse(r.call_logs || '[]') : r.call_logs) : []
            }));
            return res.json({ success: true, customers: list });
        }
        // Fallback: Query Cloud Firestore customers when in serverless / without SQLite
        try {
            const allDocs = await firestoreService.listDocuments('customers');
            if (allDocs && allDocs.length > 0) {
                let filtered = allDocs;
                if (!req.caller.isAdmin) {
                    filtered = filtered.filter(c => String(c.assigned_caller_id) === String(req.caller.id));
                }
                return res.json({ success: true, customers: filtered });
            }
        } catch (fe) {}
        res.json({ success: true, customers: [] });
    });
});

// --- Caller: Get Single Customer (Ownership & Assignment Check) ---
app.get('/api/caller/customers/:id', authenticateCaller, (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM customers WHERE id = ?`, [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Customer not found' });
        if (!req.caller.isAdmin && row.assigned_caller_id !== req.caller.id) {
            return res.status(403).json({ error: 'Access denied: You are not authorized to view this customer' });
        }
        res.json({ success: true, customer: row });
    });
});

// --- Caller: Update Customer Status & Call (Ownership & Assignment Check + Audit) ---
app.patch('/api/caller/customers/:id', authenticateCaller, (req, res) => {
    const id = req.params.id;
    const { status, last_call_status, notes, follow_up } = req.body;
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    db.get(`SELECT * FROM customers WHERE id = ?`, [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Customer not found' });
        if (!req.caller.isAdmin && row.assigned_caller_id !== req.caller.id) {
            return res.status(403).json({ error: 'Access denied: You are not authorized to modify this customer' });
        }

        db.run(
            `UPDATE customers SET status = COALESCE(?, status), last_call_status = COALESCE(?, last_call_status), last_called_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, last_call_status, now, id],
            function(upErr) {
                if (upErr) return res.status(500).json({ error: 'Failed to update customer' });

                // Audit Trail: Record Status Change
                const details = JSON.stringify({
                    status: status || row.status,
                    last_call_status: last_call_status || row.last_call_status,
                    notes: notes || '',
                    follow_up: follow_up || null
                });
                db.run(
                    `INSERT INTO caller_activity_logs (caller_id, caller_name, caller_email, action, target_type, target_id, target_name, details)
                     VALUES (?, ?, ?, 'STATUS_CHANGE', 'customer', ?, ?, ?)`,
                    [req.caller.id, req.caller.name, req.caller.email || '', String(id), row.name, details]
                );

                res.json({ success: true, message: 'Customer updated successfully' });
            }
        );
    });
});

// --- Caller: Add Note to Customer (Ownership & Assignment Check + Audit) ---
app.post('/api/caller/customers/:id/note', authenticateCaller, (req, res) => {
    const id = req.params.id;
    const { note, follow_up } = req.body;
    if (!note) return res.status(400).json({ error: 'Note text is required' });

    db.get(`SELECT * FROM customers WHERE id = ?`, [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Customer not found' });
        if (!req.caller.isAdmin && row.assigned_caller_id !== req.caller.id) {
            return res.status(403).json({ error: 'Access denied: You are not authorized to modify this customer' });
        }

        let history = [];
        try { history = JSON.parse(row.notes_history || '[]'); } catch (e) {}
        const nowIso = new Date().toISOString();
        const newEntry = { text: note, created_at: nowIso, author: req.caller.name || 'Telecaller' };
        history.unshift(newEntry);

        db.run(
            `UPDATE customers SET notes = ?, notes_history = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [note, JSON.stringify(history), id],
            function(upErr) {
                if (upErr) return res.status(500).json({ error: 'Failed to save note' });

                const details = JSON.stringify({ note, follow_up: follow_up || null });

                // Sync Note to Cloud Firestore
                firestoreService.updateDocument('customers', String(id), {
                    notes: note,
                    notes_history: history,
                    updated_at: nowIso
                }).catch(() => {});

                // Audit Trail: Record Note Activity in Cloud Firestore & SQLite
                firestoreService.logActivity({
                    caller_id: req.caller.id,
                    caller_name: req.caller.name,
                    caller_email: req.caller.email || '',
                    action: 'NOTE_ADDED',
                    target_type: 'customer',
                    target_id: String(id),
                    target_name: row.name,
                    details
                }).catch(() => {});

                db.run(
                    `INSERT INTO caller_activity_logs (caller_id, caller_name, caller_email, action, target_type, target_id, target_name, details)
                     VALUES (?, ?, ?, 'NOTE_ADDED', 'customer', ?, ?, ?)`,
                    [req.caller.id, req.caller.name, req.caller.email || '', String(id), row.name, details]
                );

                res.json({ success: true, notes_history: history });
            }
        );
    });
});

// --- Caller: Record Activity Event (View, Call Started, Follow-up Set) ---
app.post('/api/caller/activity', authenticateCaller, (req, res) => {
    const { action, target_type, target_id, target_name, details } = req.body;
    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details || {});

    db.run(
        `INSERT INTO caller_activity_logs (caller_id, caller_name, caller_email, action, target_type, target_id, target_name, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.caller.id, req.caller.name, req.caller.email || '', action || 'EVENT', target_type || 'lead', String(target_id || 0), target_name || '', detailsStr],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to log activity' });
            res.json({ success: true, activityId: this.lastID });
        }
    );
});

// --- Caller: Get Call Summary Metrics (Scoped to assigned items) ---
app.get('/api/caller/stats', authenticateCaller, (req, res) => {
    const stats = {};
    const today = new Date().toISOString().split('T')[0];
    const isAdm = req.caller.isAdmin;
    const callerId = req.caller.id;

    const baseWhere = isAdm ? ' WHERE 1=1' : ` WHERE assigned_caller_id = ${callerId}`;

    db.get(`SELECT COUNT(*) as total FROM appointments ${baseWhere}`, (err, r1) => {
        stats.total = r1 ? r1.total : 0;
        db.get(`SELECT COUNT(*) as count FROM appointments ${baseWhere} AND LOWER(COALESCE(call_status, 'not called')) = 'not called'`, (err, r2) => {
            stats.notCalled = r2 ? r2.count : 0;
            db.get(`SELECT COUNT(*) as count FROM appointments ${baseWhere} AND LOWER(COALESCE(call_status, '')) = 'connected'`, (err, r3) => {
                stats.connected = r3 ? r3.count : 0;
                db.get(`SELECT COUNT(*) as count FROM appointments ${baseWhere} AND LOWER(COALESCE(call_status, '')) = 'interested'`, (err, r4) => {
                    stats.interested = r4 ? r4.count : 0;
                    db.get(`SELECT COUNT(*) as count FROM appointments ${baseWhere} AND LOWER(COALESCE(call_status, '')) = 'callback'`, (err, r5) => {
                        stats.callback = r5 ? r5.count : 0;
                        db.get(`SELECT COUNT(*) as count FROM appointments ${baseWhere} AND date = ?`, [today], (err, r6) => {
                            stats.todayAppointments = r6 ? r6.count : 0;
                            res.json({ success: true, stats });
                        });
                    });
                });
            });
        });
    });
});

// ─── ADMIN: TELECALLER MANAGEMENT & AUDIT API ───

// --- Admin: List All Callers (NO PASSWORDS EXPOSED) ---
app.get('/api/admin/callers', authenticateAdmin, (req, res) => {
    const sql = `
        SELECT c.id, c.firebase_uid, c.name, c.email, c.status, c.created_at, c.updated_at,
               (SELECT COUNT(*) FROM appointments a WHERE a.assigned_caller_id = c.id) as assigned_appointments,
               (SELECT COUNT(*) FROM customers cu WHERE cu.assigned_caller_id = c.id) as assigned_customers
        FROM callers c
        ORDER BY c.id DESC
    `;
    db.all(sql, [], async (err, rows) => {
        if (!err && rows && rows.length > 0) {
            return res.json({ success: true, callers: rows });
        }
        // Fallback: Query Cloud Firestore callers when in serverless / without SQLite
        try {
            const allDocs = await firestoreService.listDocuments('callers');
            if (allDocs && allDocs.length > 0) {
                const sanitized = allDocs.map(c => ({
                    id: c.id,
                    firebase_uid: c.firebase_uid || '',
                    name: c.name || 'Caller',
                    email: c.email || '',
                    status: c.status || 'Active',
                    created_at: c.created_at || '',
                    updated_at: c.updated_at || '',
                    assigned_appointments: 0,
                    assigned_customers: 0
                }));
                return res.json({ success: true, callers: sanitized });
            }
        } catch (fe) {}
        res.json({ success: true, callers: [] });
    });
});

// --- Admin: Create New Caller Account (Firebase Auth + SQLite, No Passwords Stored in DB) ---
app.post('/api/admin/callers', authenticateAdmin, async (req, res) => {
    const { name, email, password, status } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and temporary password are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const callerStatus = status === 'Inactive' ? 'Inactive' : 'Active';

    // Check if caller already exists in SQLite
    db.get(`SELECT id FROM callers WHERE LOWER(email) = ?`, [cleanEmail], async (existErr, existing) => {
        if (existing) {
            return res.status(409).json({ error: 'A caller with this email address already exists' });
        }

        // 1. Provision account in Firebase Authentication
        let firebaseUid = '';
        try {
            const fbRes = await firebaseAuthService.signUp(cleanEmail, password, cleanName);
            firebaseUid = fbRes.localId || '';
        } catch (fbErr) {
            if (fbErr.message && fbErr.message.includes('EMAIL_EXISTS')) {
                // If user exists in Firebase Auth, verify and link
                try {
                    const check = await firebaseAuthService.signInWithPassword(cleanEmail, password);
                    firebaseUid = check.localId || '';
                } catch (se) {
                    return res.status(409).json({ error: 'Account already exists in Firebase. Please reset the password or use another email.' });
                }
            } else {
                return res.status(500).json({ error: 'Firebase Auth provision failed: ' + fbErr.message });
            }
        }

        // 2. Insert into SQLite without storing password
        db.run(
            `INSERT INTO callers (name, email, password, firebase_uid, status, role) VALUES (?, ?, '', ?, ?, 'caller')`,
            [cleanName, cleanEmail, firebaseUid, callerStatus],
            function(dbErr) {
                if (dbErr) return res.status(500).json({ error: 'Failed to save caller to database' });

                const newId = this ? this.lastID : Date.now();

                // Sync to Cloud Firestore for permanent production persistence
                firestoreService.setDocument('callers', String(newId), {
                    id: newId,
                    name: cleanName,
                    email: cleanEmail,
                    status: callerStatus,
                    role: 'caller',
                    firebase_uid: firebaseUid,
                    created_at: new Date().toISOString()
                }).catch(e => console.warn('Firestore caller sync note:', e.message));

                // Audit Log: Caller Creation
                db.run(
                    `INSERT INTO caller_activity_logs (caller_id, caller_name, caller_email, action, target_type, target_id, target_name, details)
                     VALUES (?, ?, ?, 'CALLER_CREATED', 'caller', ?, ?, ?)`,
                    [newId, cleanName, cleanEmail, String(newId), cleanName, `Created by Admin: ${req.admin.name || 'Admin'} with status ${callerStatus}`]
                );

                res.json({
                    success: true,
                    message: 'Caller created successfully in Firebase Authentication',
                    caller: { id: newId, name: cleanName, email: cleanEmail, status: callerStatus, firebase_uid: firebaseUid }
                });
            }
        );
    });
});

// --- Admin: Toggle Caller Status (Active / Inactive - Real-time Access Block) ---
app.patch('/api/admin/callers/:id/status', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    if (!status || !['Active', 'Inactive'].includes(status)) {
        return res.status(400).json({ error: 'Valid status is required (Active or Inactive)' });
    }

    db.get(`SELECT * FROM callers WHERE id = ?`, [id], (err, caller) => {
        if (err || !caller) return res.status(404).json({ error: 'Caller not found' });

        db.run(
            `UPDATE callers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, id],
            function(upErr) {
                if (upErr) return res.status(500).json({ error: 'Failed to update caller status' });

                // Sync status change to Cloud Firestore for permanent production persistence
                firestoreService.updateDocument('callers', String(id), {
                    status,
                    updated_at: new Date().toISOString()
                }).catch(e => console.warn('Firestore caller status note:', e.message));

                // Audit Log: Status Change
                db.run(
                    `INSERT INTO caller_activity_logs (caller_id, caller_name, caller_email, action, target_type, target_id, target_name, details)
                     VALUES (?, ?, ?, 'STATUS_CHANGED', 'caller', ?, ?, ?)`,
                    [caller.id, caller.name, caller.email, String(id), caller.name, `Status set to ${status} by Admin: ${req.admin.name || 'Admin'}`]
                );

                res.json({
                    success: true,
                    message: `Caller account status set to ${status}. ${status === 'Inactive' ? 'Access has been immediately revoked.' : 'Access restored.'}`,
                    status
                });
            }
        );
    });
});

// --- Admin: Reset Caller Password in Firebase Auth (No password stored in SQLite) ---
app.post('/api/admin/callers/:id/reset-password', authenticateAdmin, async (req, res) => {
    const id = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    db.get(`SELECT * FROM callers WHERE id = ?`, [id], async (err, caller) => {
        if (err || !caller) return res.status(404).json({ error: 'Caller not found' });

        try {
            await firebaseAuthService.resetCallerPassword(caller.email, newPassword);

            // Audit Log (NO PASSWORD STORED OR LOGGED)
            db.run(
                `INSERT INTO caller_activity_logs (caller_id, caller_name, caller_email, action, target_type, target_id, target_name, details)
                 VALUES (?, ?, ?, 'PASSWORD_RESET', 'caller', ?, ?, ?)`,
                [caller.id, caller.name, caller.email, String(id), caller.name, `Password reset performed by Admin: ${req.admin.name || 'Admin'}`]
            );

            res.json({
                success: true,
                message: `Password for "${caller.name}" has been updated in Firebase Authentication.`
            });
        } catch (resetErr) {
            return res.status(500).json({ error: 'Failed to reset password: ' + resetErr.message });
        }
    });
});

// --- Admin: Delete Caller Account ---
app.delete('/api/admin/callers/:id', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM callers WHERE id = ?`, [id], (err, caller) => {
        if (err || !caller) return res.status(404).json({ error: 'Caller not found' });

        // Unassign any appointments or customers assigned to this caller
        db.run(`UPDATE appointments SET assigned_caller_id = 0, assigned_caller_name = 'Unassigned' WHERE assigned_caller_id = ?`, [id]);
        db.run(`UPDATE customers SET assigned_caller_id = 0, assigned_caller_name = 'Unassigned' WHERE assigned_caller_id = ?`, [id]);

        db.run(`DELETE FROM callers WHERE id = ?`, [id], function(delErr) {
            if (delErr) return res.status(500).json({ error: 'Failed to delete caller' });

            // Sync caller deletion to Cloud Firestore
            firestoreService.deleteDocument('callers', String(id))
                .catch(e => console.warn('Firestore caller delete note:', e.message));

            // Audit Log
            db.run(
                `INSERT INTO caller_activity_logs (caller_id, caller_name, caller_email, action, target_type, target_id, target_name, details)
                 VALUES (?, ?, ?, 'CALLER_DELETED', 'caller', ?, ?, ?)`,
                [caller.id, caller.name, caller.email, String(id), caller.name, `Caller deleted by Admin: ${req.admin.name || 'Admin'}`]
            );

            res.json({
                success: true,
                message: `Caller "${caller.name}" removed successfully and assigned leads unassigned.`
            });
        });
    });
});

// --- Admin: Assign Lead / Appointment / Customer to Caller ---
app.post('/api/admin/assign', authenticateAdmin, (req, res) => {
    const { type, id, caller_id } = req.body;
    if (!type || !id) {
        return res.status(400).json({ error: 'Type (appointment or customer) and ID are required' });
    }

    const cid = parseInt(caller_id) || 0;

    const performAssign = (targetCallerId, targetCallerName) => {
        const table = type === 'customer' ? 'customers' : 'appointments';
        const col = type === 'customer' ? 'customers' : 'bookings';

        // Sync assignment to Cloud Firestore
        firestoreService.updateDocument(col, String(id), {
            assigned_caller_id: targetCallerId,
            assigned_caller_name: targetCallerName
        }).catch(() => {});

        // Audit Trail: Record Assignment Activity in Cloud Firestore & SQLite
        firestoreService.logActivity({
            caller_id: targetCallerId,
            caller_name: targetCallerName,
            caller_email: '',
            action: 'LEAD_ASSIGNED',
            target_type: type,
            target_id: String(id),
            target_name: '',
            details: `Assigned to ${targetCallerName} by Admin: ${req.admin.name || 'Admin'}`
        }).catch(() => {});

        db.run(
            `UPDATE ${table} SET assigned_caller_id = ?, assigned_caller_name = ? WHERE id = ?`,
            [targetCallerId, targetCallerName, id],
            function(err) {
                if (err) return res.status(500).json({ error: 'Failed to assign' });

                // Audit Log
                db.run(
                    `INSERT INTO caller_activity_logs (caller_id, caller_name, caller_email, action, target_type, target_id, target_name, details)
                     VALUES (?, ?, ?, 'LEAD_ASSIGNED', ?, ?, '', ?)`,
                    [targetCallerId, targetCallerName, '', type, String(id), `Assigned to ${targetCallerName} by Admin: ${req.admin.name || 'Admin'}`]
                );

                res.json({
                    success: true,
                    message: `${type === 'customer' ? 'Customer' : 'Appointment'} #${id} assigned to ${targetCallerName}`,
                    assigned_caller_id: targetCallerId,
                    assigned_caller_name: targetCallerName
                });
            }
        );
    };

    if (cid === 0) {
        performAssign(0, 'Unassigned');
    } else {
        db.get(`SELECT id, name FROM callers WHERE id = ?`, [cid], (err, caller) => {
            if (err || !caller) return res.status(404).json({ error: 'Assigned caller not found' });
            performAssign(caller.id, caller.name);
        });
    }
});

// --- Admin: Bulk Assign Leads to Caller ---
app.post('/api/admin/assign-bulk', authenticateAdmin, (req, res) => {
    const { type, ids, caller_id } = req.body;
    if (!type || !ids || !Array.isArray(ids) || !ids.length) {
        return res.status(400).json({ error: 'Type and array of IDs required' });
    }

    const cid = parseInt(caller_id) || 0;
    const table = type === 'customer' ? 'customers' : 'appointments';

    const performBulk = (targetCallerId, targetCallerName) => {
        const placeholders = ids.map(() => '?').join(',');
        const params = [targetCallerId, targetCallerName, ...ids];
        db.run(
            `UPDATE ${table} SET assigned_caller_id = ?, assigned_caller_name = ? WHERE id IN (${placeholders})`,
            params,
            function(err) {
                if (err) return res.status(500).json({ error: 'Bulk assignment failed' });

                res.json({
                    success: true,
                    count: this.changes,
                    message: `${this.changes} ${type} records assigned to ${targetCallerName}`
                });
            }
        );
    };

    if (cid === 0) {
        performBulk(0, 'Unassigned');
    } else {
        db.get(`SELECT id, name FROM callers WHERE id = ?`, [cid], (err, caller) => {
            if (err || !caller) return res.status(404).json({ error: 'Assigned caller not found' });
            performBulk(caller.id, caller.name);
        });
    }
});

// --- Admin: Get Caller Activity Audit Logs ---
app.get('/api/admin/caller-activities', authenticateAdmin, (req, res) => {
    const { caller_id, action, limit } = req.query;
    let sql = `SELECT * FROM caller_activity_logs WHERE 1=1`;
    const params = [];

    if (caller_id) {
        sql += ` AND caller_id = ?`;
        params.push(caller_id);
    }
    if (action) {
        sql += ` AND action = ?`;
        params.push(action);
    }
    sql += ` ORDER BY id DESC LIMIT ?`;
    params.push(parseInt(limit) || 150);

    db.all(sql, params, async (err, rows) => {
        if (!err && rows && rows.length > 0) {
            return res.json({ success: true, activities: rows });
        }
        // Fallback: Query Cloud Firestore caller activities when in serverless / without SQLite
        try {
            const allDocs = await firestoreService.listDocuments('caller_activities');
            if (allDocs && allDocs.length > 0) {
                let filtered = allDocs;
                if (caller_id) {
                    filtered = filtered.filter(a => String(a.caller_id) === String(caller_id));
                }
                if (action) {
                    filtered = filtered.filter(a => (a.action || '').toUpperCase() === action.toUpperCase());
                }
                return res.json({ success: true, activities: filtered });
            }
        } catch (fe) {}
        res.json({ success: true, activities: [] });
    });
});

// 404 Catch-All for undefined routes (serves 404 page for HTML or 404 status)
app.use((req, res) => {
    const notFoundPath = path.join(__dirname, 'public', '404.html');
    if (req.accepts('html') && fs.existsSync(notFoundPath)) {
        return res.status(404).sendFile(notFoundPath);
    }
    res.status(404).send('Not Found');
});

// Start the server (Export for Vercel Serverless Function & Start listener if run directly)
module.exports = app;

if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

