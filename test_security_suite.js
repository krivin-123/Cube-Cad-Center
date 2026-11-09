/**
 * Automated Security & Access Control Verification Test Suite
 * Tests:
 * 1. Student Registration & Profile
 * 2. Student Access Restrictions: Student CANNOT access ANY Admin or Caller endpoints (403 Forbidden)
 * 3. Admin Authentication & Multi-Caller Account Provisioning (No passwords exposed)
 * 4. Telecaller Individual Logins (Shared PIN rejected)
 * 5. Appointment & Customer Assignment to Callers
 * 6. Scoped Access & URL/API ID Tampering Prevention (Horizontal Privilege Escalation returns 403 Forbidden)
 * 7. Telecaller Activity Logging in Admin Audit Trail
 * 8. Admin Reset Caller Password in Firebase Auth
 * 9. Real-time Account Deactivation & Active JWT Session Revocation
 * 10. Account Reactivation & Cleanup
 */

require('dotenv').config();
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const { spawn } = require('child_process');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'cubecadcenter0711@gmail.com').toLowerCase().trim();
const ADMIN_PASS = process.env.ADMIN_PASSWORD;

function generateRandomPassword() {
    return 'Sec_' + crypto.randomBytes(8).toString('hex') + '#9X!';
}

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    if (condition) {
        passCount++;
        console.log(`  [PASS] ${message}`);
    } else {
        failCount++;
        console.error(`  [FAIL] ${message}`);
    }
}

function request(options, bodyData = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(options.path, BASE_URL);
        const reqOpts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: Object.assign({}, options.headers || {})
        };

        let jsonPayload = null;
        if (bodyData) {
            jsonPayload = JSON.stringify(bodyData);
            reqOpts.headers['Content-Type'] = 'application/json';
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
    });
}

