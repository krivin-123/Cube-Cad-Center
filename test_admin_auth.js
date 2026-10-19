/**
 * Comprehensive Admin Authentication & Access Verification Suite
 * Cube CAD Center
 */

require('dotenv').config();
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function request(options, bodyData = null, baseUrl = BASE_URL) {
    return new Promise((resolve, reject) => {
        const url = new URL(options.path, baseUrl);
        const reqOpts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: Object.assign({}, options.headers || {})
        };

        let jsonPayload = null;
        if (bodyData !== null) {
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

let passCount = 0;
let failCount = 0;

function assert(cond, msg) {
    if (cond) {
        passCount++;
        console.log(`  [PASS] ${msg}`);
    } else {
        failCount++;
        console.error(`  [FAIL] ${msg}`);
    }
}

async function runTests() {
    console.log('================================================================');
    console.log('ADMIN AUTHENTICATION & SECURITY VERIFICATION SUITE');
    console.log('Target: ' + BASE_URL);
    console.log('================================================================\n');

    // 1. Primary admin email
    console.log('--- TEST 1: Primary Admin Email Login ---');
    const res1 = await request({ path: '/api/admin/signin', method: 'POST' }, {
        email: 'cubecadcenter0711@gmail.com',
        password: ADMIN_PASSWORD
    });
    assert(res1.status === 200 && res1.body.success, 'cubecadcenter0711@gmail.com signs in successfully (HTTP 200)');
    assert(res1.body.token != null, 'Admin token returned');
    assert(res1.body.admin && res1.body.admin.email === 'cubecadcenter0711@gmail.com', 'Admin profile info returned');
    const adminToken = res1.body.token;

    // 2. Alias admin@cubecadcenter.com
    console.log('\n--- TEST 2: Domain Alias (admin@cubecadcenter.com) ---');
    const res2 = await request({ path: '/api/admin/signin', method: 'POST' }, {
        email: 'admin@cubecadcenter.com',
        password: ADMIN_PASSWORD
    });
    assert(res2.status === 200 && res2.body.success, 'admin@cubecadcenter.com signs in successfully (HTTP 200)');

    // 3. Username 'admin'
    console.log('\n--- TEST 3: Simple Username "admin" ---');
    const res3 = await request({ path: '/api/admin/signin', method: 'POST' }, {
        email: 'admin',
        password: ADMIN_PASSWORD
    });
    assert(res3.status === 200 && res3.body.success, 'Username "admin" signs in successfully (HTTP 200)');

    // 4. Username field in request body
    console.log('\n--- TEST 4: Request with "username" key instead of "email" ---');
    const res4 = await request({ path: '/api/admin/signin', method: 'POST' }, {
        username: 'admin',
        password: ADMIN_PASSWORD
    });
    assert(res4.status === 200 && res4.body.success, 'Body with { username: "admin" } signs in successfully (HTTP 200)');

    // 5. Normalization (whitespace & casing)
    console.log('\n--- TEST 5: Normalization (Leading/Trailing Spaces & Uppercase) ---');
    const res5 = await request({ path: '/api/admin/signin', method: 'POST' }, {
        email: '   CubeCadCenter0711@GMAIL.COM   ',
        password: ADMIN_PASSWORD
    });
    assert(res5.status === 200 && res5.body.success, 'Padded & mixed-case admin email signs in successfully (HTTP 200)');

    // 6. Rejected: Incorrect password
    console.log('\n--- TEST 6: Incorrect Password Rejection ---');
    const res6 = await request({ path: '/api/admin/signin', method: 'POST' }, {
        email: 'cubecadcenter0711@gmail.com',
        password: 'DefinatelyWrongPassword#999'
    });
    assert(res6.status === 401, 'Incorrect password rejected with HTTP 401');
    assert(res6.body.error === 'Invalid admin credentials', 'Returns "Invalid admin credentials" error message');

    // 7. Rejected: Unknown email
    console.log('\n--- TEST 7: Unknown/Non-Admin Account Rejection ---');
    const res7 = await request({ path: '/api/admin/signin', method: 'POST' }, {
        email: 'intruder@notanadmin.org',
        password: ADMIN_PASSWORD
    });
    assert(res7.status === 401, 'Unknown email rejected from admin login with HTTP 401');

    // 8. Protected route without token
    console.log('\n--- TEST 8: Unauthenticated Access to Admin API Blocked ---');
    const res8 = await request({ path: '/api/admin/me', method: 'GET' });
    assert(res8.status === 401, 'GET /api/admin/me without token returns HTTP 401');

    // 9. Student cannot access admin API
    console.log('\n--- TEST 9: Student Access Control (Forbidden) ---');
    const studentSignup = await request({ path: '/api/auth/signup', method: 'POST' }, {
        name: 'Regular Student',
        email: `student_auth_${Date.now()}@example.com`,
        password: 'StudentSecure#123'
    });
    const studentToken = studentSignup.body.token;
    const res9 = await request({
        path: '/api/admin/me',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert(res9.status === 403, 'Student token blocked from /api/admin/me with HTTP 403 Forbidden');

    // 10. Valid admin session verification
    console.log('\n--- TEST 10: Valid Admin Session Verification ---');
    const res10 = await request({
        path: '/api/admin/me',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res10.status === 200 && res10.body.success, 'Admin token verified on /api/admin/me (HTTP 200)');
    assert(res10.body.admin && res10.body.admin.isAdmin === true, 'Admin payload has isAdmin: true');

    // 11. Admin dashboard stats access
    console.log('\n--- TEST 11: Admin Dashboard Stats Protected Route ---');
    const res11 = await request({
        path: '/api/admin/stats',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res11.status === 200 && res11.body.success, 'Admin stats accessible with valid admin token (HTTP 200)');

    // 12. General sign-in modal (/api/auth/signin) detects admin and sets redirect
    console.log('\n--- TEST 12: General /api/auth/signin Admin Detection ---');
    const res12 = await request({ path: '/api/auth/signin', method: 'POST' }, {
        email: 'cubecadcenter0711@gmail.com',
        password: ADMIN_PASSWORD
    });
    assert(res12.status === 200 && res12.body.isAdmin === true, '/api/auth/signin returns isAdmin: true');
    assert(res12.body.redirect === 'admin.html', '/api/auth/signin specifies redirect to admin.html');

    // 13. Telecaller desk (/api/caller/signin) fallback for admin
    console.log('\n--- TEST 13: Admin Access to Telecaller Desk (/api/caller/signin) ---');
    const res13 = await request({ path: '/api/caller/signin', method: 'POST' }, {
        email: 'cubecadcenter0711@gmail.com',
        password: ADMIN_PASSWORD
    });
    assert(res13.status === 200 && res13.body.isAdmin === true, 'Admin can access caller desk via /api/caller/signin (HTTP 200)');

    // 14. Serverless simulation (VERCEL=1, ADMIN_PASSWORD not in env)
    console.log('\n--- TEST 14: Serverless Environment Simulation (VERCEL=1, no ADMIN_PASSWORD env) ---');
    const SERVERLESS_PORT = 3008;
    const cleanEnv = Object.assign({}, process.env, {
        PORT: String(SERVERLESS_PORT),
        VERCEL: '1',
        ADMIN_PASSWORD: '' // Unset to simulate unconfigured Vercel environment variable
    });
    delete cleanEnv.ADMIN_PASSWORD;

    const serverlessProc = spawn('node', [path.resolve(__dirname, 'server.js')], {
        cwd: __dirname,
        env: cleanEnv,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let sReady = false;
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 250));
        try {
            const h = await request({ path: '/api/health', method: 'GET' }, null, `http://localhost:${SERVERLESS_PORT}`);
            if (h.status === 200) { sReady = true; break; }
        } catch (e) {}
    }

    if (sReady) {
        const sLogin = await request({ path: '/api/admin/signin', method: 'POST' }, {
            email: 'admin',
            password: ADMIN_PASSWORD
        }, `http://localhost:${SERVERLESS_PORT}`);

        assert(sLogin.status === 200 && sLogin.body.success, 'Serverless simulated instance authenticates admin (HTTP 200)');
        assert(sLogin.body.token != null, 'Serverless instance issues valid JWT token');

        // Test session verify on serverless instance
        const sMe = await request({
            path: '/api/admin/me',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${sLogin.body.token}` }
        }, null, `http://localhost:${SERVERLESS_PORT}`);
        assert(sMe.status === 200 && sMe.body.admin && sMe.body.admin.isAdmin === true, 'Serverless instance verifies session token (HTTP 200)');

        serverlessProc.kill();
    } else {
        serverlessProc.kill();
        assert(false, 'Serverless simulation process started');
    }

    console.log('\n================================================================');
    console.log(`RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('================================================================');

    if (failCount > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
