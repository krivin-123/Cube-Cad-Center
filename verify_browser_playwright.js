const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '.env') });
const SECRET_KEY = process.env.SECRET_KEY || process.env.JWT_SECRET;
if (!SECRET_KEY) {
    throw new Error('FATAL: SECRET_KEY is missing');
}

const app = require('./server.js');
const PORT = 3040;
const BASE_URL = `http://localhost:${PORT}`;

const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function runBrowserVerification() {
    console.log('================================================================');
    console.log('PLAYWRIGHT REAL HEADLESS BROWSER VERIFICATION SUITE');
    console.log('Target: ' + BASE_URL + '/admin/certificates');
    console.log('================================================================\n');

    const server = app.listen(PORT);
    await new Promise(r => setTimeout(r, 600));

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

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    const consoleErrors = [];
    const pageErrors = [];

    const adminToken = jwt.sign(
        { id: 1, name: 'Admin', email: 'cubecadcenter0711@gmail.com', isAdmin: true, role: 'admin' },
        SECRET_KEY,
        { expiresIn: '12h' }
    );

    // Set ccc_admin_token cookie
    await context.addCookies([
        {
            name: 'ccc_admin_token',
            value: adminToken,
            domain: 'localhost',
            path: '/',
            httpOnly: true,
            secure: false, // localhost allows non-https cookies in playwright context
            sameSite: 'Strict'
        }
    ]);

    const page = await context.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    page.on('pageerror', err => {
        pageErrors.push(err.message);
    });

    try {
        // --- 1. Navigate at 1280px ---
        console.log('--- TEST 5a: Desktop 1280px Viewport & Certificate Rendering ---');
        await page.setViewportSize({ width: 1280, height: 800 });
        const res = await page.goto(`${BASE_URL}/admin/certificates`, { waitUntil: 'networkidle' });
        assert(res.status() === 200, 'Page loaded with HTTP 200');

        // Click "Try with sample data"
        await page.click('#sample');
        const fileMsgText = await page.textContent('#fileMsg');
        assert(fileMsgText.includes('students loaded'), 'Sample data loaded: ' + fileMsgText);

        // Search for "Aarav"
        await page.fill('#q', 'aar');
        await page.waitForSelector('#res button');
        const matchText = await page.textContent('#res button');
        assert(matchText.includes('Aarav Shah'), 'Search results list Aarav Shah: ' + matchText);

        // Click first match
        await page.click('#res button');
        const fNameVal = await page.inputValue('#fName');
        const fCourseVal = await page.inputValue('#fCourse');
        assert(fNameVal === 'Aarav Shah' && fCourseVal === 'Revit Architecture', 'Form populated with student details');

        // Click "Create certificate"
        await page.click('button[type="submit"]');
        await page.waitForSelector('#cert:not([hidden])');
        const isCertVisible = await page.isVisible('#cert');
        assert(isCertVisible, 'Certificate preview rendered and visible');

        const certNoVal = await page.textContent('#cNo');
        assert(certNoVal.startsWith('CCC-2026-'), 'Certificate number generated: ' + certNoVal);

        // Check horizontal scroll at 1280px
        const hasScroll1280 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        assert(!hasScroll1280, 'No horizontal scroll at 1280px');

        const screenshot1280Path = path.join(screenshotsDir, 'certificate-1280px.png');
        await page.screenshot({ path: screenshot1280Path, fullPage: true });
        assert(fs.existsSync(screenshot1280Path), '1280px screenshot saved: ' + screenshot1280Path);

        // --- 2. Mobile 375px Viewport ---
        console.log('\n--- TEST 5b: Mobile 375px Viewport Rendering ---');
        await page.setViewportSize({ width: 375, height: 812 });
        await page.waitForTimeout(300);

        const hasScroll375 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        assert(!hasScroll375, 'No horizontal scroll at 375px (responsive layout)');

        const screenshot375Path = path.join(screenshotsDir, 'certificate-375px.png');
        await page.screenshot({ path: screenshot375Path, fullPage: true });
        assert(fs.existsSync(screenshot375Path), '375px screenshot saved: ' + screenshot375Path);

        // --- 3. Print to PDF ---
        console.log('\n--- TEST 6: Print to PDF (A4 Landscape, Single Page) ---');
        const pdfPath = path.join(screenshotsDir, 'certificate.pdf');
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            landscape: true,
            printBackground: true
        });
        assert(fs.existsSync(pdfPath), 'Certificate PDF generated: ' + pdfPath);

        // Verify PDF size and page count
        const pdfBuffer = fs.readFileSync(pdfPath);
        // In PDF syntax, /Count N or /Type /Page occurrences indicate pages
        const pdfText = pdfBuffer.toString('binary');
        const pageMatches = pdfText.match(/\/Type\s*\/Page\b/g) || [];
        assert(pageMatches.length === 1, 'PDF contains exactly 1 page (matches: ' + pageMatches.length + ')');

        // --- 4. Browser Console Errors ---
        console.log('\n--- TEST 7: Browser Console & Runtime Errors ---');
        assert(consoleErrors.length === 0, 'Console errors: ' + (consoleErrors.length ? consoleErrors.join(', ') : 'None (PASS)'));
        assert(pageErrors.length === 0, 'Page errors: ' + (pageErrors.length ? pageErrors.join(', ') : 'None (PASS)'));

        // --- 5. Real .csv and .xlsx Uploads ---
        console.log('\n--- TEST 8: Real .xlsx and .csv File Uploads ---');
        // Reset viewport for upload testing
        await page.setViewportSize({ width: 1280, height: 800 });

        // 8a. Real CSV Upload
        const csvPath = path.resolve(__dirname, 'test_students.csv');
        await page.setInputFiles('#file', csvPath);
        await page.waitForTimeout(400);
        const csvMsg = await page.textContent('#fileMsg');
        assert(csvMsg.includes('students loaded'), 'Real CSV uploaded successfully: ' + csvMsg);

        await page.fill('#q', 'pooja');
        await page.waitForSelector('#res button');
        const csvMatch = await page.textContent('#res button');
        assert(csvMatch.includes('Pooja Varma'), 'Search on CSV found Pooja Varma');
        await page.keyboard.press('Enter');
        const poojaCourse = await page.inputValue('#fCourse');
        assert(poojaCourse === 'Revit Architecture & BIM', 'Enter selected Pooja Varma and populated course: ' + poojaCourse);

        // 8b. Real XLSX Upload
        const xlsxPath = path.resolve(__dirname, 'test_students.xlsx');
        await page.setInputFiles('#file', xlsxPath);
        await page.waitForTimeout(400);
        const xlsxMsg = await page.textContent('#fileMsg');
        assert(xlsxMsg.includes('students loaded'), 'Real XLSX uploaded successfully: ' + xlsxMsg);

        await page.fill('#q', 'karan');
        await page.waitForSelector('#res button');
        const xlsxMatch = await page.textContent('#res button');
        assert(xlsxMatch.includes('Karan Joshi'), 'Search on XLSX found Karan Joshi');
        await page.keyboard.press('Enter');
        const karanCourse = await page.inputValue('#fCourse');
        assert(karanCourse === 'AutoCAD 2D & 3D', 'Enter selected Karan Joshi and populated course: ' + karanCourse);

        // 8c. Missing Column CSV Upload
        const missingCsvPath = path.resolve(__dirname, 'test_missing_column.csv');
        await page.setInputFiles('#file', missingCsvPath);
        await page.waitForTimeout(400);
        const missingCsvMsg = await page.textContent('#fileMsg');
        assert(missingCsvMsg.includes('Missing column: course'), 'Missing column CSV displays explicit error: ' + missingCsvMsg);

        // 8d. Missing Column XLSX Upload
        const missingXlsxPath = path.resolve(__dirname, 'test_missing_column.xlsx');
        await page.setInputFiles('#file', missingXlsxPath);
        await page.waitForTimeout(400);
        const missingXlsxMsg = await page.textContent('#fileMsg');
        assert(missingXlsxMsg.includes('Missing column: course'), 'Missing column XLSX displays explicit error: ' + missingXlsxMsg);

        console.log('\n================================================================');
        console.log(`PLAYWRIGHT RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
        console.log('================================================================');

    } catch (e) {
        console.error('Playwright verification crashed:', e);
        failCount++;
    } finally {
        await browser.close();
        server.close();
    }
}

runBrowserVerification();
