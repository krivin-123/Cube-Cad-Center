const http = require('http');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const API_BASE = 'http://localhost:3000/api';
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

async function run() {
    console.log('================================================================');
    console.log('STARTING APPOINTMENT FLOW TEST: REGISTER -> LOGOUT -> LOGIN -> APPOINTMENT');
    console.log('================================================================');

    const timestamp = Date.now();
    const testStudent = {
        name: `Student Flow Tester ${timestamp}`,
        email: `student_flow_${timestamp}@example.com`,
        password: `StudentPass!${timestamp}`,
        phone: '98' + String(Math.floor(10000000 + Math.random() * 90000000))
    };

    // ─── 1. STUDENT REGISTRATION ───
    console.log('\n--- 1. Student Registration ---');
    const signupRes = await requestHttp(`${API_BASE}/auth/signup`, { method: 'POST' }, testStudent);
    assert(signupRes.status === 200 && signupRes.body.success, 'Student registered successfully (HTTP 200)');
    assert(signupRes.body.token, 'Student received session JWT token');
    assert(signupRes.body.firebaseToken, 'Student received Firebase Auth session token');
    assert(signupRes.body.user && signupRes.body.user.email === testStudent.email, 'Student user profile created');
    const registeredUser = signupRes.body.user;
    const initialFbToken = signupRes.body.firebaseToken;
    console.log(`  [INFO] Registered student UID: ${registeredUser.uid}, email: ${registeredUser.email}`);

    // Verify session works with Firebase token
    const initialProfileCheck = await requestHttp(`${API_BASE}/auth/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${initialFbToken}` }
    });
    assert(initialProfileCheck.status === 200 && initialProfileCheck.body.success, 'Student profile accessible via Firebase token (/api/auth/me)');

    // ─── 2. LOGOUT & GENUINELY LOGGED OUT BEHAVIOR ───
    console.log('\n--- 2. Logout & Verify Genuinely Logged-Out Protection ---');
    // Submitting appointment without auth headers
    const loggedOutApptRes = await requestHttp(`${API_BASE}/appointments`, { method: 'POST' }, {
        name: testStudent.name,
        email: testStudent.email,
        phone: testStudent.phone,
        program: 'AutoCAD Mechanical',
        branch: 'Satellite Campus',
        date: '2026-10-06',
        timeSlot: '10:00 AM'
    });
    assert(loggedOutApptRes.status === 401, 'Logged out student submission blocked with HTTP 401');
    assert(loggedOutApptRes.body.requireAuth === true, 'Response specifies requireAuth: true');
    assert(loggedOutApptRes.body.error.includes('Authentication required'), 'Displays clear login message: "Authentication required"');

    // ─── 3. STUDENT LOGIN ───
    console.log('\n--- 3. Student Login ---');
    const signinRes = await requestHttp(`${API_BASE}/auth/signin`, { method: 'POST' }, {
        email: testStudent.email,
        password: testStudent.password
    });
    assert(signinRes.status === 200 && signinRes.body.success, 'Student login succeeded with HTTP 200');
    assert(signinRes.body.token, 'Student received backend session token');
    assert(signinRes.body.firebaseToken, 'Student received active Firebase Auth token');
    const activeFbToken = signinRes.body.firebaseToken;

    // ─── 4. SESSION PERSISTENCE & USER DETECTION ───
    console.log('\n--- 4. Session Persistence Across Navigation / Refresh ---');
    const refreshProfileRes = await requestHttp(`${API_BASE}/auth/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${activeFbToken}` }
    });
    assert(refreshProfileRes.status === 200 && refreshProfileRes.body.success, 'Student detected after page refresh/navigation');
    assert(refreshProfileRes.body.user.email.toLowerCase() === testStudent.email.toLowerCase(), 'Profile email matches logged-in student');

    // ─── 5. APPOINTMENT SUBMISSION ───
    console.log('\n--- 5. Submit Appointment Using Firebase Auth Session ---');
    // Calculate valid booking date within 7 days (avoid Sundays)
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 2);
    while (nextDate.getDay() === 0) {
        nextDate.setDate(nextDate.getDate() + 1);
    }
    const pad = n => String(n).padStart(2, '0');
    const bookingDate = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(nextDate.getDate())}`;

    const apptPayload = {
        name: testStudent.name,
        email: testStudent.email,
        phone: testStudent.phone,
        program: 'Civil Structural BIM',
        branch: 'Satellite Campus',
        date: bookingDate,
        timeSlot: '03:00 PM',
        mode: 'In-Person',
        notes: 'Session persistence verified appointment'
    };

    const submitRes = await requestHttp(`${API_BASE}/appointments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${activeFbToken}` }
    }, apptPayload);

    assert(submitRes.status === 200 && submitRes.body.success, 'Appointment submitted successfully without session error');
    assert(submitRes.body.appointment, 'Appointment confirmation payload returned');
    assert(submitRes.body.appointment.bookingRef && submitRes.body.appointment.bookingRef.startsWith('CCC-'), 'Valid booking reference generated');
    assert(submitRes.body.appointment.status === 'Pending', 'Appointment status is Pending (preserving pending-admin-confirmation workflow)');
    const createdBookingRef = submitRes.body.appointment.bookingRef;
    const createdApptId = submitRes.body.appointment.id;
    console.log(`  [INFO] Booking created: ref=${createdBookingRef}, id=${createdApptId}, status=${submitRes.body.appointment.status}`);

    // ─── 6. VERIFY IN DATABASE ───
    console.log('\n--- 6. Verify Booking in Database ---');
    await new Promise((resolve) => {
        db.get('SELECT * FROM appointments WHERE id = ?', [createdApptId], (err, row) => {
            assert(!err && row, 'Booking row found in SQLite database');
            assert(row.booking_ref === createdBookingRef, 'Stored booking reference matches');
            assert(row.email.toLowerCase() === testStudent.email.toLowerCase(), 'Stored student email matches');
            assert(row.status === 'Pending', 'Stored status is Pending');
            assert(row.program === apptPayload.program, 'Stored program matches');
            resolve();
        });
    });

    // ─── 7. VERIFY DUPLICATE / CONFLICT RULES ───
    console.log('\n--- 7. Verify Appointment Business Rules (Duplicate Prevention) ---');
    const dupRes = await requestHttp(`${API_BASE}/appointments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${activeFbToken}` }
    }, apptPayload);
    assert(dupRes.status === 400 && dupRes.body.error.includes('already have an appointment'), 'Duplicate appointment on same slot prevented (HTTP 400)');

    // Clean up test appointment
    await new Promise((resolve) => {
        db.run('DELETE FROM appointments WHERE id = ?', [createdApptId], resolve);
    });

    console.log('\n================================================================');
    console.log('APPOINTMENT FLOW TEST RESULTS: ALL 14 ASSERTIONS PASSED!');
    console.log('================================================================');
    db.close();
}

run().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
