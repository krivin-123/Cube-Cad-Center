/**
 * Server-Side Cloud Firestore Adapter (Firebase Admin SDK + REST Dual-Mode)
 * Cube CAD Center - Vercel Serverless & Local Dual-Mode Persistence
 *
 * Provides persistent CRUD operations for:
 * - users (students)
 * - bookings (appointments)
 * - customers (CRM leads)
 * - callers (telecaller management)
 * - caller_activity_logs (audit trails)
 * - settings / services / holidays / announcements
 *
 * Security:
 * - Uses dedicated server-side Firebase Admin SDK with service account credentials.
 * - Never makes Firestore public.
 * - Operates under Cloud Firestore Security Rules for client operations.
 * - Never exposes service account credentials or private keys to frontend.
 * - Safe fallback to local storage adapter when offline or in local dev.
 */

const https = require('https');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

let admin = null;
try {
    admin = require('firebase-admin');
} catch (e) {
    console.warn('firebase-admin package not loaded; operating in REST mode.');
}

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'cube-cad-center';
const API_KEY = process.env.FIREBASE_API_KEY || '';

// --- Firestore REST Serialization Helpers (used if Admin SDK not connected) ---
function toFirestoreValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number') {
        if (Number.isInteger(val)) return { integerValue: String(val) };
        return { doubleValue: val };
    }
    if (typeof val === 'string') return { stringValue: val };
    if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
    if (typeof val === 'object') {
        const fields = {};
        for (const [k, v] of Object.entries(val)) {
            if (v !== undefined) fields[k] = toFirestoreValue(v);
        }
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
    const fields = {};
    for (const [k, v] of Object.entries(obj)) {
        if (k !== 'id' && v !== undefined) {
            fields[k] = toFirestoreValue(v);
        }
    }
    return { fields };
}

function fromFirestoreValue(fieldVal) {
    if (!fieldVal) return null;
    if ('stringValue' in fieldVal) return fieldVal.stringValue;
    if ('integerValue' in fieldVal) {
        const num = Number(fieldVal.integerValue);
        return isNaN(num) ? fieldVal.integerValue : num;
    }
    if ('doubleValue' in fieldVal) return fieldVal.doubleValue;
    if ('booleanValue' in fieldVal) return fieldVal.booleanValue;
    if ('nullValue' in fieldVal) return null;
    if ('timestampValue' in fieldVal) return fieldVal.timestampValue;
    if ('arrayValue' in fieldVal) {
        return (fieldVal.arrayValue.values || []).map(fromFirestoreValue);
    }
    if ('mapValue' in fieldVal) {
        const res = {};
        for (const [k, v] of Object.entries(fieldVal.mapValue.fields || {})) {
            res[k] = fromFirestoreValue(v);
        }
        return res;
    }
    return null;
}

function fromFirestoreDoc(doc) {
    if (!doc || !doc.fields) return null;
    const data = {};
    for (const [k, v] of Object.entries(doc.fields)) {
        data[k] = fromFirestoreValue(v);
    }
    const docId = doc.name ? doc.name.split('/').pop() : '';
    return { id: docId, ...data };
}

// --- HTTPS Client Helper ---
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
                    let parsed = null;
                    try { parsed = JSON.parse(resBody); } catch (e) { parsed = resBody; }
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

class FirestoreService {
    constructor() {
        this.projectId = PROJECT_ID;
        this.apiKey = API_KEY;
        this.accessToken = null;
        this.tokenExpiry = 0;
        this.serviceAccount = null;
        this.adminApp = null;
        this.adminDb = null;
        this.adminAuth = null;

        this.initCredentials();
    }

    initCredentials() {
        // 1. Check for Service Account JSON in environment
        const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        if (saEnv) {
            try {
                const raw = saEnv.trim();
                if (raw.startsWith('{')) {
                    this.serviceAccount = JSON.parse(raw);
                } else {
                    const decoded = Buffer.from(raw, 'base64').toString('utf8');
                    this.serviceAccount = JSON.parse(decoded);
                }
                if (this.serviceAccount.project_id) {
                    this.projectId = this.serviceAccount.project_id;
                }
                if (this.serviceAccount.private_key && this.serviceAccount.private_key.includes('\\n')) {
                    this.serviceAccount.private_key = this.serviceAccount.private_key.replace(/\\n/g, '\n');
                }
            } catch (e) {
                console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', e.message);
            }
        } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY.includes('\\n')
                ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                : process.env.FIREBASE_PRIVATE_KEY;
            this.serviceAccount = {
                project_id: this.projectId,
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                private_key: privateKey
            };
        }