async function runSuite() {
    console.log('================================================================');
    console.log('STARTING AUTOMATED SECURITY & AUTHENTICATION TEST SUITE');
    console.log('Target: ' + BASE_URL);
    console.log('================================================================\n');

    let mainProc = null;
    try {
        await request({ path: '/api/health', method: 'GET' });
    } catch (e) {
        mainProc = spawn('node', [path.resolve(__dirname, 'server.js')], {
            cwd: __dirname,
            env: Object.assign({}, process.env, { PORT: '3000' }),
            stdio: ['ignore', 'pipe', 'pipe']
        });
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 250));
            try {
                const h = await request({ path: '/api/health', method: 'GET' });
                if (h.status === 200) break;
            } catch (err) {}
        }
    }

    try {
    const testRunId = Date.now().toString().slice(-6);

    let studentToken = null;
    let adminToken = null;
    let caller1Id = null;
    let caller1Token = null;
    let caller2Id = null;
    let caller2Token = null;
    let appt1Id = null;
    let appt2Id = null;
    let cust1Id = null;
    let cust2Id = null;

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Student Account Creation & Authentication
    // ─────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Student Registration & Profile ---');
    const studentEmail = `student_${testRunId}@example.com`;
    const studentPass = generateRandomPassword();
    const studentSignup = await request({ path: '/api/auth/signup', method: 'POST' }, {
        name: `Test Student ${testRunId}`,
        email: studentEmail,
        password: studentPass,
        phone: '9876500001'
    });

    assert(studentSignup.status === 200 && studentSignup.body.success, 'Student signup succeeds with HTTP 200');
    assert(studentSignup.body.token != null, 'Student receives valid JWT session token');
    studentToken = studentSignup.body.token;

    // Verify student profile
    const studentProfile = await request({
        path: '/api/auth/me',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert(studentProfile.status === 200 && studentProfile.body.user.email === studentEmail, 'Student can access own profile (/api/auth/me)');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Student Access Restrictions (Student CANNOT access Admin or Caller endpoints)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: Student Access Control (Forbidden from Admin & Caller Endpoints) ---');
    const studentHeaders = { 'Authorization': `Bearer ${studentToken}` };

    // 2.1 Admin endpoints blocked for students
    const admMeRes = await request({ path: '/api/admin/me', method: 'GET', headers: studentHeaders });
    assert(admMeRes.status === 403, 'Student blocked from GET /api/admin/me (HTTP 403)');

    const admCallersRes = await request({ path: '/api/admin/callers', method: 'GET', headers: studentHeaders });
    assert(admCallersRes.status === 403, 'Student blocked from GET /api/admin/callers (HTTP 403)');

    const admApptsRes = await request({ path: '/api/admin/appointments', method: 'GET', headers: studentHeaders });
    assert(admApptsRes.status === 403, 'Student blocked from GET /api/admin/appointments (HTTP 403)');

    const admActivitiesRes = await request({ path: '/api/admin/caller-activities', method: 'GET', headers: studentHeaders });
    assert(admActivitiesRes.status === 403, 'Student blocked from GET /api/admin/caller-activities (HTTP 403)');

    const admCreateCallerRes = await request({ path: '/api/admin/callers', method: 'POST', headers: studentHeaders }, {
        name: 'Hacker Caller', email: 'hacker@test.com', password: 'password123'
    });
    assert(admCreateCallerRes.status === 403, 'Student blocked from POST /api/admin/callers (HTTP 403)');

    const admAssignRes = await request({ path: '/api/admin/assign', method: 'POST', headers: studentHeaders }, {
        type: 'appointment', id: 1, caller_id: 1
    });
    assert(admAssignRes.status === 403, 'Student blocked from POST /api/admin/assign (HTTP 403)');

    // 2.2 Caller endpoints blocked for students
    const callerApptsRes = await request({ path: '/api/caller/appointments', method: 'GET', headers: studentHeaders });
    assert(callerApptsRes.status === 403, 'Student blocked from GET /api/caller/appointments (HTTP 403)');

    const callerApptDetailRes = await request({ path: '/api/caller/appointments/1', method: 'GET', headers: studentHeaders });
    assert(callerApptDetailRes.status === 403, 'Student blocked from GET /api/caller/appointments/:id (HTTP 403)');

    const callerCallLogRes = await request({ path: '/api/caller/appointments/1/call-log', method: 'PATCH', headers: studentHeaders }, {
        call_status: 'Connected', call_notes: 'Unauthorized edit'
    });
    assert(callerCallLogRes.status === 403, 'Student blocked from PATCH /api/caller/appointments/:id/call-log (HTTP 403)');

    const callerCustsRes = await request({ path: '/api/caller/customers', method: 'GET', headers: studentHeaders });
    assert(callerCustsRes.status === 403, 'Student blocked from GET /api/caller/customers (HTTP 403)');

    const callerCustDetailRes = await request({ path: '/api/caller/customers/1', method: 'GET', headers: studentHeaders });
    assert(callerCustDetailRes.status === 403, 'Student blocked from GET /api/caller/customers/:id (HTTP 403)');

    const callerCustUpdateRes = await request({ path: '/api/caller/customers/1', method: 'PATCH', headers: studentHeaders }, {
        status: 'Enrolled'
    });
    assert(callerCustUpdateRes.status === 403, 'Student blocked from PATCH /api/caller/customers/:id (HTTP 403)');

    const callerCustNoteRes = await request({ path: '/api/caller/customers/1/note', method: 'POST', headers: studentHeaders }, {
        note: 'Unauthorized note'
    });
    assert(callerCustNoteRes.status === 403, 'Student blocked from POST /api/caller/customers/:id/note (HTTP 403)');

    const callerStatsRes = await request({ path: '/api/caller/stats', method: 'GET', headers: studentHeaders });
    assert(callerStatsRes.status === 403, 'Student blocked from GET /api/caller/stats (HTTP 403)');

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Admin Sign-In & Multiple Caller Account Provisioning
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Admin Sign-In & Multi-Caller Creation ---');
    const adminLogin = await request({ path: '/api/auth/signin', method: 'POST' }, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASS
    });

    assert(adminLogin.status === 200 && adminLogin.body.isAdmin === true, 'Admin sign-in succeeds with isAdmin: true');
    adminToken = adminLogin.body.token;
    const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };

    // Create Caller 1
    const caller1Email = `caller1_${testRunId}@cubecadcenter.com`;
    const caller1Pass = generateRandomPassword();
    const createCaller1 = await request({ path: '/api/admin/callers', method: 'POST', headers: adminHeaders }, {
        name: `Caller One ${testRunId}`,
        email: caller1Email,
        password: caller1Pass,
        status: 'Active'
    });
    assert(createCaller1.status === 200 && createCaller1.body.success, 'Admin creates Caller 1 with HTTP 200');
    caller1Id = createCaller1.body.caller.id;
    assert(createCaller1.body.caller.password == null, 'Caller password is NOT exposed in create caller response');

    // Create Caller 2
    const caller2Email = `caller2_${testRunId}@cubecadcenter.com`;
    const caller2Pass = generateRandomPassword();
    const createCaller2 = await request({ path: '/api/admin/callers', method: 'POST', headers: adminHeaders }, {
        name: `Caller Two ${testRunId}`,
        email: caller2Email,
        password: caller2Pass,
        status: 'Active'
    });
    assert(createCaller2.status === 200 && createCaller2.body.success, 'Admin creates Caller 2 with HTTP 200');
    caller2Id = createCaller2.body.caller.id;
    assert(createCaller2.body.caller.password == null, 'Caller 2 password is NOT exposed in create caller response');

    // List callers as Admin
    const callersList = await request({ path: '/api/admin/callers', method: 'GET', headers: adminHeaders });
    assert(callersList.status === 200 && Array.isArray(callersList.body.callers), 'Admin can list callers');
    const foundC1 = callersList.body.callers.find(c => c.id === caller1Id);
    const foundC2 = callersList.body.callers.find(c => c.id === caller2Id);
    assert(foundC1 != null && foundC2 != null, 'Both Caller 1 and Caller 2 present in callers directory');
    assert(foundC1 && foundC1.password == null, 'Caller passwords are NEVER exposed in GET /api/admin/callers');

    // ─────────────────────────────────────────────────────────────
    // TEST 4: Telecaller Individual Authentication (No Shared PIN)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Telecaller Authentication (Individual Email & Password) ---');

    // Attempt login with missing password or PIN
    const pinAttempt = await request({ path: '/api/caller/auth/login', method: 'POST' }, {
        email: caller1Email,
        pin: '0000' // Legacy PIN attempt without password
    });
    assert(pinAttempt.status === 400, 'Login using only PIN without password is rejected (HTTP 400)');

    // Caller 1 logs in with individual email & password
    const loginC1 = await request({ path: '/api/caller/auth/login', method: 'POST' }, {
        email: caller1Email,
        password: caller1Pass
    });
    assert(loginC1.status === 200 && loginC1.body.success, 'Caller 1 logs in successfully with individual credentials');
    assert(loginC1.body.token != null, 'Caller 1 receives JWT token');
    caller1Token = loginC1.body.token;

    // Caller 2 logs in with individual email & password
    const loginC2 = await request({ path: '/api/caller/auth/login', method: 'POST' }, {
        email: caller2Email,
        password: caller2Pass
    });
    assert(loginC2.status === 200 && loginC2.body.success, 'Caller 2 logs in successfully with individual credentials');
    assert(loginC2.body.token != null, 'Caller 2 receives JWT token');
    caller2Token = loginC2.body.token;

    // ─────────────────────────────────────────────────────────────
    // TEST 5: Create Leads & Assign to Callers
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: Create Leads & Assign to Individual Callers ---');
    const c1Headers = { 'Authorization': `Bearer ${caller1Token}` };
    const c2Headers = { 'Authorization': `Bearer ${caller2Token}` };

    // Get a valid upcoming weekday date (within next 7 days, avoiding Sundays)
    const bookingDateObj = new Date();
    bookingDateObj.setDate(bookingDateObj.getDate() + 2);
    while (bookingDateObj.getDay() === 0) {
        bookingDateObj.setDate(bookingDateObj.getDate() + 1);
    }
    const pad = n => String(n).padStart(2, '0');
    const validBookingDate = `${bookingDateObj.getFullYear()}-${pad(bookingDateObj.getMonth() + 1)}-${pad(bookingDateObj.getDate())}`;

    // Student books Appointment 1
    const appt1Res = await request({ path: '/api/appointments', method: 'POST', headers: studentHeaders }, {
        name: `Appointment One ${testRunId}`,
        email: `student_lead1_${testRunId}@example.com`,
        phone: '9876511111',
        program: 'AutoCAD',
        branch: 'Satellite Branch',
        date: validBookingDate,
        timeSlot: '10:00 AM',
        time_slot: '10:00 AM',
        mode: 'Offline Class',
        notes: 'Lead for Caller 1',
        consent: true
    });
    assert(appt1Res.status === 200 && appt1Res.body.success, 'Student books Appointment 1');
    appt1Id = appt1Res.body.appointment ? appt1Res.body.appointment.id : appt1Res.body.appointmentId;

    // Student books Appointment 2
    const appt2Res = await request({ path: '/api/appointments', method: 'POST', headers: studentHeaders }, {
        name: `Appointment Two ${testRunId}`,
        email: `student_lead2_${testRunId}@example.com`,
        phone: '9876522222',
        program: 'SolidWorks & Mechanical CAD',
        branch: 'Bopal Branch',
        date: validBookingDate,
        timeSlot: '11:00 AM',
        time_slot: '11:00 AM',
        mode: 'Offline Class',
        notes: 'Lead for Caller 2',
        consent: true
    });
    assert(appt2Res.status === 200 && appt2Res.body.success, 'Student books Appointment 2');
    appt2Id = appt2Res.body.appointment ? appt2Res.body.appointment.id : appt2Res.body.appointmentId;

    // Admin creates Customer 1
    const cust1Res = await request({ path: '/api/admin/customers', method: 'POST', headers: adminHeaders }, {
        name: `Customer Alpha ${testRunId}`,
        mobile: '9876533333',
        email: `cust_alpha_${testRunId}@example.com`,
        course: 'Revit BIM',
        status: 'Lead',
        notes: 'Assigned to Caller 1'
    });
    assert(cust1Res.status === 200, 'Admin creates Customer 1');
    cust1Id = cust1Res.body.id;

    // Admin creates Customer 2
    const cust2Res = await request({ path: '/api/admin/customers', method: 'POST', headers: adminHeaders }, {
        name: `Customer Beta ${testRunId}`,
        mobile: '9876544444',
        email: `cust_beta_${testRunId}@example.com`,
        course: 'STAAD.Pro',
        status: 'Lead',
        notes: 'Assigned to Caller 2'
    });
    assert(cust2Res.status === 200, 'Admin creates Customer 2');
    cust2Id = cust2Res.body.id;

    // Admin assigns Appointment 1 to Caller 1
    const assignAppt1 = await request({ path: '/api/admin/assign', method: 'POST', headers: adminHeaders }, {
        type: 'appointment',
        id: appt1Id,
        caller_id: caller1Id
    });
    assert(assignAppt1.status === 200 && assignAppt1.body.assigned_caller_id === caller1Id, 'Admin assigns Appointment 1 to Caller 1');

    // Admin assigns Appointment 2 to Caller 2
    const assignAppt2 = await request({ path: '/api/admin/assign', method: 'POST', headers: adminHeaders }, {
        type: 'appointment',
        id: appt2Id,
        caller_id: caller2Id
    });
    assert(assignAppt2.status === 200 && assignAppt2.body.assigned_caller_id === caller2Id, 'Admin assigns Appointment 2 to Caller 2');

    // Admin assigns Customer 1 to Caller 1
    const assignCust1 = await request({ path: '/api/admin/assign', method: 'POST', headers: adminHeaders }, {
        type: 'customer',
        id: cust1Id,
        caller_id: caller1Id
    });
    assert(assignCust1.status === 200 && assignCust1.body.assigned_caller_id === caller1Id, 'Admin assigns Customer 1 to Caller 1');

    // Admin assigns Customer 2 to Caller 2
    const assignCust2 = await request({ path: '/api/admin/assign', method: 'POST', headers: adminHeaders }, {
        type: 'customer',
        id: cust2Id,
        caller_id: caller2Id
    });
    assert(assignCust2.status === 200 && assignCust2.body.assigned_caller_id === caller2Id, 'Admin assigns Customer 2 to Caller 2');

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Scoped Access & URL / API Parameter ID Tampering Prevention
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 6: Scoped Caller Access & URL ID Tampering Prevention ---');

    // 6.1 Caller 1 lists appointments: should see Appt 1, NOT Appt 2
    const c1Appts = await request({ path: '/api/caller/appointments', method: 'GET', headers: c1Headers });
    assert(c1Appts.status === 200, 'Caller 1 lists appointments with HTTP 200');
    const c1ApptIds = (c1Appts.body.appointments || []).map(a => a.id);
    assert(c1ApptIds.includes(appt1Id), 'Caller 1 can see assigned Appointment 1 in list');
    assert(!c1ApptIds.includes(appt2Id), 'Caller 1 CANNOT see Caller 2\'s Appointment 2 in list');

    // 6.2 Caller 2 lists appointments: should see Appt 2, NOT Appt 1
    const c2Appts = await request({ path: '/api/caller/appointments', method: 'GET', headers: c2Headers });
    assert(c2Appts.status === 200, 'Caller 2 lists appointments with HTTP 200');
    const c2ApptIds = (c2Appts.body.appointments || []).map(a => a.id);
    assert(c2ApptIds.includes(appt2Id), 'Caller 2 can see assigned Appointment 2 in list');
    assert(!c2ApptIds.includes(appt1Id), 'Caller 2 CANNOT see Caller 1\'s Appointment 1 in list');

    // 6.3 Caller 1 lists customers: should see Cust 1, NOT Cust 2
    const c1Custs = await request({ path: '/api/caller/customers', method: 'GET', headers: c1Headers });
    assert(c1Custs.status === 200, 'Caller 1 lists customers with HTTP 200');
    const c1CustIds = (c1Custs.body.customers || []).map(c => c.id);
    assert(c1CustIds.includes(cust1Id), 'Caller 1 can see assigned Customer 1 in list');
    assert(!c1CustIds.includes(cust2Id), 'Caller 1 CANNOT see Caller 2\'s Customer 2 in list');

    // 6.4 Caller 1 accesses own assigned Appointment 1 directly: 200 OK
    const c1GetAppt1 = await request({ path: `/api/caller/appointments/${appt1Id}`, method: 'GET', headers: c1Headers });
    assert(c1GetAppt1.status === 200, 'Caller 1 can access own assigned Appointment 1 (HTTP 200)');

    // 6.5 Caller 1 updates own assigned Appointment 1 call-log: 200 OK
    const c1LogAppt1 = await request({ path: `/api/caller/appointments/${appt1Id}/call-log`, method: 'PATCH', headers: c1Headers }, {
        call_status: 'Connected',
        call_notes: 'Spoke with student, interested in morning batch'
    });
    assert(c1LogAppt1.status === 200 && c1LogAppt1.body.success, 'Caller 1 can update own assigned Appointment 1 call log (HTTP 200)');

    // 6.6 Caller 1 accesses own assigned Customer 1 directly: 200 OK
    const c1GetCust1 = await request({ path: `/api/caller/customers/${cust1Id}`, method: 'GET', headers: c1Headers });
    assert(c1GetCust1.status === 200, 'Caller 1 can access own assigned Customer 1 (HTTP 200)');

    // 6.7 Caller 1 updates own assigned Customer 1 note: 200 OK
    const c1NoteCust1 = await request({ path: `/api/caller/customers/${cust1Id}/note`, method: 'POST', headers: c1Headers }, {
        note: 'Follow-up scheduled for next Monday'
    });
    assert(c1NoteCust1.status === 200 && c1NoteCust1.body.success, 'Caller 1 can add note to own assigned Customer 1 (HTTP 200)');

    // ─────────────────────────────────────────────────────────────
    // CRITICAL ID TAMPERING TESTS (Horizontal Privilege Escalation)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- CRITICAL VERIFICATION: ID Tampering Prevention (Horizontal Privilege Escalation) ---');

    // Tampering Test 1: Caller 1 changes URL ID to view Caller 2's Appointment 2
    const tamperGetAppt = await request({ path: `/api/caller/appointments/${appt2Id}`, method: 'GET', headers: c1Headers });
    assert(tamperGetAppt.status === 403, `Caller 1 GET /api/caller/appointments/${appt2Id} (Caller 2's appt) BLOCKED with HTTP 403`);

    // Tampering Test 2: Caller 1 changes URL ID to modify Caller 2's Appointment 2 call-log
    const tamperLogAppt = await request({ path: `/api/caller/appointments/${appt2Id}/call-log`, method: 'PATCH', headers: c1Headers }, {
        call_status: 'Connected',
        call_notes: 'Tampered note attempt by Caller 1'
    });
    assert(tamperLogAppt.status === 403, `Caller 1 PATCH /api/caller/appointments/${appt2Id}/call-log (Caller 2's appt) BLOCKED with HTTP 403`);

    // Tampering Test 3: Caller 1 changes URL ID to view Caller 2's Customer 2
    const tamperGetCust = await request({ path: `/api/caller/customers/${cust2Id}`, method: 'GET', headers: c1Headers });
    assert(tamperGetCust.status === 403, `Caller 1 GET /api/caller/customers/${cust2Id} (Caller 2's cust) BLOCKED with HTTP 403`);

    // Tampering Test 4: Caller 1 changes URL ID to update Caller 2's Customer 2 status
    const tamperUpdateCust = await request({ path: `/api/caller/customers/${cust2Id}`, method: 'PATCH', headers: c1Headers }, {
        status: 'Enrolled'
    });
    assert(tamperUpdateCust.status === 403, `Caller 1 PATCH /api/caller/customers/${cust2Id} (Caller 2's cust) BLOCKED with HTTP 403`);

    // Tampering Test 5: Caller 1 changes URL ID to add note to Caller 2's Customer 2
    const tamperNoteCust = await request({ path: `/api/caller/customers/${cust2Id}/note`, method: 'POST', headers: c1Headers }, {
        note: 'Malicious note from Caller 1'
    });
    assert(tamperNoteCust.status === 403, `Caller 1 POST /api/caller/customers/${cust2Id}/note (Caller 2's cust) BLOCKED with HTTP 403`);

    // Tampering Test 6 (Reverse): Caller 2 changes URL ID to view Caller 1's Appointment 1
    const tamperGetAppt2 = await request({ path: `/api/caller/appointments/${appt1Id}`, method: 'GET', headers: c2Headers });
    assert(tamperGetAppt2.status === 403, `Caller 2 GET /api/caller/appointments/${appt1Id} (Caller 1's appt) BLOCKED with HTTP 403`);

    // Tampering Test 7 (Reverse): Caller 2 changes URL ID to view Caller 1's Customer 1
    const tamperGetCust2 = await request({ path: `/api/caller/customers/${cust1Id}`, method: 'GET', headers: c2Headers });
    assert(tamperGetCust2.status === 403, `Caller 2 GET /api/caller/customers/${cust1Id} (Caller 1's cust) BLOCKED with HTTP 403`);

    // ─────────────────────────────────────────────────────────────
    // TEST 7: Telecaller Activity Audit Trail
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 7: Caller Activity Audit Trail ---');
    const auditRes = await request({ path: `/api/admin/caller-activities?caller_id=${caller1Id}`, method: 'GET', headers: adminHeaders });
    assert(auditRes.status === 200 && Array.isArray(auditRes.body.activities), 'Admin can fetch caller audit trail (HTTP 200)');
    const acts = auditRes.body.activities;
    const hasLogin = acts.some(a => a.action === 'LOGIN');
    const hasCallLog = acts.some(a => a.action === 'CALL_LOG');
    const hasNote = acts.some(a => a.action === 'NOTE_ADDED');
    assert(hasLogin, 'Audit trail contains Caller 1 LOGIN event');
    assert(hasCallLog, 'Audit trail contains Caller 1 CALL_LOG event');
    assert(hasNote, 'Audit trail contains Caller 1 NOTE_ADDED event');

    // ─────────────────────────────────────────────────────────────
    // TEST 8: Admin Caller Password Reset in Firebase Auth
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 8: Admin Password Reset for Caller ---');
    const newCaller2Pass = generateRandomPassword();
    const resetRes = await request({ path: `/api/admin/callers/${caller2Id}/reset-password`, method: 'POST', headers: adminHeaders }, {
        newPassword: newCaller2Pass
    });
    assert(resetRes.status === 200 && resetRes.body.success, 'Admin resets Caller 2 password via Firebase Auth API (HTTP 200)');

    // ─────────────────────────────────────────────────────────────
    // TEST 9: Real-Time Account Deactivation & Session Revocation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 9: Account Deactivation & Active JWT Session Revocation ---');

    // Admin deactivates Caller 1
    const deactRes = await request({ path: `/api/admin/callers/${caller1Id}/status`, method: 'PATCH', headers: adminHeaders }, {
        status: 'Inactive'
    });
    assert(deactRes.status === 200 && deactRes.body.status === 'Inactive', 'Admin sets Caller 1 status to Inactive (HTTP 200)');

    // CRITICAL: Caller 1 tries to make API call with their EXISTING active JWT token
    const revokedSessionCheck = await request({ path: '/api/caller/appointments', method: 'GET', headers: c1Headers });
    assert(revokedSessionCheck.status === 403, 'Deactivated Caller 1 existing JWT token IMMEDIATELY returns HTTP 403');
    assert(revokedSessionCheck.body.deactivated === true, 'Revocation response indicates deactivated: true');

    // Caller 1 tries to log in again with their credentials
    const reLoginAttempt = await request({ path: '/api/caller/auth/login', method: 'POST' }, {
        email: caller1Email,
        password: caller1Pass
    });
    assert(reLoginAttempt.status === 403 && reLoginAttempt.body.deactivated === true, 'Deactivated caller cannot sign in (HTTP 403 deactivated: true)');

    // Reactivate Caller 1
    const reactRes = await request({ path: `/api/admin/callers/${caller1Id}/status`, method: 'PATCH', headers: adminHeaders }, {
        status: 'Active'
    });
    assert(reactRes.status === 200 && reactRes.body.status === 'Active', 'Admin reactivates Caller 1 account (HTTP 200)');

    // Caller 1 can now sign in and access leads again
    const postReactivateLogin = await request({ path: '/api/caller/auth/login', method: 'POST' }, {
        email: caller1Email,
        password: caller1Pass
    });
    assert(postReactivateLogin.status === 200 && postReactivateLogin.body.success, 'Reactivated Caller 1 can sign in successfully (HTTP 200)');

    // ─────────────────────────────────────────────────────────────
    // TEST 10: Delete Caller Account & Auto-Unassign Leads
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 10: Delete Caller & Lead Reassignment Safety ---');
    const deleteCaller2 = await request({ path: `/api/admin/callers/${caller2Id}`, method: 'DELETE', headers: adminHeaders });
    assert(deleteCaller2.status === 200 && deleteCaller2.body.success, 'Admin deletes Caller 2 (HTTP 200)');

    // Verify Appointment 2 was safely unassigned to 0 ('Unassigned')
    const checkAppt2 = await request({ path: `/api/admin/appointments`, method: 'GET', headers: adminHeaders });
    const unassignedAppt = (checkAppt2.body.appointments || []).find(a => a.id === appt2Id);
    assert(unassignedAppt && unassignedAppt.assigned_caller_id === 0, 'Deleted caller\'s appointment was safely reset to Unassigned');

    // Clean up Caller 1
    await request({ path: `/api/admin/callers/${caller1Id}`, method: 'DELETE', headers: adminHeaders });

    // Clean up test appointments
    if (appt1Id) await request({ path: `/api/admin/appointments/${appt1Id}`, method: 'DELETE', headers: adminHeaders });
    if (appt2Id) await request({ path: `/api/admin/appointments/${appt2Id}`, method: 'DELETE', headers: adminHeaders });

    } finally {
        if (mainProc) {
            mainProc.kill();
        }
    }

    console.log('\n================================================================');
    console.log(`TEST SUITE FINISHED: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('================================================================\n');

    if (failCount > 0) {
        process.exit(1);
    }
}

runSuite().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
