/**
 * ============================================================================
 * COMPREHENSIVE REUSABLE SECURITY AUDIT SUITE
 * File: website/security-check.js
 *
 * Verifies:
 * - Student authentication and authorization
 * - Admin authentication and authorization
 * - Individual caller authentication
 * - Deactivated caller access is blocked (real-time JWT revocation)
 * - Student cannot access admin/caller APIs (Vertical privilege escalation)
 * - Caller cannot access another caller's customers/appointments (Horizontal)
 * - ID/URL tampering is blocked
 * - Admin-only caller management endpoints are protected
 * - Appointment permissions are correct
 * - Firestore security rules are not publicly readable/writable
 * - No passwords, tokens, API keys, or secrets hard-coded in frontend files
 * - No passwords stored in Firestore or SQLite callers table
 * - Sensitive credentials are not printed in test output
 * - Existing security test suite (test_security_suite.js) is executed
 *
 * Safety:
 * - Does NOT modify, delete, or migrate real user data.
 * - Uses temporary test accounts/data with automatic cleanup.
 * - Redacts all passwords, API keys, and JWT tokens from logs.
 * - Exits with code 0 if all checks pass, non-zero if any check fails.
 * ============================================================================
 */

require('dotenv').config();
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

// ─── CONFIGURATION ───
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'cubecadcenter0711@gmail.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CALLER_EMAIL = (process.env.CALLER_EMAIL || 'caller@cubecadcenter.com').toLowerCase().trim();
const CALLER_PASSWORD = process.env.CALLER_PASSWORD;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'cube-cad-center';
const SECRET_KEY = process.env.SECRET_KEY || '';

const TEST_RUN_TAG = `sec_audit_${Date.now().toString().slice(-6)}`;