        // 2. Initialize Firebase Admin SDK if service account or ADC is available
        if (admin) {
            try {
                if (admin.apps && admin.apps.length > 0) {
                    this.adminApp = admin.app();
                    this.adminDb = admin.firestore();
                    this.adminAuth = admin.auth();
                } else {
                    let credential = null;
                    if (this.serviceAccount) {
                        credential = admin.credential.cert(this.serviceAccount);
                    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                        credential = admin.credential.applicationDefault();
                    }

                    if (credential) {
                        this.adminApp = admin.initializeApp({
                            credential,
                            projectId: this.projectId
                        });
                        this.adminDb = admin.firestore();
                        this.adminAuth = admin.auth();
                        console.log('Firebase Admin SDK initialized successfully for Firestore.');
                    }
                }
            } catch (adminErr) {
                console.warn('Firebase Admin SDK initialization notice:', adminErr.message);
            }
        }
    }

    get isConfigured() {
        return !!(this.adminDb || (this.projectId && (this.serviceAccount || this.apiKey)));
    }

    get mode() {
        if (this.adminDb) return 'firebase-admin';
        if (this.serviceAccount) return 'service-account-rest';
        if (this.apiKey) return 'api-key-rest';
        return 'unconfigured';
    }

    /**
     * Obtains valid OAuth2 access token for Google Cloud Datastore / Firestore (REST fallback)
     */
    async getAuthHeader() {
        const now = Math.floor(Date.now() / 1000);

        if (this.accessToken && this.tokenExpiry > now + 60) {
            return { 'Authorization': `Bearer ${this.accessToken}` };
        }

        if (this.serviceAccount && this.serviceAccount.private_key && this.serviceAccount.client_email) {
            try {
                const assertion = jwt.sign(
                    {
                        iss: this.serviceAccount.client_email,
                        sub: this.serviceAccount.client_email,
                        aud: 'https://oauth2.googleapis.com/token',
                        scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
                        iat: now,
                        exp: now + 3600
                    },
                    this.serviceAccount.private_key,
                    { algorithm: 'RS256' }
                );

                const tokenRes = await httpsRequest('https://oauth2.googleapis.com/token', {
                    method: 'POST'
                }, new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion
                }).toString());

                if (tokenRes.status === 200 && tokenRes.body && tokenRes.body.access_token) {
                    this.accessToken = tokenRes.body.access_token;
                    this.tokenExpiry = now + (tokenRes.body.expires_in || 3600);
                    return { 'Authorization': `Bearer ${this.accessToken}` };
                }
            } catch (e) {
                console.warn('Service Account token exchange error:', e.message);
            }
        }

        return {};
    }

    getBasePath(collection) {
        return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/${collection}`;
    }

    // ─── CRUD OPERATIONS (Admin SDK with REST Fallback) ───

    async getDocument(collection, docId) {
        if (this.adminDb) {
            try {
                const snap = await this.adminDb.collection(collection).doc(String(docId)).get();
                if (snap.exists) {
                    return { id: snap.id, ...snap.data() };
                }
                return null;
            } catch (e) {
                console.warn(`Admin SDK getDocument error (${collection}/${docId}):`, e.message);
            }
        }

        const headers = await this.getAuthHeader();
        const url = `${this.getBasePath(collection)}/${encodeURIComponent(String(docId))}`;
        const res = await httpsRequest(url, { method: 'GET', headers });
        if (res.status === 200 && res.body) {
            return fromFirestoreDoc(res.body);
        }
        return null;
    }

    async listDocuments(collection) {
        if (this.adminDb) {
            try {
                const snap = await this.adminDb.collection(collection).get();
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {
                console.warn(`Admin SDK listDocuments error (${collection}):`, e.message);
            }
        }

        const headers = await this.getAuthHeader();
        const url = `${this.getBasePath(collection)}?pageSize=300`;
        const res = await httpsRequest(url, { method: 'GET', headers });
        if (res.status === 200 && res.body && res.body.documents) {
            return res.body.documents.map(fromFirestoreDoc);
        }
        return [];
    }

    async setDocument(collection, docId, data) {
        if (this.adminDb) {
            try {
                await this.adminDb.collection(collection).doc(String(docId)).set(data, { merge: true });
                return { id: String(docId), ...data };
            } catch (e) {
                console.warn(`Admin SDK setDocument error (${collection}/${docId}):`, e.message);
            }
        }

        const headers = await this.getAuthHeader();
        const payload = toFirestoreFields(data);
        const url = `${this.getBasePath(collection)}/${encodeURIComponent(String(docId))}`;
        const res = await httpsRequest(url, { method: 'PATCH', headers }, payload);
        if (res.status === 200 && res.body) {
            return fromFirestoreDoc(res.body);
        }
        if (res.status >= 400) {
            throw new Error(`Firestore write failed (HTTP ${res.status}): ${JSON.stringify(res.body)}`);
        }
        return { id: docId, ...data };
    }

    async addDocument(collection, data) {
        if (this.adminDb) {
            try {
                const ref = await this.adminDb.collection(collection).add(data);
                return { id: ref.id, ...data };
            } catch (e) {
                console.warn(`Admin SDK addDocument error (${collection}):`, e.message);
            }
        }

        const headers = await this.getAuthHeader();
        const payload = toFirestoreFields(data);
        const url = this.getBasePath(collection);
        const res = await httpsRequest(url, { method: 'POST', headers }, payload);
        if (res.status === 200 && res.body) {
            return fromFirestoreDoc(res.body);
        }
        if (res.status >= 400) {
            throw new Error(`Firestore create failed (HTTP ${res.status}): ${JSON.stringify(res.body)}`);
        }
        return data;
    }

    async updateDocument(collection, docId, data) {
        if (this.adminDb) {
            try {
                await this.adminDb.collection(collection).doc(String(docId)).update(data);
                return { id: String(docId), ...data };
            } catch (e) {
                console.warn(`Admin SDK updateDocument error (${collection}/${docId}):`, e.message);
            }
        }

        const headers = await this.getAuthHeader();
        const payload = toFirestoreFields(data);
        const maskFields = Object.keys(data).filter(k => k !== 'id').map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
        const url = `${this.getBasePath(collection)}/${encodeURIComponent(String(docId))}?${maskFields}`;
        const res = await httpsRequest(url, { method: 'PATCH', headers }, payload);
        if (res.status === 200 && res.body) {
            return fromFirestoreDoc(res.body);
        }
        if (res.status >= 400) {
            throw new Error(`Firestore patch failed (HTTP ${res.status}): ${JSON.stringify(res.body)}`);
        }
        return { id: docId, ...data };
    }

    async deleteDocument(collection, docId) {
        if (this.adminDb) {
            try {
                await this.adminDb.collection(collection).doc(String(docId)).delete();
                return true;
            } catch (e) {
                console.warn(`Admin SDK deleteDocument error (${collection}/${docId}):`, e.message);
            }
        }

        const headers = await this.getAuthHeader();
        const url = `${this.getBasePath(collection)}/${encodeURIComponent(String(docId))}`;
        const res = await httpsRequest(url, { method: 'DELETE', headers });
        return res.status === 200 || res.status === 204;
    }

    // ─── HIGH-LEVEL ENTITY WORKFLOWS ───

    // Users
    async findUserByEmail(email) {
        if (!email) return null;
        const clean = email.toLowerCase().trim();
        const all = await this.listDocuments('users');
        return all.find(u => (u.email || '').toLowerCase().trim() === clean) || null;
    }

    // Appointments
    async createBooking(booking) {
        const id = booking.id || `CCC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        return this.setDocument('bookings', id, {
            ...booking,
            booking_ref: booking.booking_ref || id,
            created_at: booking.created_at || new Date().toISOString()
        });
    }

    async getBookingsForEmail(email) {
        if (!email) return [];
        const clean = email.toLowerCase().trim();
        const all = await this.listDocuments('bookings');
        return all.filter(b => (b.email || '').toLowerCase().trim() === clean);
    }

    // Callers
    async findCallerByEmail(email) {
        if (!email) return null;
        const clean = email.toLowerCase().trim();
        const all = await this.listDocuments('callers');
        return all.find(c => (c.email || '').toLowerCase().trim() === clean) || null;
    }

    // Customers
    async createCustomer(customer) {
        const id = customer.id || `CUST-${Date.now()}`;
        return this.setDocument('customers', id, {
            ...customer,
            created_at: customer.created_at || new Date().toISOString()
        });
    }

    // Activity Logs
    async logActivity(log) {
        const id = `ACT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        return this.setDocument('caller_activities', id, {
            ...log,
            created_at: new Date().toISOString()
        });
    }
}

module.exports = new FirestoreService();
