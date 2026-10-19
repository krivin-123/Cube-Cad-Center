const http = require('http');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const API_BASE = 'http://localhost:3000/api';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDBdKpF_64kpxJ3JxBuRAMjRBCVnMisorI';
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function assert(condition, message) {
    if (!condition) {
        console.error(`  [FAIL] ${message}`);
        process.exit(1);
    } else {
        console.log(`  [PASS] ${message}`);
    }
}

function requestHttp(urlStr, options = {}, body = null) {
    return new Promise((resolve, reject) => {
        const u = new URL(urlStr);
        const isHttps = u.protocol === 'https:';
        const client = isHttps ? https : http;
        const reqOpts = {
            hostname: u.hostname,
            port: u.port || (isHttps ? 443 : 80),
            path: u.pathname + u.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };
        let bodyData = null;
        if (body) {
            bodyData = typeof body === 'string' ? body : JSON.stringify(body);
            reqOpts.headers['Content-Type'] = reqOpts.headers['Content-Type'] || 'application/json';
            reqOpts.headers['Content-Length'] = Buffer.byteLength(bodyData);
        }
        const req = client.request(reqOpts, (res) => {
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
    });
}

// Query Firebase Authentication directly via Google Identity Toolkit API
function firebaseSignIn(email, password) {
    return new Promise((resolve) => {
        const payload = JSON.stringify({
            email: email.toLowerCase().trim(),
            password: password,
            returnSecureToken: true
        });
        const req = https.request({
            hostname: 'identitytoolkit.googleapis.com',
            path: `/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body || '{}');
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, body: {} });
                }
            });
        });
        req.on('error', (err) => resolve({ status: 500, error: err }));
        req.write(payload);
        req.end();
    });
}

async function run() {
    console.log('================================================================');
    console.log('TESTING DUPLICATE-EMAIL REGISTRATION & AUTHENTICATION INTEGRITY');
    console.log('================================================================');

    const testId = Date.now();
    const testEmail = `duplicate_test_${testId}@example.com`;
    const originalPassword = `OriginalPass#${testId}`;
    const newPassword = `NewAttemptedPass#${testId}`;

    // ─────────────────────────────────────────────────────────────
    // 1. FIRST REGISTRATION SUCCEEDS
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 1. First Registration (Original Account) ---');
    const firstReg = await requestHttp(`${API_BASE}/auth/signup`, { method: 'POST' }, {
        name: `Original User ${testId}`,
        email: testEmail,
        password: originalPassword,
        phone: '9811111111'
    });

    assert(firstReg.status === 200 && firstReg.body.success, 'First registration succeeds with HTTP 200');
    assert(firstReg.body.token != null, 'First registration returns session token');
    assert(firstReg.body.firebaseToken != null, 'First registration returns Firebase Auth token');
    const originalUid = firstReg.body.user ? firstReg.body.user.uid : null;
    console.log(`  [INFO] Original account created with UID: ${originalUid}`);

    // Verify first registration created 1 account in SQLite
    const sqliteCount1 = await new Promise((resolve) => {
        db.all(`SELECT id, email, password, firebase_uid FROM users WHERE LOWER(email) = ?`, [testEmail.toLowerCase()], (err, rows) => {
            resolve(rows || []);
        });
    });
    assert(sqliteCount1.length === 1, 'Exactly 1 SQLite user record exists after first registration');

    // Verify first registration created 1 account in Firebase Authentication
    const fbCheckOrig = await firebaseSignIn(testEmail, originalPassword);
    assert(fbCheckOrig.status === 200 && fbCheckOrig.body.localId === originalUid, 'Firebase Auth account exists with original credentials and matches UID');

    // ─────────────────────────────────────────────────────────────
    // 2. SECOND REGISTRATION WITH SAME EMAIL IS REJECTED
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 2. Second Registration with Same Email (Must Be Rejected) ---');
    const secondReg = await requestHttp(`${API_BASE}/auth/signup`, { method: 'POST' }, {
        name: `Imposter User ${testId}`,
        email: testEmail,
        password: newPassword,
        phone: '9822222222'
    });

    assert(secondReg.status === 409, `Second registration is rejected with HTTP 409 Conflict (got ${secondReg.status})`);
    assert(secondReg.body.success === false, 'Response indicates success: false');
    assert(
        secondReg.body.error && secondReg.body.error.toLowerCase().includes('already registered'),
        `Clear "Email already registered" response returned: "${secondReg.body.error}"`
    );
    assert(
        secondReg.body.error.toLowerCase().includes('login') || secondReg.body.error.toLowerCase().includes('sign in'),
        'Response directs the user to use Login instead'
    );

    // ─────────────────────────────────────────────────────────────
    // 3. ORIGINAL PASSWORD STILL WORKS
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 3. Verify Original Password Still Works ---');
    // Test login via backend API with original password
    const loginOrigRes = await requestHttp(`${API_BASE}/auth/signin`, { method: 'POST' }, {
        email: testEmail,
        password: originalPassword
    });
    assert(loginOrigRes.status === 200 && loginOrigRes.body.success, 'Login with ORIGINAL password succeeds with HTTP 200');
    assert(loginOrigRes.body.firebaseToken != null, 'Login with original password returns valid Firebase Auth token');

    // Test direct Firebase Authentication with original password
    const fbLoginOrig = await firebaseSignIn(testEmail, originalPassword);
    assert(fbLoginOrig.status === 200 && fbLoginOrig.body.idToken != null, 'Firebase Authentication directly validates original password');

    // ─────────────────────────────────────────────────────────────
    // 4. NEW PASSWORD DOES NOT REPLACE ORIGINAL PASSWORD
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 4. Verify New Password Does NOT Work (Original Password Not Replaced) ---');
    // Test login via backend API with NEW password (MUST FAIL)
    const loginNewRes = await requestHttp(`${API_BASE}/auth/signin`, { method: 'POST' }, {
        email: testEmail,
        password: newPassword
    });
    assert(loginNewRes.status === 401, `Login with NEW password is rejected with HTTP 401 Unauthorized (got ${loginNewRes.status})`);
    assert(loginNewRes.body.success !== true, 'Login with new password did not succeed');

    // Test direct Firebase Authentication with NEW password (MUST FAIL)
    const fbLoginNew = await firebaseSignIn(testEmail, newPassword);
    assert(fbLoginNew.status === 400, `Firebase Authentication directly rejects new password (HTTP 400: ${fbLoginNew.body.error?.message})`);

    // ─────────────────────────────────────────────────────────────
    // 5. ONLY ONE FIREBASE AUTHENTICATION ACCOUNT EXISTS FOR THAT EMAIL
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 5. Verify Only One Account Exists in Firebase & SQLite ---');
    // Verify UID in Firebase matches the original UID
    assert(fbLoginOrig.body.localId === originalUid, 'Firebase UID is identical to initial registration (no new account was created)');

    // Verify SQLite still only has 1 record for this email
    const sqliteCount2 = await new Promise((resolve) => {
        db.all(`SELECT id, email, password, firebase_uid FROM users WHERE LOWER(email) = ?`, [testEmail.toLowerCase()], (err, rows) => {
            resolve(rows || []);
        });
    });
    assert(sqliteCount2.length === 1, 'Exactly 1 SQLite user record exists for this email');
    assert(sqliteCount2[0].firebase_uid === originalUid, 'SQLite record UID matches original Firebase UID');
    assert(sqliteCount2[0].password === originalPassword, 'SQLite record password was NOT replaced by new password');

    // ─────────────────────────────────────────────────────────────
    // 6. CLEAN UP TEST USER DATA (Preserve All Existing User Data)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 6. Clean Up Test User (Preserving All Existing User Data) ---');
    await new Promise((resolve) => {
        db.run(`DELETE FROM users WHERE LOWER(email) = ?`, [testEmail.toLowerCase()], resolve);
    });

    console.log('\n================================================================');
    console.log('ALL 14 DUPLICATE-EMAIL CHECKS PASSED SUCCESSFULLY!');
    console.log('================================================================');
    db.close();
}

run().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
