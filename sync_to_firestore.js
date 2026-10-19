/**
 * Safe SQLite -> Cloud Firestore Data Synchronization Tool
 * Cube CAD Center
 *
 * Safely migrates existing local SQLite records to Cloud Firestore.
 * - Uses setDocument with { merge: true } to prevent accidental data overwrites.
 * - Non-destructive: preserves existing IDs and timestamps.
 * - Automatically initializes via Firebase Admin SDK using FIREBASE_SERVICE_ACCOUNT.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const firestoreService = require('./firestore-service');

async function syncAll() {
    console.log('================================================================');
    console.log('STARTING SAFE CLOUD FIRESTORE DATA MIGRATION');
    console.log('Target Project:', firestoreService.projectId);
    console.log('Service Account Configured:', !!firestoreService.serviceAccount);
    console.log('Firebase Admin SDK Mode:', firestoreService.mode);
    console.log('================================================================\n');

    if (!firestoreService.serviceAccount && !process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_CLIENT_EMAIL) {
        console.error('[ERROR] Cannot migrate without Firebase Service Account credentials.');
        console.error('Please configure FIREBASE_SERVICE_ACCOUNT in your environment or .env file.');
        process.exit(1);
    }

    const exportPath = path.resolve(__dirname, 'database_export.json');
    if (!fs.existsSync(exportPath)) {
        console.error('[ERROR] database_export.json not found. Run export first.');
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(exportPath, 'utf8'));

    // 1. Sync Users
    const users = data.users || [];
    console.log(`Syncing ${users.length} Users...`);
    for (const u of users) {
        const docId = u.firebase_uid || String(u.id);
        await firestoreService.setDocument('users', docId, {
            id: u.id,
            name: u.name,
            email: (u.email || '').toLowerCase().trim(),
            phone: u.phone || '',
            firebase_uid: u.firebase_uid || '',
            role: 'student',
            created_at: u.created_at || new Date().toISOString()
        });
    }
    console.log(`[PASS] Users synced.`);

    // 2. Sync Bookings
    const bookings = data.appointments || [];
    console.log(`Syncing ${bookings.length} Bookings/Appointments...`);
    for (const b of bookings) {
        const docId = b.booking_ref || String(b.id);
        await firestoreService.setDocument('bookings', docId, {
            id: b.id,
            booking_ref: b.booking_ref || docId,
            user_id: String(b.user_id || ''),
            name: b.name,
            email: (b.email || '').toLowerCase().trim(),
            phone: b.phone,
            program: b.program,
            branch: b.branch || 'Satellite Campus',
            date: b.date,
            time_slot: b.time_slot,
            mode: b.mode || 'In-Person',
            notes: b.notes || '',
            status: b.status || 'Pending',
            call_status: b.call_status || 'Not Called',
            call_notes: b.call_notes || '',
            assigned_caller_id: b.assigned_caller_id || 0,
            assigned_caller_name: b.assigned_caller_name || 'Unassigned',
            created_at: b.created_at || new Date().toISOString()
        });
    }
    console.log(`[PASS] Bookings synced.`);

    // 3. Sync Callers
    const callers = data.callers || [];
    console.log(`Syncing ${callers.length} Telecallers...`);
    for (const c of callers) {
        const docId = String(c.id);
        await firestoreService.setDocument('callers', docId, {
            id: c.id,
            firebase_uid: c.firebase_uid || '',
            name: c.name,
            email: (c.email || '').toLowerCase().trim(),
            status: c.status || 'Active',
            role: c.role || 'caller',
            created_at: c.created_at || new Date().toISOString()
        });
    }
    console.log(`[PASS] Callers synced.`);

    // 4. Sync Customers (CRM)
    const customers = data.customers || [];
    console.log(`Syncing ${customers.length} Customers...`);
    for (const cust of customers) {
        const docId = String(cust.id);
        let notesHistory = [];
        try { notesHistory = JSON.parse(cust.notes_history || '[]'); } catch (e) {}
        let callLogs = [];
        try { callLogs = JSON.parse(cust.call_logs || '[]'); } catch (e) {}

        await firestoreService.setDocument('customers', docId, {
            id: cust.id,
            name: cust.name,
            mobile: cust.mobile || '',
            email: cust.email || '',
            course: cust.course || '',
            status: cust.status || 'Active',
            assigned_caller_id: cust.assigned_caller_id || 0,
            assigned_caller_name: cust.assigned_caller_name || 'Unassigned',
            notes: cust.notes || '',
            notes_history: notesHistory,
            call_logs: callLogs,
            source: cust.source || 'Direct Entry',
            created_at: cust.created_at || new Date().toISOString()
        });
    }
    console.log(`[PASS] Customers synced.`);

    // 5. Sync Settings & Services
    const services = data.services || [];
    console.log(`Syncing ${services.length} Services...`);
    for (const s of services) {
        await firestoreService.setDocument('services', String(s.id), s);
    }

    const holidays = data.holidays || [];
    console.log(`Syncing ${holidays.length} Holidays...`);
    for (const h of holidays) {
        await firestoreService.setDocument('holidays', String(h.id), h);
    }

    console.log('\n================================================================');
    console.log('[COMPLETED] SQLite data successfully synced to Cloud Firestore.');
    console.log('================================================================');
}

if (require.main === module) {
    syncAll().catch(err => {
        console.error('[ERROR] Sync failed:', err.message);
        process.exit(1);
    });
}

module.exports = { syncAll };
