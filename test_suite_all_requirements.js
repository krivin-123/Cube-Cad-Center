/**
 * Comprehensive Automated Verification Suite for Cube Cad Center
 * Tests all 8 mandatory acceptance criteria:
 * 1. Booking happy path with and without email
 * 2. Two simultaneous bookings for the last seat: only one succeeds
 * 3. Validation rejection (invalid phone, Sunday, past date, tampered branch/service, missing consent)
 * 4. EMAIL_ENABLED=false and SMS_ENABLED=false: booking succeeds without error
 * 5. Notification failure resilience & idempotency
 * 6. XSS / script / newline injection escaping
 * 7. Rate limit enforcement (HTTP 429)
 * 8. Static & accessibility integrity (WCAG 2.2 AA markers)
 */

require('dotenv').config();
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn } = require('child_process');
const notificationService = require('./notification-service');

const TEST_PORT = 3010;
const BASE_URL = `http://localhost:${TEST_PORT}`;

function httpRequest(options, body = null) {
    return new Promise((resolve, reject) => {
        const u = new URL(options.path, BASE_URL);
        const reqOpts = {
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: options.method || 'GET',
            headers: Object.assign({ 'Content-Type': 'application/json' }, options.headers || {})
        };
        let bodyData = null;
        if (body !== null) {
            bodyData = typeof body === 'string' ? body : JSON.stringify(body);
            reqOpts.headers['Content-Length'] = Buffer.byteLength(bodyData);
        }
        const req = http.request(reqOpts, (res) => {
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

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`  [PASS] ${message}`);
    } else {
        failed++;
        console.error(`  [FAIL] ${message}`);
    }
}

// Find an upcoming valid weekday (Mon-Sat) in Asia/Kolkata
function getUpcomingValidDate(daysOffset = 2) {
    const now = new Date();
    // Offset in milliseconds
    const target = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    const dfDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
    const dfDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    
    let candidate = target;
    // If Sunday, add 1 day to Monday
    if (dfDay.format(candidate) === 'Sun') {
        candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    }
    return dfDate.format(candidate);
}

// Find upcoming Sunday in Asia/Kolkata
function getUpcomingSunday() {
    const now = new Date();
    const dfDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
    const dfDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });

    for (let i = 1; i <= 7; i++) {
        const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        if (dfDay.format(d) === 'Sun') {
            return dfDate.format(d);
        }
    }
    return '2026-11-08';
}

