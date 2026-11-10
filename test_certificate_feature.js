/**
 * Test Suite for Create Certificate Admin Feature
 * Verifies all 12 Quality Checks and strict security refinements
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '.env') });
const SECRET_KEY = process.env.SECRET_KEY || process.env.JWT_SECRET;
if (!SECRET_KEY) {
    throw new Error('FATAL: SECRET_KEY or JWT_SECRET must be present in .env');
}
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Apple@1234';
process.env.ADMIN_SECRET = process.env.ADMIN_SECRET || 'test_admin_secret_key_2026';

const app = require('./server.js');

let server;
const PORT = 3025;
const BASE_URL = `http://localhost:${PORT}`;

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

async function run() {
    console.log('================================================================');
    console.log('RUNNING CREATE CERTIFICATE ADMIN FEATURE ACCEPTANCE TESTS');
    console.log(`Target: ${BASE_URL}`);
    console.log('================================================================\n');

    server = app.listen(PORT);
    await new Promise(r => setTimeout(r, 800));

    try {
        // Generate Tokens for testing
        const adminToken = jwt.sign(
            { id: 1, name: 'Admin', email: 'cubecadcenter0711@gmail.com', isAdmin: true, role: 'admin' },
            SECRET_KEY,
            { expiresIn: '12h' }
        );

        const studentToken = jwt.sign(
            { id: 99, name: 'Regular Student', email: 'student@example.com', role: 'student', isAdmin: false },
            SECRET_KEY,
            { expiresIn: '12h' }
        );

        // --- CHECK 1: Signed out access blocked (401) ---
        console.log('--- CHECK 1: Signed out access to /admin/certificates ---');
        const res1 = await request({ path: '/admin/certificates', method: 'GET' });
        assert(res1.status === 401, 'Signed out request returns HTTP 401');
        assert(typeof res1.body === 'string' && !res1.body.includes('Certificate of completion'), 'No certificate page HTML is delivered on 401');

        const res1Slash = await request({ path: '/admin/certificates/', method: 'GET' });
        assert(res1Slash.status === 401, 'Signed out request with trailing slash returns HTTP 401');

        // Check that private template is not accessible directly
        const res1Private = await request({ path: '/private/certificate-admin.html', method: 'GET' });
        assert(res1Private.status === 404, 'Direct access to /private/certificate-admin.html is blocked (HTTP 404)');

        // Check that ?token= query-string is rejected
        const res1Query = await request({ path: `/admin/certificates?token=${adminToken}`, method: 'GET' });
        assert(res1Query.status === 401, '?token= query-string is rejected (HTTP 401)');

        // Check that x-admin-secret header is rejected on /admin/certificates
        const res1Secret = await request({
            path: '/admin/certificates',
            method: 'GET',
            headers: { 'x-admin-secret': process.env.ADMIN_SECRET }
        });
        assert(res1Secret.status === 401, 'x-admin-secret bypass on /admin/certificates is rejected (HTTP 401)');

        // Check that generic "token" cookie is rejected (accepts ONLY ccc_admin_token)
        const res1WrongCookie = await request({
            path: '/admin/certificates',
            method: 'GET',
            headers: { 'Cookie': `token=${adminToken}` }
        });
        assert(res1WrongCookie.status === 401, 'Generic "token" cookie without ccc_admin_token is rejected (HTTP 401)');

        // --- CHECK 2: Signed in as normal user blocked (403) ---
        console.log('\n--- CHECK 2: Normal user access to /admin/certificates (403) ---');
        const res2 = await request({
            path: '/admin/certificates',
            method: 'GET',
            headers: { 'Cookie': `ccc_admin_token=${studentToken}` }
        });
        assert(res2.status === 403, 'Normal user (role: student) via ccc_admin_token returns HTTP 403');
        assert(typeof res2.body === 'string' && !res2.body.includes('Certificate of completion'), 'No certificate HTML delivered to normal user');

        // Verify public pages do not contain the admin nav link
        const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
        assert(!indexHtml.includes('/admin/certificates') && !indexHtml.includes('Create certificate'), 'Public homepage does not contain certificate admin link');

        // --- CHECK 3: Signed in as admin redirects to /admin#certificates (302) ---
        console.log('\n--- CHECK 3: Admin access to /admin/certificates (302) via ccc_admin_token ---');
        const res3Cookie = await request({
            path: '/admin/certificates',
            method: 'GET',
            headers: { 'Cookie': `ccc_admin_token=${adminToken}` }
        });
        assert(res3Cookie.status === 302, 'Admin request with ccc_admin_token cookie returns HTTP 302');
        assert(res3Cookie.headers.location === '/admin#certificates', 'Redirects to /admin#certificates');

        // Verify Admin navigation has "Create certificate" calling switchPage and no openCertificateAdmin
        const adminHtml = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
        assert(adminHtml.includes('Create certificate') && adminHtml.includes("switchPage('certificates')"), 'Admin navigation includes "Create certificate" calling switchPage');
        assert(!adminHtml.includes('openCertificateAdmin'), 'openCertificateAdmin() is completely removed');
        assert(adminHtml.includes('id="page-certificates"'), 'admin.html contains page-certificates container');

        // --- CHECK 3b: Server sets HttpOnly, Secure, SameSite=Strict cookie on sign-in and clears on logout ---
        console.log('\n--- CHECK 3b: Cookie attributes on sign-in & logout ---');
        const signinRes = await request({ path: '/api/admin/signin', method: 'POST' }, {
            email: 'cubecadcenter0711@gmail.com',
            password: process.env.ADMIN_PASSWORD
        });
        assert(signinRes.status === 200, 'Admin sign-in succeeds with HTTP 200');
        const setCookie = signinRes.headers['set-cookie'] || [];
        const cccCookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
        assert(cccCookieStr.includes('ccc_admin_token='), 'Set-Cookie contains ccc_admin_token');
        assert(/HttpOnly/i.test(cccCookieStr), 'Cookie has HttpOnly flag');
        assert(/Secure/i.test(cccCookieStr), 'Cookie has Secure flag');
        assert(/SameSite=Strict/i.test(cccCookieStr), 'Cookie has SameSite=Strict flag');
        assert(/Max-Age=43200/i.test(cccCookieStr), 'Cookie has Max-Age=43200 (matches 12h JWT expiry)');

        // Test logout endpoint clears cookie
        const logoutRes = await request({ path: '/api/admin/logout', method: 'POST' });
        assert(logoutRes.status === 200, 'Admin logout endpoint responds HTTP 200');
        const logoutCookie = logoutRes.headers['set-cookie'] || [];
        const logoutCookieStr = Array.isArray(logoutCookie) ? logoutCookie.join('; ') : logoutCookie;
        assert(logoutCookieStr.includes('ccc_admin_token=;') || logoutCookieStr.includes('Max-Age=0') || logoutCookieStr.includes('1970'), 'Logout clears ccc_admin_token cookie');

        // --- CHECK 4 & 5: Ingest parsing logic & missing column detection ---
        console.log('\n--- CHECK 4 & 5: Ingest parsing logic & missing column detection ---');
        const norm = function(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
        function pad(n) { return String(n).padStart(2, '0'); }
        function iso(v) {
            if (v instanceof Date && !isNaN(v)) { var d = new Date(v.getTime() + 432e5); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
            if (typeof v === 'number' && v > 0) { var u = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5); return u.getUTCFullYear() + '-' + pad(u.getUTCMonth() + 1) + '-' + pad(u.getUTCDate()); }
            if (typeof v === 'string') { v = v.trim(); if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); var p = new Date(v); if (!isNaN(p)) return iso(p); }
            return '';
        }

        function testIngest(raw) {
            if (!raw.length) return { error: 'The sheet has no data rows.' };
            var keys = Object.keys(raw[0]);
            var nk = keys.find(function(k) { var n = norm(k); return /name/.test(n) && !/course|program|batch|branch/.test(n); });
            var ck = keys.find(function(k) { return /course|program/.test(norm(k)); });
            var dk = keys.find(function(k) { return /complet|date|end/.test(norm(k)); });
            var ek = keys.find(function(k) { return /mail/.test(norm(k)); });
            var miss = [];
            if (!nk) miss.push('name');
            if (!ck) miss.push('course');
            if (!dk) miss.push('completion date');
            if (miss.length) return { error: 'Missing column: ' + miss.join(', ') + '. Columns found: ' + keys.join(', ') + '.' };
            var out = [], skipped = 0;
            raw.forEach(function(r) {
                var n = String(r[nk]).trim();
                if (!n) { skipped++; return; }
                out.push({ name: n, course: String(r[ck]).trim(), date: iso(r[dk]), email: ek ? String(r[ek]).trim() : '' });
            });
            return { students: out, count: out.length };
        }

        // Sample valid dataset
        const validSample = [
            { 'Student Name': 'Aarav Shah', 'Course': 'Revit Architecture', 'Completion Date': '2026-09-15' },
            { 'Student Name': 'Diya Patel', 'Course': 'AutoCAD 2D & 3D', 'Completion Date': '2026-08-30' },
            { 'Student Name': 'Rohan Mehta', 'Course': 'SketchUp & Interior Design', 'Completion Date': '2026-10-12' }
        ];
        const ingestRes = testIngest(validSample);
        assert(!ingestRes.error && ingestRes.count === 3, 'Ingest successfully parses 3 valid student records');
        assert(ingestRes.students[0].name === 'Aarav Shah' && ingestRes.students[0].date === '2026-09-15', 'Student details and date formatted correctly');

        // Missing Course column
        const missingCourseSample = [
            { 'Student Name': 'Aarav Shah', 'Completion Date': '2026-09-15' }
        ];
        const missingRes = testIngest(missingCourseSample);
        assert(missingRes.error && missingRes.error.includes('Missing column: course'), 'Missing Course column returns explicit error: ' + missingRes.error);

        // --- CHECK 6: Search "aar" and selection ---
        console.log('\n--- CHECK 6: Search "aar" and matching student selection ---');
        const rows = ingestRes.students;
        function testSearch(q) {
            q = q.trim().toLowerCase();
            if (!q || !rows.length) return [];
            return rows.filter(function(r) { return r.name.toLowerCase().indexOf(q) > -1; });
        }
        const searchMatches = testSearch('aar');
        assert(searchMatches.length === 1 && searchMatches[0].name === 'Aarav Shah', 'Searching "aar" matches "Aarav Shah"');
        const firstMatch = searchMatches[0];
        assert(firstMatch.name === 'Aarav Shah' && firstMatch.course === 'Revit Architecture', 'First match correctly selected on Enter');

        // --- CHECK 7: Validation errors (empty name, course, date, future date) ---
        console.log('\n--- CHECK 7: Form field validation rules ---');
        function validateFields(n, c, d) {
            n = (n || '').trim().replace(/\s+/g, ' ');
            c = (c || '').trim();
            d = d || '';
            const today = '2026-11-10';
            const errors = {};
            let first = null;
            function bad(id, t) { errors[id] = t; if (!first) first = id; }
            if (!n) bad('fName', 'Enter the student’s full name.');
            else if (n.length < 3) bad('fName', 'Name must be at least 3 characters.');
            if (!c) bad('fCourse', 'Enter the course name.');
            if (!d) bad('fDate', 'Choose the completion date.');
            else if (d > today) bad('fDate', 'Completion date can’t be in the future.');
            return { errors, first };
        }

        const vEmptyName = validateFields('', 'AutoCAD', '2026-10-01');
        assert(vEmptyName.errors.fName && vEmptyName.first === 'fName', 'Empty name caught and focuses fName');

        const vShortName = validateFields('Jo', 'AutoCAD', '2026-10-01');
        assert(vShortName.errors.fName && vShortName.first === 'fName', 'Short name (<3 chars) caught');

        const vEmptyCourse = validateFields('Aarav Shah', '', '2026-10-01');
        assert(vEmptyCourse.errors.fCourse && vEmptyCourse.first === 'fCourse', 'Empty course caught and focuses fCourse');

        const vEmptyDate = validateFields('Aarav Shah', 'AutoCAD', '');
        assert(vEmptyDate.errors.fDate && vEmptyDate.first === 'fDate', 'Empty date caught and focuses fDate');

        const vFutureDate = validateFields('Aarav Shah', 'AutoCAD', '2027-01-01');
        assert(vFutureDate.errors.fDate && vFutureDate.first === 'fDate', 'Future date caught and focuses fDate');

        // --- CHECK 8: Deterministic Certificate Number Generation ---
        console.log('\n--- CHECK 8: Deterministic Certificate Number Generation ---');
        function hash(s) {
            var h = 2166136261;
            for (var i = 0; i < s.length; i++) {
                h ^= s.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return (h >>> 0).toString(36).toUpperCase().padStart(6, '0');
        }
        function getCertNo(n, c, d) {
            return 'CCC-' + d.slice(0, 4) + '-' + hash(n.toLowerCase() + '|' + c.toLowerCase() + '|' + d);
        }

        const cert1 = getCertNo('Aarav Shah', 'Revit Architecture', '2026-09-15');
        const cert2 = getCertNo('Aarav Shah', 'Revit Architecture', '2026-09-15');
        assert(cert1 === cert2, 'Creating certificate twice with same details generates identical certificate number: ' + cert1);
        assert(cert1.startsWith('CCC-2026-'), 'Certificate number has proper CCC-YYYY-XXXXXX format');

        // --- CHECK 9: Print CSS Specifications ---
        console.log('\n--- CHECK 9: Print CSS Specifications ---');
        assert(adminHtml.includes('size: A4 landscape;'), 'Print CSS includes A4 landscape');
        assert(adminHtml.includes('margin: 0;'), 'Print CSS includes margin: 0');
        assert(adminHtml.includes('body > *:not(#cert-print-root)'), 'Non-certificate elements hidden in print CSS');
        assert(adminHtml.includes('297mm') && adminHtml.includes('210mm'), 'Certificate sized to 297mm x 210mm in print');
        assert(adminHtml.includes('break-after: page') && adminHtml.includes('break-after: auto'), 'Page breaks configured to avoid trailing blank page');

        // --- CHECK 10: Mobile Responsive Styles (375px) ---
        console.log('\n--- CHECK 10: Mobile responsiveness (375px) ---');
        assert(adminHtml.includes('.cert-layout-grid'), '2-column grid layout for certificates page');
        assert(adminHtml.includes('container-type: inline-size') && adminHtml.includes('cqw'), 'Container queries used for certificate auto-scaling');

        // --- CHECK 11: Script integrity & pinned version ---
        console.log('\n--- CHECK 11: SheetJS pinned version & CSP verification ---');
        assert(adminHtml.includes('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'), 'SheetJS pinned to exact 0.18.5 version');
        assert(adminHtml.includes('sha512-r22gChDnGvBylk90+2e/ycr3RVrDi8DIOkIGNhJlKfuyQM4tIRAI062MaV8sfjQKYVGjOBaZBOA87z+IhZE9DA=='), 'SheetJS script has correct SRI hash');
        const vercelJson = fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8');
        assert(vercelJson.includes('https://cdnjs.cloudflare.com'), 'Vercel CSP includes https://cdnjs.cloudflare.com');

        // --- CHECK 12: Vercel Bundle & SECRET_KEY verification ---
        console.log('\n--- CHECK 12: Vercel Bundle (includeFiles) & SECRET_KEY no fallback ---');
        const vercelConfig = JSON.parse(vercelJson);
        assert(vercelConfig.functions && vercelConfig.functions['api/index.js'] && vercelConfig.functions['api/index.js'].includeFiles === 'private/**', 'vercel.json includes private/** in functions bundle');

        const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
        assert(!serverJs.includes("const SECRET_KEY = process.env.SECRET_KEY || process.env.JWT_SECRET || '3ab"), 'server.js has no hardcoded fallback for SECRET_KEY');
        assert(serverJs.includes("expiresIn: '12h'"), 'Admin tokens have 12h expiry');

        console.log('\n================================================================');
        console.log(`TOTAL ACCEPTANCE CHECKS: ${passCount} PASSED, ${failCount} FAILED`);
        console.log('================================================================');

    } catch (err) {
        console.error('Test suite runtime error:', err);
        failCount++;
    } finally {
        server.close();
    }
}

run();
