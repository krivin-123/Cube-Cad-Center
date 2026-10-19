const https = require('https');
require('dotenv').config();

const API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyDBdKpF_64kpxJ3JxBuRAMjRBCVnMisorI";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "cube-cad-center";

function httpsRequest(urlStr, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const reqOpts = {
      hostname: u.hostname,
      port: 443,
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
  });
}

async function testFirestoreFlow() {
  console.log("=== 1. VERIFY FIREBASE CONFIG ===");
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log(`API Key: ${API_KEY.slice(0, 10)}...`);

  // Sign up a temporary student with Firebase Auth directly via IdentityToolkit REST API (same as client SDK createUserWithEmailAndPassword)
  const testEmail = `student_${Date.now()}@example.com`;
  const testPassword = `StudentPass!${Date.now()}`;
  console.log(`\n=== 2. AUTHENTICATING CLIENT (Firebase Auth) ===`);
  console.log(`Creating Firebase Auth user: ${testEmail}`);

  const signupRes = await httpsRequest(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: 'POST' },
    { email: testEmail, password: testPassword, returnSecureToken: true }
  );

  if (signupRes.status !== 200) {
    console.error("Firebase Auth sign-up failed:", signupRes.status, signupRes.body);
    process.exit(1);
  }

  const { idToken, localId } = signupRes.body;
  console.log(`Firebase Auth Success! UID: ${localId}`);
  console.log(`ID Token acquired (first 30 chars): ${idToken.substring(0, 30)}...`);

  // 3. Attempt to create a temporary test document in Firestore
  console.log(`\n=== 3. ATTEMPTING FIRESTORE WRITE (Authenticated Client) ===`);
  const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/bookings`;
  const testBookingRef = `TEST-${Date.now()}`;
  const writePayload = {
    fields: {
      booking_ref: { stringValue: testBookingRef },
      user_id: { stringValue: localId },
      email: { stringValue: testEmail },
      name: { stringValue: "Diagnose Test Student" },
      branch: { stringValue: "Satellite Campus" },
      program: { stringValue: "AutoCAD Mechanical" },
      date: { stringValue: "2026-10-15" },
      time_slot: { stringValue: "11:00 AM" },
      status: { stringValue: "Pending" },
      notes: { stringValue: "Temporary diagnostic test doc" }
    }
  };

  const writeRes = await httpsRequest(
    `https://firestore.googleapis.com/v1/${docPath}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    },
    writePayload
  );

  console.log(`Write response HTTP status: ${writeRes.status}`);
  console.log(`Write response body:`, JSON.stringify(writeRes.body, null, 2));

  if (writeRes.status === 200) {
    const createdDocName = writeRes.body.name;
    console.log(`\n=== 4. READING DOCUMENT BACK FROM FIRESTORE ===`);
    console.log(`Document path: ${createdDocName}`);
    const readRes = await httpsRequest(
      `https://firestore.googleapis.com/v1/${createdDocName}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      }
    );
    console.log(`Read response HTTP status: ${readRes.status}`);
    console.log(`Read response body:`, JSON.stringify(readRes.body, null, 2));
  } else {
    // Also test writing to /users/{localId}
    console.log(`\n=== 3b. ATTEMPTING WRITE TO /users/${localId} ===`);
    const userDocPath = `projects/${PROJECT_ID}/databases/(default)/documents/users/${localId}`;
    const userPayload = {
      fields: {
        uid: { stringValue: localId },
        email: { stringValue: testEmail },
        name: { stringValue: "Diagnose Test Student" },
        role: { stringValue: "student" }
      }
    };
    const userWriteRes = await httpsRequest(
      `https://firestore.googleapis.com/v1/${userDocPath}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      },
      userPayload
    );
    console.log(`User write response HTTP status: ${userWriteRes.status}`);
    console.log(`User write response body:`, JSON.stringify(userWriteRes.body, null, 2));
  }
}

testFirestoreFlow().catch(console.error);