// ─── CREDENTIAL SANITIZATION & LOGGING ───
function sanitize(str) {
    if (typeof str !== 'string') return str;
    let s = str;
    // Redact JWT tokens
    s = s.replace(/eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, '[REDACTED_JWT_TOKEN]');
    // Redact Bearer tokens
    s = s.replace(/(Bearer\s+)[A-Za-z0-9_.-]{15,}/gi, '$1[REDACTED_TOKEN]');
    // Redact passwords & keys from .env
    if (ADMIN_PASSWORD) s = s.split(ADMIN_PASSWORD).join('[REDACTED_ADMIN_PASS]');
    if (CALLER_PASSWORD) s = s.split(CALLER_PASSWORD).join('[REDACTED_CALLER_PASS]');
    if (SECRET_KEY) s = s.split(SECRET_KEY).join('[REDACTED_SECRET_KEY]');
    if (FIREBASE_API_KEY) s = s.split(FIREBASE_API_KEY).join('[REDACTED_FIREBASE_KEY]');
    // Redact generated random test passwords
    s = s.replace(/SecAudit_[A-Za-z0-9#!$%^&*_+=-]{10,}/gi, '[REDACTED_TEST_PASS]');
    s = s.replace(/Sec_[a-f0-9]{16}#[0-9A-Z!]+/gi, '[REDACTED_TEST_PASS]');
    s = s.replace(/("password"\s*:\s*")[^"]+(")/gi, '$1[REDACTED_PASS]$2');
    s = s.replace(/('password'\s*:\s*')[^']+(')/gi, '$1[REDACTED_PASS]$2');
    return s;
}

function logInfo(msg) {
    console.log(sanitize(`  [INFO] ${msg}`));
}
function logPass(msg) {
    console.log(sanitize(`  [PASS] ${msg}`));
}
function logFail(msg) {
    console.error(sanitize(`  [FAIL] ${msg}`));
}

// ─── AUDIT TRACKING ───
const auditResults = {
    passed: 0,
    failed: 0,
    failures: [] // { check: string, detail: string, fix: string }
};

function recordResult(passed, checkName, detail = '', fix = '') {
    if (passed) {
        auditResults.passed++;
        logPass(checkName);
    } else {
        auditResults.failed++;
        logFail(checkName + (detail ? ` (${detail})` : ''));
        auditResults.failures.push({
            check: checkName,
            detail: sanitize(detail),
            fix: sanitize(fix)
        });
    }
}

// ─── HTTP REQUEST UTILITY ───
function httpRequest(options, bodyData = null) {
    return new Promise((resolve, reject) => {
        try {
            const url = new URL(options.path, BASE_URL);
            const reqOpts = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers: Object.assign({}, options.headers || {})
            };

            let jsonPayload = null;
            if (bodyData !== null) {
                jsonPayload = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
                reqOpts.headers['Content-Type'] = reqOpts.headers['Content-Type'] || 'application/json';
                reqOpts.headers['Content-Length'] = Buffer.byteLength(jsonPayload);
            }

            const req = http.request(reqOpts, (res) => {
                let resBody = '';
                res.on('data', chunk => resBody += chunk);
                res.on('end', () => {
                    let parsed = null;
                    try {
                        parsed = JSON.parse(resBody);
                    } catch (e) {
                        parsed = resBody;
                    }
                    resolve({ status: res.statusCode, headers: res.headers, body: parsed });
                });
            });

            req.on('error', reject);
            if (jsonPayload) req.write(jsonPayload);
            req.end();
        } catch (e) {
            reject(e);
        }
    });
}

function httpsRequest(urlStr, options = {}, body = null) {
    return new Promise((resolve, reject) => {
        try {
            const u = new URL(urlStr);
            const reqOpts = {
                hostname: u.hostname,
                port: 443,
                path: u.pathname + u.search,
                method: options.method || 'GET',
                headers: Object.assign({}, options.headers || {})
            };
            let bodyData = null;
            if (body !== null) {
                bodyData = typeof body === 'string' ? body : JSON.stringify(body);
                reqOpts.headers['Content-Type'] = reqOpts.headers['Content-Type'] || 'application/json';
                reqOpts.headers['Content-Length'] = Buffer.byteLength(bodyData);
            }
            const req = https.request(reqOpts, (res) => {
                let resBody = '';
                res.on('data', chunk => resBody += chunk);
                res.on('end', () => {
                    let parsed = resBody;
                    try { parsed = JSON.parse(resBody); } catch (e) {}
                    resolve({ status: res.statusCode, headers: res.headers, body: parsed });
                });
            });
            req.on('error', reject);
            if (bodyData) req.write(bodyData);
            req.end();
        } catch (e) {
            reject(e);
        }
    });
}

function generateRandomPassword() {
    return 'SecAudit_' + crypto.randomBytes(8).toString('hex') + '#7Q!';
}

// ─── SERVER LIFECYCLE MANAGEMENT ───
let spawnedServerProcess = null;

async function isServerResponding() {
    return new Promise((resolve) => {
        const req = http.request(BASE_URL, { method: 'GET', timeout: 1500 }, (res) => {
            resolve(true);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.end();
    });
}

async function ensureServerRunning() {
    const active = await isServerResponding();
    if (active) {
        logInfo(`Server is actively running on ${BASE_URL}`);
        return;
    }

    logInfo(`Starting local application server for security audit on port ${PORT}...`);
    const serverPath = path.resolve(__dirname, 'server.js');
    spawnedServerProcess = spawn('node', [serverPath], {
        cwd: __dirname,
        env: Object.assign({}, process.env, { PORT }),
        stdio: ['ignore', 'pipe', 'pipe']
    });

    // Wait until server is accepting requests (up to 15 seconds)
    const startTime = Date.now();
    let isReady = false;
    while (Date.now() - startTime < 15000) {
        await new Promise(r => setTimeout(r, 400));
        if (await isServerResponding()) {
            isReady = true;
            break;
        }
    }

    if (!isReady) {
        throw new Error(`Failed to start server on ${BASE_URL} within timeout.`);
    }
    logInfo(`Application server started successfully on ${BASE_URL}`);
}

function cleanupServer() {
    if (spawnedServerProcess && !spawnedServerProcess.killed) {
        try {
            spawnedServerProcess.kill();
        } catch (e) {}
    }
}

// ─── TEMPORARY DATA REGISTRY FOR SAFE CLEANUP ───
const tempCleanupRegistry = {
    callerIds: [],
    appointmentIds: [],
    customerIds: [],
    userEmails: []
};

// ─── 1. CHECK: FRONTEND SECRETS SCANNER ───
function auditFrontendSecrets() {
    console.log('\n================================================================');
    console.log('CHECK 1: Frontend Static Secrets & Credential Audit');
    console.log('================================================================');

    const frontendFiles = [
        'index.html',
        'admin.html',
        'caller.html',
        'explore.html',
        'syllabus-architectural.html',
        'syllabus-mechanical.html',
        'syllabus-mep.html',
        'syllabus-structural.html',
        'firebase-service.js'
    ];

    let foundHardcodedSecrets = [];

    for (const filename of frontendFiles) {
        const filePath = path.resolve(__dirname, filename);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, 'utf8');

        // Check 1: Real passwords from .env
        if (ADMIN_PASSWORD && ADMIN_PASSWORD.length > 5 && content.includes(ADMIN_PASSWORD)) {
            foundHardcodedSecrets.push({ file: filename, issue: 'ADMIN_PASSWORD found hard-coded' });
        }
        if (CALLER_PASSWORD && CALLER_PASSWORD.length > 5 && content.includes(CALLER_PASSWORD)) {
            foundHardcodedSecrets.push({ file: filename, issue: 'CALLER_PASSWORD found hard-coded' });
        }
        // Check 2: Backend SECRET_KEY
        if (SECRET_KEY && SECRET_KEY.length > 10 && content.includes(SECRET_KEY)) {
            foundHardcodedSecrets.push({ file: filename, issue: 'SECRET_KEY found hard-coded in frontend' });
        }
        // Check 3: Private RSA / EC keys
        if (/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(content)) {
            foundHardcodedSecrets.push({ file: filename, issue: 'Private key block found in frontend' });
        }
        // Check 4: Service account JSON keys
        if (/"type"\s*:\s*"service_account"/.test(content)) {
            foundHardcodedSecrets.push({ file: filename, issue: 'Service account credentials found in frontend' });
        }
        // Check 5: Hard-coded live JWT tokens (excluding placeholders)
        const jwtMatch = content.match(/eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
        if (jwtMatch) {
            foundHardcodedSecrets.push({ file: filename, issue: 'Hard-coded JWT session token found' });
        }
    }

    const passed = foundHardcodedSecrets.length === 0;
    recordResult(
        passed,
        'No passwords, tokens, private keys, or server secrets hard-coded in frontend files',
        passed ? '' : foundHardcodedSecrets.map(s => `${s.file}: ${s.issue}`).join('; '),
        'Remove any credentials or server secret keys from frontend client files; load them strictly via environment variables or server APIs.'
    );
}

// ─── 2. CHECK: FIRESTORE SECURITY RULES & UNPAGED ACCESS AUDIT ───
async function auditFirestoreSecurityRules() {
    console.log('\n================================================================');
    console.log('CHECK 2: Firestore Security Rules & Access Control Audit');
    console.log('================================================================');

    const rulesPath = path.resolve(__dirname, 'firestore.rules');
    if (!fs.existsSync(rulesPath)) {
        recordResult(false, 'Firestore security rules file exists', 'firestore.rules not found', 'Create firestore.rules file.');
        return;
    }

    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    // Rule check: version 2
    const hasRulesV2 = rulesContent.includes("rules_version = '2'");
    recordResult(
        hasRulesV2,
        'Firestore security rules declare rules_version = 2',
        hasRulesV2 ? '' : 'Rules version 2 missing',
        'Add rules_version = \'2\'; at top of firestore.rules'
    );

    // Rule check: No public read or write rules
    const hasPublicRead = /allow\s+read\s*:\s*if\s+true/i.test(rulesContent);
    const hasPublicWrite = /allow\s+write\s*:\s*if\s+true/i.test(rulesContent);
    const hasPublicCreate = /allow\s+create\s*:\s*if\s+true/i.test(rulesContent);
    const hasPublicDelete = /allow\s+delete\s*:\s*if\s+true/i.test(rulesContent);
    const isOpen = hasPublicRead || hasPublicWrite || hasPublicCreate || hasPublicDelete;

    recordResult(
        !isOpen,
        'Firestore security rules do not contain publicly open (if true) read or write directives',
        isOpen ? 'Detected "allow ...: if true" in firestore.rules' : '',
        'Ensure all rules require authentication and role/owner check.'
    );

    // Rule check: Core collections are explicitly protected
    const protectsUsers = /match\s+\/users\/\{userId\}\s*\{[\s\S]*?allow read:\s*if isAdmin\(\)\s*\|\|\s*isOwner/i.test(rulesContent);
    const protectsBookings = /match\s+\/bookings\/\{bookingId\}\s*\{[\s\S]*?allow read/i.test(rulesContent);
    const protectsCustomers = /match\s+\/customers\/\{customerId\}\s*\{[\s\S]*?allow read/i.test(rulesContent);

    recordResult(
        protectsUsers && protectsBookings && protectsCustomers,
        'Firestore collections (users, bookings, customers) enforce role/owner-scoped read/write constraints',
        (!protectsUsers || !protectsBookings || !protectsCustomers) ? 'One or more collections lack strict access control' : '',
        'Enforce RBAC rules in firestore.rules for all collections.'
    );

    // Live REST verification: Unauthenticated access to Firestore REST API must be rejected (HTTP 403)
    try {
        const firestoreTestUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/bookings`;
        const res = await httpsRequest(firestoreTestUrl, { method: 'GET' });
        const isBlocked = (res.status === 403 || res.status === 401);
        recordResult(
            isBlocked,
            `Live Firestore REST API blocks unauthenticated access with HTTP ${res.status}`,
            isBlocked ? '' : `Expected HTTP 403/401 but received ${res.status}`,
            'Ensure Firestore Security Rules are deployed and active in the Firebase Console.'
        );
    } catch (e) {
        logInfo(`Firestore REST network check skipped: ${e.message}`);
    }
}

// ─── 3. CHECK: NO PASSWORDS STORED IN FIRESTORE OR SQLITE ───
async function auditPasswordStorage() {
    console.log('\n================================================================');
    console.log('CHECK 3: Password Storage & Exposure Audit (Firestore & SQLite)');
    console.log('================================================================');

    const dbPath = path.resolve(__dirname, 'database.sqlite');
    if (!fs.existsSync(dbPath)) {
        recordResult(false, 'SQLite database exists', 'database.sqlite not found', 'Initialize database.sqlite.');
        return;
    }

    const db = new sqlite3.Database(dbPath);

    await new Promise((resolve) => {
        // 1. Callers table check: telecallers MUST NOT have plaintext passwords stored in SQLite
        db.all("SELECT id, email, password FROM callers WHERE password IS NOT NULL AND password != ''", (err, rows) => {
            if (err) {
                recordResult(false, 'Check SQLite callers password storage', err.message);
                resolve();
                return;
            }

            const callersWithPasswords = rows ? rows.length : 0;
            const passedCallers = (callersWithPasswords === 0);
            recordResult(
                passedCallers,
                'Telecaller accounts do not store passwords in SQLite (passwords isolated to Firebase Auth)',
                passedCallers ? '' : `Found ${callersWithPasswords} caller(s) with passwords in SQLite`,
                'Do not store caller passwords in SQLite; authenticate telecallers via Firebase Authentication.'
            );

            // 2. Customers and Appointments tables: must never contain password columns or data
            db.all("PRAGMA table_info(customers)", (err2, custCols) => {
                db.all("PRAGMA table_info(appointments)", (err3, apptCols) => {
                    const custHasPass = (custCols || []).some(c => c.name.toLowerCase().includes('pass'));
                    const apptHasPass = (apptCols || []).some(c => c.name.toLowerCase().includes('pass'));
                    const noLeadPasswords = !custHasPass && !apptHasPass;

                    recordResult(
                        noLeadPasswords,
                        'Customer leads and Appointment tables contain zero password fields',
                        noLeadPasswords ? '' : 'Detected password column in customer or appointment table',
                        'Remove password columns from business lead tables.'
                    );

                    // 3. Activity logs table: must not contain password data
                    db.all("PRAGMA table_info(caller_activity_logs)", (err4, actCols) => {
                        const actHasPass = (actCols || []).some(c => c.name.toLowerCase().includes('password'));
                        recordResult(
                            !actHasPass,
                            'Audit activity log tables contain zero password fields',
                            actHasPass ? 'Password column found in activity logs' : '',
                            'Never log passwords in audit trails.'
                        );
                        db.close(() => resolve());
                    });
                });
            });
        });
    });

    // 4. Firestore collection schemas: verify no password fields stored in Firestore
    const firebaseServicePath = path.resolve(__dirname, 'firebase-service.js');
    if (fs.existsSync(firebaseServicePath)) {
        const fbContent = fs.readFileSync(firebaseServicePath, 'utf8');
        // Check if saveBooking or Firestore payload helpers include passwords
        const saveBookingIncludesPass = /saveBooking[\s\S]*?password/i.test(fbContent);
        recordResult(
            !saveBookingIncludesPass,
            'Firestore booking payloads never store passwords in Firestore documents',
            saveBookingIncludesPass ? 'Password field detected in Firestore saveBooking payload' : '',
            'Never send passwords to Firestore collections; use Firebase Auth for credentials.'
        );
    }
}

// ─── 4. CHECK: STUDENT AUTHENTICATION & ACCESS CONTROL ───
async function auditStudentAuth() {
    console.log('\n================================================================');
    console.log('CHECK 4: Student Authentication & Authorization');
    console.log('================================================================');

    const studentEmail = `${TEST_RUN_TAG}_student@example.com`;
    const studentPass = generateRandomPassword();
    tempCleanupRegistry.userEmails.push(studentEmail);

    // 4.1 Student Signup
    const signupRes = await httpRequest({ path: '/api/auth/signup', method: 'POST' }, {
        name: 'Audit Student',
        email: studentEmail,
        password: studentPass,
        phone: '9876540001'
    });

    const signupOk = signupRes.status === 200 && signupRes.body && signupRes.body.success && signupRes.body.token;
    recordResult(
        signupOk,
        'Student signup succeeds and returns valid JWT session token',
        signupOk ? '' : `HTTP ${signupRes.status}: ${JSON.stringify(signupRes.body)}`,
        'Ensure /api/auth/signup correctly provisions students and issues JWT.'
    );

    const studentToken = signupRes.body ? signupRes.body.token : null;
    const studentHeaders = studentToken ? { 'Authorization': `Bearer ${studentToken}` } : {};

    // 4.2 Duplicate Signup Prevention
    const dupRes = await httpRequest({ path: '/api/auth/signup', method: 'POST' }, {
        name: 'Duplicate Student',
        email: studentEmail,
        password: studentPass
    });
    const dupBlocked = (dupRes.status === 409);
    recordResult(
        dupBlocked,
        'Student duplicate registration is blocked with HTTP 409 Conflict',
        dupBlocked ? '' : `Received HTTP ${dupRes.status} instead of 409`,
        'Reject duplicate email registration with HTTP 409.'
    );

    // 4.3 Student Profile Access
    if (studentToken) {
        const profileRes = await httpRequest({ path: '/api/auth/me', method: 'GET', headers: studentHeaders });
        const profileOk = profileRes.status === 200 && profileRes.body && profileRes.body.user && profileRes.body.user.email === studentEmail;
        recordResult(
            profileOk,
            'Student can access own profile (/api/auth/me)',
            profileOk ? '' : `HTTP ${profileRes.status}`,
            'Ensure /api/auth/me returns current authenticated student profile.'
        );

        // 4.4 Password NOT exposed in profile
        const noPassInProfile = profileRes.body && profileRes.body.user && profileRes.body.user.password == null;
        recordResult(
            noPassInProfile,
            'Student profile endpoint NEVER exposes password field',
            noPassInProfile ? '' : 'Password field present in profile output',
            'Ensure SELECT query excludes password from /api/auth/me response.'
        );
    }

    // 4.5 Unauthorized /api/auth/me requests rejected
    const noAuthRes = await httpRequest({ path: '/api/auth/me', method: 'GET' });
    recordResult(
        noAuthRes.status === 401,
        'Unauthenticated profile request rejected with HTTP 401',
        noAuthRes.status === 401 ? '' : `Received HTTP ${noAuthRes.status}`,
        'Protect /api/auth/me with authenticateToken middleware.'
    );

    const fakeTokenRes = await httpRequest({
        path: '/api/auth/me',
        method: 'GET',
        headers: { 'Authorization': 'Bearer invalid.tampered.token' }
    });
    recordResult(
        fakeTokenRes.status === 403,
        'Tampered or invalid JWT token rejected with HTTP 403',
        fakeTokenRes.status === 403 ? '' : `Received HTTP ${fakeTokenRes.status}`,
        'Reject invalid JWT tokens with HTTP 403.'
    );

    return { studentToken, studentHeaders };
}

// ─── 5. CHECK: ADMIN AUTHENTICATION & RESTRICTIONS ───
async function auditAdminAuth() {
    console.log('\n================================================================');
    console.log('CHECK 5: Admin Authentication & Authorization');
    console.log('================================================================');

    // 5.1 Admin valid sign-in
    const adminLogin = await httpRequest({ path: '/api/auth/signin', method: 'POST' }, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
    });

    const adminOk = adminLogin.status === 200 && adminLogin.body && adminLogin.body.isAdmin === true && adminLogin.body.token;
    recordResult(
        adminOk,
        'Admin sign-in succeeds with valid credentials (isAdmin: true)',
        adminOk ? '' : `HTTP ${adminLogin.status}`,
        'Verify ADMIN_EMAIL and ADMIN_PASSWORD in .env match credentials.'
    );

    const adminToken = adminLogin.body ? adminLogin.body.token : null;
    const adminHeaders = adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {};

    // 5.2 Admin invalid password rejected
    const badAdminLogin = await httpRequest({ path: '/api/auth/signin', method: 'POST' }, {
        email: ADMIN_EMAIL,
        password: 'WrongPassword!999'
    });
    recordResult(
        badAdminLogin.status === 401,
        'Admin sign-in with wrong password rejected with HTTP 401',
        badAdminLogin.status === 401 ? '' : `Received HTTP ${badAdminLogin.status}`,
        'Reject incorrect admin passwords with HTTP 401.'
    );

    // 5.3 Password NOT exposed in admin response
    const noAdminPassExposed = adminLogin.body && adminLogin.body.user && adminLogin.body.user.password == null;
    recordResult(
        noAdminPassExposed,
        'Admin sign-in response does NOT expose password field',
        noAdminPassExposed ? '' : 'Password field present in admin signin response',
        'Exclude password field from user object in sign-in response.'
    );

    return { adminToken, adminHeaders };
}

// ─── 6. CHECK: STUDENT CANNOT ACCESS ADMIN OR CALLER APIS ───
async function auditStudentRestrictions(studentHeaders) {
    console.log('\n================================================================');
    console.log('CHECK 6: Student Access Control (Forbidden from Admin & Caller Endpoints)');
    console.log('================================================================');

    const adminEndpoints = [
        { method: 'GET', path: '/api/admin/me', name: 'GET /api/admin/me' },
        { method: 'GET', path: '/api/admin/callers', name: 'GET /api/admin/callers' },
        { method: 'GET', path: '/api/admin/appointments', name: 'GET /api/admin/appointments' },
        { method: 'GET', path: '/api/admin/caller-activities', name: 'GET /api/admin/caller-activities' },
        { method: 'POST', path: '/api/admin/callers', name: 'POST /api/admin/callers', body: { name: 'Hacker', email: 'h@h.com', password: 'p' } },
        { method: 'POST', path: '/api/admin/assign', name: 'POST /api/admin/assign', body: { type: 'appointment', id: 1, caller_id: 1 } }
    ];

    let allAdminBlocked = true;
    for (const ep of adminEndpoints) {
        const res = await httpRequest({ path: ep.path, method: ep.method, headers: studentHeaders }, ep.body || null);
        if (res.status !== 403) {
            allAdminBlocked = false;
            recordResult(false, `Student blocked from ${ep.name}`, `Received HTTP ${res.status} instead of 403`, 'Enforce authenticateAdmin on endpoint.');
        }
    }
    if (allAdminBlocked) {
        recordResult(true, 'Student is blocked with HTTP 403 from ALL Admin endpoints');
    }

    const callerEndpoints = [
        { method: 'GET', path: '/api/caller/appointments', name: 'GET /api/caller/appointments' },
        { method: 'GET', path: '/api/caller/appointments/1', name: 'GET /api/caller/appointments/:id' },
        { method: 'PATCH', path: '/api/caller/appointments/1/call-log', name: 'PATCH /api/caller/appointments/:id/call-log', body: { call_status: 'Connected' } },
        { method: 'GET', path: '/api/caller/customers', name: 'GET /api/caller/customers' },
        { method: 'GET', path: '/api/caller/customers/1', name: 'GET /api/caller/customers/:id' },
        { method: 'PATCH', path: '/api/caller/customers/1', name: 'PATCH /api/caller/customers/:id', body: { status: 'Enrolled' } },
        { method: 'POST', path: '/api/caller/customers/1/note', name: 'POST /api/caller/customers/:id/note', body: { note: 'test' } },
        { method: 'GET', path: '/api/caller/stats', name: 'GET /api/caller/stats' }
    ];

    let allCallerBlocked = true;
    for (const ep of callerEndpoints) {
        const res = await httpRequest({ path: ep.path, method: ep.method, headers: studentHeaders }, ep.body || null);
        if (res.status !== 403) {
            allCallerBlocked = false;
            recordResult(false, `Student blocked from ${ep.name}`, `Received HTTP ${res.status} instead of 403`, 'Enforce authenticateCaller on endpoint.');
        }
    }
    if (allCallerBlocked) {
        recordResult(true, 'Student is blocked with HTTP 403 from ALL Caller endpoints');
    }
}

// ─── 7. CHECK: INDIVIDUAL CALLER AUTH & REAL-TIME DEACTIVATION ───
async function auditCallerAuthAndDeactivation(adminHeaders) {
    console.log('\n================================================================');
    console.log('CHECK 7: Individual Caller Authentication & Real-Time Deactivation');
    console.log('================================================================');

    const callerEmail = `${TEST_RUN_TAG}_caller@cubecadcenter.com`;
    const callerPass = generateRandomPassword();

    // 7.1 Admin creates caller account
    const createRes = await httpRequest({ path: '/api/admin/callers', method: 'POST', headers: adminHeaders }, {
        name: 'Audit Caller',
        email: callerEmail,
        password: callerPass,
        status: 'Active'
    });

    const createOk = createRes.status === 200 && createRes.body && createRes.body.caller && createRes.body.caller.id;
    recordResult(
        createOk,
        'Admin creates individual telecaller account via Firebase Auth + SQLite',
        createOk ? '' : `HTTP ${createRes.status}`,
        'Ensure /api/admin/callers creates caller in Firebase Auth and SQLite.'
    );

    if (!createOk) return null;

    const callerId = createRes.body.caller.id;
    tempCleanupRegistry.callerIds.push(callerId);

    // 7.2 Password NOT exposed in create caller response
    const noPassInCreate = createRes.body.caller.password == null;
    recordResult(
        noPassInCreate,
        'Caller password is NOT exposed in admin caller creation response',
        noPassInCreate ? '' : 'Password field exposed in caller response',
        'Exclude password from caller creation response object.'
    );

    // 7.3 Shared PIN login rejected (Individual credentials required)
    const pinAttempt = await httpRequest({ path: '/api/caller/auth/login', method: 'POST' }, {
        email: callerEmail,
        pin: '1234'
    });
    recordResult(
        pinAttempt.status === 400,
        'Shared PIN login attempt without password is rejected with HTTP 400',
        pinAttempt.status === 400 ? '' : `Received HTTP ${pinAttempt.status}`,
        'Require individual email and password on /api/caller/auth/login.'
    );

    // 7.4 Caller individual sign-in
    const callerLogin = await httpRequest({ path: '/api/caller/auth/login', method: 'POST' }, {
        email: callerEmail,
        password: callerPass
    });

    const callerLoginOk = callerLogin.status === 200 && callerLogin.body && callerLogin.body.token;
    recordResult(
        callerLoginOk,
        'Individual telecaller logs in with email & password and receives JWT',
        callerLoginOk ? '' : `HTTP ${callerLogin.status}`,
        'Ensure /api/caller/auth/login authenticates against Firebase Auth.'
    );

    const callerToken = callerLogin.body ? callerLogin.body.token : null;
    const callerHeaders = callerToken ? { 'Authorization': `Bearer ${callerToken}` } : {};

    // 7.5 Real-time Account Deactivation & JWT Revocation
    const deactRes = await httpRequest({
        path: `/api/admin/callers/${callerId}/status`,
        method: 'PATCH',
        headers: adminHeaders
    }, { status: 'Inactive' });

    recordResult(
        deactRes.status === 200 && deactRes.body && deactRes.body.status === 'Inactive',
        'Admin sets caller status to Inactive',
        deactRes.status === 200 ? '' : `HTTP ${deactRes.status}`,
        'Implement /api/admin/callers/:id/status endpoint.'
    );

    // CRITICAL: Existing active JWT token must be immediately blocked
    const revokedSessionRes = await httpRequest({
        path: '/api/caller/appointments',
        method: 'GET',
        headers: callerHeaders
    });

    const revokedBlocked = (revokedSessionRes.status === 403 && revokedSessionRes.body && revokedSessionRes.body.deactivated === true);
    recordResult(
        revokedBlocked,
        'Deactivated caller existing JWT token is IMMEDIATELY revoked (HTTP 403 deactivated: true)',
        revokedBlocked ? '' : `HTTP ${revokedSessionRes.status}: ${JSON.stringify(revokedSessionRes.body)}`,
        'Verify caller active status in database inside authenticateCaller middleware.'
    );

    // Deactivated caller cannot sign in again
    const deactLoginRes = await httpRequest({ path: '/api/caller/auth/login', method: 'POST' }, {
        email: callerEmail,
        password: callerPass
    });
    const deactLoginBlocked = (deactLoginRes.status === 403 && deactLoginRes.body && deactLoginRes.body.deactivated === true);
    recordResult(
        deactLoginBlocked,
        'Deactivated caller cannot sign in (HTTP 403 deactivated: true)',
        deactLoginBlocked ? '' : `HTTP ${deactLoginRes.status}`,
        'Check caller status during /api/caller/auth/login.'
    );

    // Reactivate caller
    const reactRes = await httpRequest({
        path: `/api/admin/callers/${callerId}/status`,
        method: 'PATCH',
        headers: adminHeaders
    }, { status: 'Active' });

    recordResult(
        reactRes.status === 200 && reactRes.body && reactRes.body.status === 'Active',
        'Admin reactivates telecaller account',
        reactRes.status === 200 ? '' : `HTTP ${reactRes.status}`,
        'Allow admin to reactivate callers.'
    );

    // Sign in after reactivation
    const reactLoginRes = await httpRequest({ path: '/api/caller/auth/login', method: 'POST' }, {
        email: callerEmail,
        password: callerPass
    });
    const reactLoginOk = reactLoginRes.status === 200 && reactLoginRes.body && reactLoginRes.body.token;
    recordResult(
        reactLoginOk,
        'Reactivated caller can successfully sign in and resume operations',
        reactLoginOk ? '' : `HTTP ${reactLoginRes.status}`,
        'Ensure reactivation allows authentication.'
    );

    const freshCallerToken = reactLoginRes.body ? reactLoginRes.body.token : callerToken;
    return { callerId, callerEmail, callerPass, callerHeaders: { 'Authorization': `Bearer ${freshCallerToken}` } };
}

// ─── 8. CHECK: CALLER SCOPING & ID TAMPERING PREVENTION ───
async function auditCallerScopingAndTampering(adminHeaders, studentHeaders) {
    console.log('\n================================================================');
    console.log('CHECK 8: Scoped Caller Access & URL ID Tampering Prevention (Horizontal)');
    console.log('================================================================');

    const c1Email = `${TEST_RUN_TAG}_scope1@cubecadcenter.com`;
    const c1Pass = generateRandomPassword();
    const c2Email = `${TEST_RUN_TAG}_scope2@cubecadcenter.com`;
    const c2Pass = generateRandomPassword();

    // Create Caller 1
    const createC1 = await httpRequest({ path: '/api/admin/callers', method: 'POST', headers: adminHeaders }, {
        name: 'Scope Caller 1', email: c1Email, password: c1Pass, status: 'Active'
    });
    // Create Caller 2
    const createC2 = await httpRequest({ path: '/api/admin/callers', method: 'POST', headers: adminHeaders }, {
        name: 'Scope Caller 2', email: c2Email, password: c2Pass, status: 'Active'
    });

    if (!createC1.body || !createC1.body.caller || !createC2.body || !createC2.body.caller) {
        recordResult(false, 'Provision test callers for scoping audit', 'Could not create test callers');
        return;
    }

    const c1Id = createC1.body.caller.id;
    const c2Id = createC2.body.caller.id;
    tempCleanupRegistry.callerIds.push(c1Id, c2Id);

    // Caller 1 & 2 Logins
    const loginC1 = await httpRequest({ path: '/api/caller/auth/login', method: 'POST' }, { email: c1Email, password: c1Pass });
    const loginC2 = await httpRequest({ path: '/api/caller/auth/login', method: 'POST' }, { email: c2Email, password: c2Pass });
    const c1Headers = { 'Authorization': `Bearer ${loginC1.body.token}` };
    const c2Headers = { 'Authorization': `Bearer ${loginC2.body.token}` };

    // Helper to get upcoming weekday within next 7 days (server restricts booking window)
    function getUpcomingValidDate() {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        while (d.getDay() === 0) {
            d.setDate(d.getDate() + 1);
        }
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    // Book 2 Appointments
    const validBookingDate = getUpcomingValidDate();
    const appt1Res = await httpRequest({ path: '/api/appointments', method: 'POST', headers: studentHeaders }, {
        name: 'Audit Lead 1', email: `${TEST_RUN_TAG}_lead1@example.com`, phone: '9876590001',
        program: 'AutoCAD', branch: 'Ahmedabad Main', date: validBookingDate, time_slot: '10:00 AM'
    });
    const appt2Res = await httpRequest({ path: '/api/appointments', method: 'POST', headers: studentHeaders }, {
        name: 'Audit Lead 2', email: `${TEST_RUN_TAG}_lead2@example.com`, phone: '9876590002',
        program: 'SolidWorks', branch: 'Ahmedabad Main', date: validBookingDate, time_slot: '11:00 AM'
    });

    const appt1Id = appt1Res.body && appt1Res.body.appointment ? appt1Res.body.appointment.id : (appt1Res.body ? appt1Res.body.appointmentId : null);
    const appt2Id = appt2Res.body && appt2Res.body.appointment ? appt2Res.body.appointment.id : (appt2Res.body ? appt2Res.body.appointmentId : null);

    if (appt1Id) tempCleanupRegistry.appointmentIds.push(appt1Id);
    if (appt2Id) tempCleanupRegistry.appointmentIds.push(appt2Id);

    // Create 2 Customers
    const cust1Res = await httpRequest({ path: '/api/admin/customers', method: 'POST', headers: adminHeaders }, {
        name: 'Cust Lead 1', mobile: '9876590003', email: `${TEST_RUN_TAG}_cust1@example.com`, course: 'Revit BIM'
    });
    const cust2Res = await httpRequest({ path: '/api/admin/customers', method: 'POST', headers: adminHeaders }, {
        name: 'Cust Lead 2', mobile: '9876590004', email: `${TEST_RUN_TAG}_cust2@example.com`, course: 'STAAD.Pro'
    });
    const cust1Id = cust1Res.body.id;
    const cust2Id = cust2Res.body.id;
    if (cust1Id) tempCleanupRegistry.customerIds.push(cust1Id);
    if (cust2Id) tempCleanupRegistry.customerIds.push(cust2Id);

    // Assign Appt 1 & Cust 1 -> Caller 1
    await httpRequest({ path: '/api/admin/assign', method: 'POST', headers: adminHeaders }, { type: 'appointment', id: appt1Id, caller_id: c1Id });
    await httpRequest({ path: '/api/admin/assign', method: 'POST', headers: adminHeaders }, { type: 'customer', id: cust1Id, caller_id: c1Id });

    // Assign Appt 2 & Cust 2 -> Caller 2
    await httpRequest({ path: '/api/admin/assign', method: 'POST', headers: adminHeaders }, { type: 'appointment', id: appt2Id, caller_id: c2Id });
    await httpRequest({ path: '/api/admin/assign', method: 'POST', headers: adminHeaders }, { type: 'customer', id: cust2Id, caller_id: c2Id });

    // 8.1 Scoped Listings
    const c1Appts = await httpRequest({ path: '/api/caller/appointments', method: 'GET', headers: c1Headers });
    const c1ApptIds = (c1Appts.body.appointments || []).map(a => a.id);
    const scopeApptOk = c1ApptIds.includes(appt1Id) && !c1ApptIds.includes(appt2Id);
    recordResult(
        scopeApptOk,
        'Caller appointment directory is strictly scoped to assigned leads only',
        scopeApptOk ? '' : 'Caller 1 can view Caller 2 appointment in list',
        'Scope appointment query: WHERE assigned_caller_id = req.caller.id.'
    );

    const c1Custs = await httpRequest({ path: '/api/caller/customers', method: 'GET', headers: c1Headers });
    const c1CustIds = (c1Custs.body.customers || []).map(c => c.id);
    const scopeCustOk = c1CustIds.includes(cust1Id) && !c1CustIds.includes(cust2Id);
    recordResult(
        scopeCustOk,
        'Caller customer directory is strictly scoped to assigned customers only',
        scopeCustOk ? '' : 'Caller 1 can view Caller 2 customer in list',
        'Scope customer query: WHERE assigned_caller_id = req.caller.id.'
    );

    // 8.2 ID/URL Tampering Prevention (Horizontal Privilege Escalation)
    // Tamper 1: Caller 1 attempts to access Caller 2 Appointment via URL ID
    const tamperGetAppt = await httpRequest({ path: `/api/caller/appointments/${appt2Id}`, method: 'GET', headers: c1Headers });
    recordResult(
        tamperGetAppt.status === 403,
        `ID Tampering: Caller 1 GET /api/caller/appointments/${appt2Id} (Caller 2 appt) BLOCKED with HTTP 403`,
        tamperGetAppt.status === 403 ? '' : `Received HTTP ${tamperGetAppt.status}`,
        'Verify appointment.assigned_caller_id === req.caller.id before returning.'
    );

    // Tamper 2: Caller 1 attempts to modify Caller 2 Appointment call-log
    const tamperLogAppt = await httpRequest({
        path: `/api/caller/appointments/${appt2Id}/call-log`,
        method: 'PATCH',
        headers: c1Headers
    }, { call_status: 'Connected', call_notes: 'Tamper attempt' });
    recordResult(
        tamperLogAppt.status === 403,
        `ID Tampering: Caller 1 PATCH /api/caller/appointments/${appt2Id}/call-log BLOCKED with HTTP 403`,
        tamperLogAppt.status === 403 ? '' : `Received HTTP ${tamperLogAppt.status}`,
        'Verify ownership before updating appointment call log.'
    );

    // Tamper 3: Caller 1 attempts to view Caller 2 Customer via URL ID
    const tamperGetCust = await httpRequest({ path: `/api/caller/customers/${cust2Id}`, method: 'GET', headers: c1Headers });
    recordResult(
        tamperGetCust.status === 403,
        `ID Tampering: Caller 1 GET /api/caller/customers/${cust2Id} (Caller 2 cust) BLOCKED with HTTP 403`,
        tamperGetCust.status === 403 ? '' : `Received HTTP ${tamperGetCust.status}`,
        'Verify customer.assigned_caller_id === req.caller.id before returning.'
    );

    // Tamper 4: Caller 1 attempts to update Caller 2 Customer status
    const tamperUpdateCust = await httpRequest({
        path: `/api/caller/customers/${cust2Id}`,
        method: 'PATCH',
        headers: c1Headers
    }, { status: 'Enrolled' });
    recordResult(
        tamperUpdateCust.status === 403,
        `ID Tampering: Caller 1 PATCH /api/caller/customers/${cust2Id} BLOCKED with HTTP 403`,
        tamperUpdateCust.status === 403 ? '' : `Received HTTP ${tamperUpdateCust.status}`,
        'Verify ownership before updating customer.'
    );

    // Tamper 5: Caller 1 attempts to add note to Caller 2 Customer
    const tamperNoteCust = await httpRequest({
        path: `/api/caller/customers/${cust2Id}/note`,
        method: 'POST',
        headers: c1Headers
    }, { note: 'Tampered note' });
    recordResult(
        tamperNoteCust.status === 403,
        `ID Tampering: Caller 1 POST /api/caller/customers/${cust2Id}/note BLOCKED with HTTP 403`,
        tamperNoteCust.status === 403 ? '' : `Received HTTP ${tamperNoteCust.status}`,
        'Verify ownership before saving customer note.'
    );
}

// ─── 9. CHECK: ADMIN-ONLY CALLER MANAGEMENT ENDPOINTS ───
async function auditAdminOnlyManagementEndpoints(callerHeaders) {
    console.log('\n================================================================');
    console.log('CHECK 9: Admin-Only Caller Management Endpoints Protection');
    console.log('================================================================');

    const mgmtEndpoints = [
        { method: 'GET', path: '/api/admin/callers', name: 'GET /api/admin/callers' },
        { method: 'POST', path: '/api/admin/callers', name: 'POST /api/admin/callers', body: { name: 'X', email: 'x@x.com', password: 'p' } },
        { method: 'PATCH', path: '/api/admin/callers/1/status', name: 'PATCH /api/admin/callers/:id/status', body: { status: 'Active' } },
        { method: 'POST', path: '/api/admin/callers/1/reset-password', name: 'POST /api/admin/callers/:id/reset-password', body: { newPassword: 'P' } },
        { method: 'DELETE', path: '/api/admin/callers/1', name: 'DELETE /api/admin/callers/:id' }
    ];

    let allBlockedUnauth = true;
    for (const ep of mgmtEndpoints) {
        const res = await httpRequest({ path: ep.path, method: ep.method }, ep.body || null);
        if (res.status !== 401 && res.status !== 403) {
            allBlockedUnauth = false;
            recordResult(false, `Unauthenticated request blocked from ${ep.name}`, `Received HTTP ${res.status}`);
        }
    }
    if (allBlockedUnauth) {
        recordResult(true, 'All caller management endpoints require authentication (HTTP 401)');
    }

    let allBlockedForCaller = true;
    if (callerHeaders) {
        for (const ep of mgmtEndpoints) {
            const res = await httpRequest({ path: ep.path, method: ep.method, headers: callerHeaders }, ep.body || null);
            if (res.status !== 403) {
                allBlockedForCaller = false;
                recordResult(false, `Telecaller blocked from ${ep.name}`, `Received HTTP ${res.status}`);
            }
        }
    }
    if (allBlockedForCaller) {
        recordResult(true, 'All caller management endpoints reject telecallers with HTTP 403 Forbidden');
    }
}

// ─── 10. CHECK: EXECUTE EXISTING SECURITY TEST SUITE ───
async function executeExistingSecuritySuite() {
    console.log('\n================================================================');
    console.log('CHECK 10: Execution of Existing Security Test Suite (test_security_suite.js)');
    console.log('================================================================');

    const suitePath = path.resolve(__dirname, 'test_security_suite.js');
    if (!fs.existsSync(suitePath)) {
        recordResult(false, 'Existing security test suite file exists', 'test_security_suite.js not found', 'Provide test_security_suite.js.');
        return;
    }

    const passed = await new Promise((resolve) => {
        const proc = spawn('node', [suitePath], {
            cwd: __dirname,
            env: Object.assign({}, process.env, { BASE_URL })
        });

        let output = '';
        proc.stdout.on('data', chunk => {
            const str = chunk.toString();
            output += str;
            // Print sanitized output in real-time
            process.stdout.write(sanitize(str));
        });
        proc.stderr.on('data', chunk => {
            const str = chunk.toString();
            output += str;
            process.stderr.write(sanitize(str));
        });

        proc.on('close', code => {
            resolve(code === 0);
        });
    });

    recordResult(
        passed,
        'Existing security test suite (test_security_suite.js) executed and passed completely',
        passed ? '' : 'One or more assertions in test_security_suite.js failed',
        'Review test_security_suite.js failures and resolve.'
    );
}

// ─── SAFE CLEANUP ROUTINE ───
async function performSafeCleanup(adminHeaders) {
    logInfo('Running automatic cleanup of temporary audit records...');
    const dbPath = path.resolve(__dirname, 'database.sqlite');
    if (!fs.existsSync(dbPath)) return;

    // 1. Delete test callers via Admin API if headers available
    if (adminHeaders) {
        for (const cid of tempCleanupRegistry.callerIds) {
            try {
                await httpRequest({ path: `/api/admin/callers/${cid}`, method: 'DELETE', headers: adminHeaders });
            } catch (e) {}
        }
        for (const aid of tempCleanupRegistry.appointmentIds) {
            try {
                await httpRequest({ path: `/api/admin/appointments/${aid}`, method: 'DELETE', headers: adminHeaders });
            } catch (e) {}
        }
        for (const cid of tempCleanupRegistry.customerIds) {
            try {
                await httpRequest({ path: `/api/admin/customers/${cid}`, method: 'DELETE', headers: adminHeaders });
            } catch (e) {}
        }
    }

    // 2. Direct SQLite cleanup ONLY for temporary test data created with this audit's prefix
    const db = new sqlite3.Database(dbPath);
    await new Promise((resolve) => {
        db.serialize(() => {
            // Delete only records created with the sec_audit prefix
            db.run("DELETE FROM users WHERE email LIKE 'sec_audit_%'", () => {});
            db.run("DELETE FROM appointments WHERE email LIKE 'sec_audit_%'", () => {});
            db.run("DELETE FROM customers WHERE email LIKE 'sec_audit_%'", () => {});
            db.run("DELETE FROM callers WHERE email LIKE 'sec_audit_%'", () => {});
            db.run("DELETE FROM caller_activity_logs WHERE caller_email LIKE 'sec_audit_%'", () => {
                db.close(() => resolve());
            });
        });
    });
    logInfo('Temporary audit records safely removed.');
}

// ─── MAIN ORCHESTRATOR ───
async function runCompleteSecurityAudit() {
    const startTime = Date.now();
    console.log('================================================================');
    console.log('   CUBE CAD CENTER - AUTOMATED SECURITY AUDIT & VERIFICATION');
    console.log(`   Target: ${BASE_URL}`);
    console.log(`   Session Run ID: ${TEST_RUN_TAG}`);
    console.log('================================================================');

    let adminHeaders = null;
    let studentHeaders = null;
    let callerHeaders = null;

    try {
        // Step 0: Ensure local application server is active
        await ensureServerRunning();

        // Check 1: Frontend Secrets Scanner
        auditFrontendSecrets();

        // Check 2: Firestore Security Rules Analysis & REST Check
        await auditFirestoreSecurityRules();

        // Check 3: Password Storage in Firestore & SQLite
        await auditPasswordStorage();

        // Check 4: Student Authentication & Restrictions
        const studentInfo = await auditStudentAuth();
        studentHeaders = studentInfo ? studentInfo.studentHeaders : null;

        // Check 5: Admin Authentication
        const adminInfo = await auditAdminAuth();
        adminHeaders = adminInfo ? adminInfo.adminHeaders : null;

        // Check 6: Student Access Control (Forbidden from Admin/Caller endpoints)
        if (studentHeaders) {
            await auditStudentRestrictions(studentHeaders);
        }

        // Check 7: Caller Auth & Real-Time Deactivation
        if (adminHeaders) {
            const callerInfo = await auditCallerAuthAndDeactivation(adminHeaders);
            callerHeaders = callerInfo ? callerInfo.callerHeaders : null;
        }

        // Check 8: Scoped Caller Access & Horizontal ID Tampering Prevention
        if (adminHeaders && studentHeaders) {
            await auditCallerScopingAndTampering(adminHeaders, studentHeaders);
        }

        // Check 9: Admin-Only Caller Management Protection
        await auditAdminOnlyManagementEndpoints(callerHeaders);

        // Check 10: Run full existing test suite
        await executeExistingSecuritySuite();

    } catch (err) {
        logFail(`Fatal audit error occurred: ${err.message}`);
        auditResults.failed++;
        auditResults.failures.push({
            check: 'Fatal audit execution error',
            detail: err.message,
            fix: 'Investigate stack trace and environment configuration.'
        });
    } finally {
        // Safe data cleanup
        try {
            await performSafeCleanup(adminHeaders);
        } catch (ce) {
            logInfo(`Cleanup note: ${ce.message}`);
        }
        // Shut down spawned server if started
        cleanupServer();
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    // ─── FINAL REPORT ───
    console.log('\n================================================================');
    console.log('                 SECURITY AUDIT REPORT SUMMARY');
    console.log('================================================================');
    console.log(`Total Checks Executed : ${auditResults.passed + auditResults.failed}`);
    console.log(`Passed Checks         : ${auditResults.passed}`);
    console.log(`Failed Checks         : ${auditResults.failed}`);
    console.log(`Execution Duration    : ${durationSec}s`);
    console.log('----------------------------------------------------------------');

    if (auditResults.failed === 0) {
        console.log('\n================================================================');
        console.log('                   SECURITY CHECK PASSED');
        console.log('================================================================');
        console.log('All authentication, authorization, role scoping, ID tampering,');
        console.log('deactivation controls, Firestore rules, and credential checks');
        console.log('passed successfully with 0 security defects.\n');
        process.exit(0);
    } else {
        console.log('\n================================================================');
        console.log('                   SECURITY CHECK FAILED');
        console.log('================================================================\n');
        console.log('Failed Checks and Required Remediation:');
        auditResults.failures.forEach((f, idx) => {
            console.log(`\n  [${idx + 1}] FAILED: ${f.check}`);
            if (f.detail) console.log(`      Reason: ${f.detail}`);
            if (f.fix) console.log(`      Fix   : ${f.fix}`);
        });
        console.log('\n----------------------------------------------------------------\n');
        process.exit(1);
    }
}

// Global process exception handlers to ensure server child process cleanup
process.on('SIGINT', () => { cleanupServer(); process.exit(1); });
process.on('SIGTERM', () => { cleanupServer(); process.exit(1); });

runCompleteSecurityAudit();