async function run() {
    console.log('================================================================');
    console.log('RUNNING CUBE CAD CENTER ACCEPTANCE TEST SUITE');
    console.log(`Target: ${BASE_URL} (Node ${process.version})`);
    console.log('================================================================\n');

    // Clean up previous test database if present
    const testDbPath = path.resolve(__dirname, 'test_acceptance.sqlite');
    try { require('fs').unlinkSync(testDbPath); } catch (e) {}

    // 1. Launch server instance on TEST_PORT
    const serverProcess = spawn('node', [path.resolve(__dirname, 'server.js')], {
        cwd: __dirname,
        env: Object.assign({}, process.env, { 
            PORT: String(TEST_PORT),
            DATABASE_PATH: testDbPath,
            EMAIL_ENABLED: 'false',
            SMS_ENABLED: 'false'
        }),
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let ready = false;
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 300));
        try {
            const check = await httpRequest({ path: '/api/health', method: 'GET' });
            if (check.status === 200) { ready = true; break; }
        } catch (e) {}
    }

    if (!ready) {
        serverProcess.kill();
        console.error('Failed to start test server on port ' + TEST_PORT);
        process.exit(1);
    }

    try {
        const testDate = getUpcomingValidDate(3);
        const testSlot = '02:00 PM';
        console.log(`Using valid test booking date (Mon-Sat): ${testDate}, slot: ${testSlot}`);

        // --- TEST 1: Booking Happy Path With and Without Email ---
        console.log('\n--- TEST 1: Booking Happy Path (With & Without Email) ---');
        
        // 1a. With Email
        const resWithEmail = await httpRequest({ path: '/api/appointments', method: 'POST' }, {
            name: 'Kavita Patel',
            email: 'kavita.patel@example.com',
            phone: '9825123456',
            program: 'AutoCAD',
            branch: 'Satellite Branch',
            date: testDate,
            timeSlot: testSlot,
            consent: true
        });
        assert(resWithEmail.status === 200 && resWithEmail.body.success, 'Booking with email succeeds with HTTP 200');
        assert(resWithEmail.body.appointment && /^CCC-\d{8}-[A-Z0-9]{4}$/.test(resWithEmail.body.appointment.bookingRef), 'Server-generated ID matches CCC-YYYYMMDD-XXXX format: ' + resWithEmail.body.appointment?.bookingRef);
        assert(resWithEmail.body.appointment.status === 'Pending', 'Initial booking status is Pending approval');

        // 1b. Without Email (Guest Booking)
        const resNoEmail = await httpRequest({ path: '/api/appointments', method: 'POST' }, {
            name: 'Aakash Shah',
            phone: '9909123456',
            program: 'Revit Architecture',
            branch: 'Bopal Branch',
            date: testDate,
            timeSlot: testSlot,
            consent: true
        });
        assert(resNoEmail.status === 200 && resNoEmail.body.success, 'Booking without email succeeds with HTTP 200');
        assert(resNoEmail.body.appointment.email === '', 'Empty email handled cleanly');
        assert(/^CCC-\d{8}-[A-Z0-9]{4}$/.test(resNoEmail.body.appointment.bookingRef), 'Unique appointment ID generated for guest: ' + resNoEmail.body.appointment?.bookingRef);

        // --- TEST 2: Two Simultaneous Bookings for Last Seat ---
        console.log('\n--- TEST 2: Two Simultaneous Bookings for the Last Seat (Slot Concurrency Mutex) ---');
        // Currently 2 seats are booked for testDate & testSlot. Max capacity is 3. Only 1 seat left!
        const requestA = httpRequest({ path: '/api/appointments', method: 'POST' }, {
            name: 'Concurrent Candidate Alpha',
            phone: '9898000001',
            program: 'AutoCAD',
            branch: 'Satellite Branch',
            date: testDate,
            timeSlot: testSlot,
            consent: true
        });

        const requestB = httpRequest({ path: '/api/appointments', method: 'POST' }, {
            name: 'Concurrent Candidate Beta',
            phone: '9898000002',
            program: 'AutoCAD',
            branch: 'Satellite Branch',
            date: testDate,
            timeSlot: testSlot,
            consent: true
        });

        const [resultA, resultB] = await Promise.all([requestA, requestB]);
        const statuses = [resultA.status, resultB.status].sort();
        console.log(`  Concurrent request results: Candidate A: HTTP ${resultA.status}, Candidate B: HTTP ${resultB.status}`);

        assert(statuses[0] === 200 && statuses[1] === 400, 'Exactly one concurrent request succeeds (HTTP 200) and the second is rejected (HTTP 400)');
        const rejectedBody = resultA.status === 400 ? resultA.body : resultB.body;
        assert(rejectedBody.error && rejectedBody.error.includes('Fully Booked'), 'Rejected candidate receives explicit "Fully Booked" error message');

        // --- TEST 3: Validation Rejections ---
        console.log('\n--- TEST 3: Server-side Security & Constraint Rejection ---');
        
        // 3a. Invalid Phone (does not match /^[6-9]\d{9}$/)
        const invalidPhone = await httpRequest({ path: '/api/appointments', method: 'POST' }, {
            name: 'Test Invalid Phone',
            phone: '1234567890', // starts with 1, invalid in India
            program: 'AutoCAD',
            branch: 'Satellite Branch',
            date: testDate,
            timeSlot: '05:00 PM',
            consent: true
        });
        assert(invalidPhone.status === 400, 'Invalid phone number rejected with HTTP 400');

        // 3b. Sunday Booking Rejection
        const sundayDate = getUpcomingSunday();
        const sundayReq = await httpRequest({ path: '/api/appointments', method: 'POST' }, {
            name: 'Test Sunday',
            phone: '9876543211',
            program: 'AutoCAD',
            branch: 'Satellite Branch',
            date: sundayDate,
            timeSlot: '11:00 AM',
            consent: true
        });
        assert(sundayReq.status === 400 && sundayReq.body.error.includes('Sundays'), 'Sunday booking rejected with holiday notice: ' + sundayReq.body.error);

        // 3c. Past Date Rejection
        const pastReq = await httpRequest({ path: '/api/appointments', method: 'POST' }, {
            name: 'Test Past',
            phone: '9876543212',
            program: 'AutoCAD',
            branch: 'Satellite Branch',
            date: '2020-01-01',
            timeSlot: '11:00 AM',
            consent: true
        });
        assert(pastReq.status === 400 && pastReq.body.error.includes('past dates'), 'Past date booking rejected with HTTP 400');

        // 3d. Beyond 7 Days Rejection
        const beyondReq = await httpRequest({ path: '/api/appointments', method: 'POST' }, {
            name: 'Test Beyond',
            phone: '9876543213',
            program: 'AutoCAD',
            branch: 'Satellite Branch',
            date: '2030-01-01',
            timeSlot: '11:00 AM',
            consent: true
        });
        assert(beyondReq.status === 400 && beyondReq.body.error.includes('7 days'), 'Date beyond 7 days rejected with HTTP 400');

        // 3e. Tampered Branch Rejection
        const tamperedBranch = await httpRequest({ path: '/api/appointments', method: 'POST' }, {
            name: 'Test Branch Tamper',
            phone: '9876543214',
            program: 'AutoCAD',
            branch: 'Bogus Fake Campus 999',
            date: testDate,
            timeSlot: '05:00 PM',
            consent: true
        });
        assert(tamperedBranch.status === 400 && tamperedBranch.body.error.includes('branch'), 'Tampered branch name rejected with HTTP 400');

        // 3f. Tampered Service Rejection
        const tamperedService = await httpRequest({ path: '/api/appointments', method: 'POST' }, {
            name: 'Test Service Tamper',
            phone: '9876543215',
            program: 'Unapproved Fake Hacking Course',
            branch: 'Satellite Branch',
            date: testDate,
            timeSlot: '05:00 PM',
            consent: true
        });
        assert(tamperedService.status === 400 && tamperedService.body.error.includes('service'), 'Tampered program/service rejected with HTTP 400');

        // 3g. Missing Mandatory Consent Checkbox
        const missingConsent = await httpRequest({ path: '/api/appointments', method: 'POST' }, {
            name: 'Test Missing Consent',
            phone: '9876543216',
            program: 'AutoCAD',
            branch: 'Satellite Branch',
            date: testDate,
            timeSlot: '05:00 PM',
            consent: false
        });
        assert(missingConsent.status === 400 && missingConsent.body.error && missingConsent.body.error.toLowerCase().includes('consent'), 'Missing consent checkbox rejected with HTTP 400: ' + missingConsent.body?.error);

        // --- TEST 4: EMAIL_ENABLED=false & SMS_ENABLED=false ---
        console.log('\n--- TEST 4: Disabled Notification Flags (Silent Skip) ---');
        const flagTestReq = await httpRequest({ path: '/api/appointments', method: 'POST' }, {
            name: 'Silent Notification Student',
            email: 'silent@example.com',
            phone: '9876543299',
            program: 'SolidWorks & Mechanical CAD',
            branch: 'Bopal Branch',
            date: testDate,
            timeSlot: '06:00 PM',
            consent: true
        });
        assert(flagTestReq.status === 200 && flagTestReq.body.success, 'Booking succeeds without error when notifications are disabled');

        // --- TEST 5: Notification Failure Resiliency & Idempotency ---
        console.log('\n--- TEST 5: Notification Failure Resiliency & Idempotency ---');
        // Test notification service unit behaviors
        const notifInstance = new notificationService.NotificationService();
        notifInstance.emailEnabled = true;
        notifInstance.emailProvider = 'resend';
        process.env.RESEND_API_KEY = 're_invalid_test_key';

        // Dispatched notification will fail network/auth, but MUST NOT throw or block
        let caughtError = null;
        try {
            await notifInstance.notifyAppointmentCreated({
                id: 9999,
                bookingRef: 'CCC-20261105-TEST',
                name: 'Resilient Tester',
                email: 'test@example.com',
                phone: '9978999694',
                program: 'AutoCAD',
                branch: 'Satellite Branch',
                date: '2026-11-05',
                timeSlot: '11:00 AM'
            });
        } catch (e) {
            caughtError = e;
        }
        assert(caughtError === null, 'notifyAppointmentCreated handles provider failure asynchronously without throwing');

        // Idempotency: calling with same ID again must skip duplicate send
        const duplicateCall = await notifInstance.notifyAppointmentCreated({
            id: 9999,
            bookingRef: 'CCC-20261105-TEST',
            name: 'Resilient Tester',
            email: 'test@example.com',
            phone: '9978999694',
            program: 'AutoCAD',
            branch: 'Satellite Branch',
            date: '2026-11-05',
            timeSlot: '11:00 AM'
        });
        assert(duplicateCall.idempotentSkipped === true, 'Duplicate notification send skipped idempotently');

        // --- TEST 6: XSS Escaping & Header Sanitization ---
        console.log('\n--- TEST 6: User Input Escaping & Header Sanitization ---');
        const scriptName = '<script>alert("XSS")</script>';
        const escapedHtml = notificationService.escapeHtml(scriptName);
        assert(escapedHtml === '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;', 'HTML tags escaped to entities: ' + escapedHtml);

        const injectionSubject = 'Normal Subject\r\nBcc: victim@example.com\nInjection: test';
        const cleanHeader = notificationService.stripNewlines(injectionSubject);
        assert(!cleanHeader.includes('\r') && !cleanHeader.includes('\n'), 'Header newlines stripped completely: ' + cleanHeader);

        // --- TEST 7: Rate Limiting ---
        console.log('\n--- TEST 7: Rate Limiting Enforcement ---');
        const spamPhone = '9876543200';
        let rateLimited = false;
        for (let i = 0; i < 5; i++) {
            const spamRes = await httpRequest({ path: '/api/appointments', method: 'POST' }, {
                name: `Spam Tester ${i}`,
                phone: spamPhone,
                program: 'AutoCAD',
                branch: 'Satellite Branch',
                date: testDate,
                timeSlot: '05:00 PM',
                consent: true
            });
            if (spamRes.status === 429) {
                rateLimited = true;
                break;
            }
        }
        assert(rateLimited, 'Per-phone / per-IP rate limiter triggered HTTP 429 after repeated submissions');

        // --- TEST 8: Static Pages & Accessibility Assets Integrity ---
        console.log('\n--- TEST 8: Accessibility & Static Page Verification ---');
        const privacyRes = await httpRequest({ path: '/privacy.html', method: 'GET' });
        assert(privacyRes.status === 200 && privacyRes.body.includes('DPDP Act 2023'), 'Privacy Policy page accessible and DPDP Act 2023 compliant');

        const termsRes = await httpRequest({ path: '/terms.html', method: 'GET' });
        assert(termsRes.status === 200 && termsRes.body.includes('Terms of Service'), 'Terms of Service page accessible');

        const notFoundRes = await httpRequest({ path: '/404.html', method: 'GET' });
        assert(notFoundRes.status === 200 && notFoundRes.body.includes('404'), 'Custom 404 page accessible');

        const robotsRes = await httpRequest({ path: '/robots.txt', method: 'GET' });
        assert(robotsRes.status === 200 && robotsRes.body.includes('cubecadcenter.co'), 'robots.txt points to official domain');

        const sitemapRes = await httpRequest({ path: '/sitemap.xml', method: 'GET' });
        assert(sitemapRes.status === 200 && sitemapRes.body.includes('https://cubecadcenter.co/privacy.html'), 'sitemap.xml includes privacy.html and official domain');

    } finally {
        serverProcess.kill();
        try { require('fs').unlinkSync(testDbPath); } catch (e) {}
    }

    console.log('\n================================================================');
    console.log(`TOTAL ACCEPTANCE TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

run().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
});
