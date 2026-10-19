/**
 * Firebase Client SDK & Firestore Service
 * Project: cube-cad-center
 */

const firebaseConfig = {
  apiKey: "AIzaSyDBdKpF_64kpxJ3JxBuRAMjRBCVnMisorI",
  authDomain: "cube-cad-center.firebaseapp.com",
  projectId: "cube-cad-center",
  storageBucket: "cube-cad-center.firebasestorage.app",
  messagingSenderId: "601288999504",
  appId: "1:601288999504:web:b3cd86b733d244650fc755",
  measurementId: "G-MLRGQ6FRD3"
};

// Global Firebase Manager
window.FirebaseDB = {
  app: null,
  db: null,
  analytics: null,
  auth: null,
  isReady: false,

  init: function() {
    if (typeof firebase === 'undefined') {
      console.warn("Firebase SDK script not loaded yet.");
      return false;
    }

    try {
      if (!firebase.apps || !firebase.apps.length) {
        this.app = firebase.initializeApp(firebaseConfig);
      } else {
        this.app = firebase.app();
      }

      this.db = firebase.firestore();

      if (typeof firebase.auth === 'function') {
        this.auth = firebase.auth();
      }

      try {
        this.analytics = firebase.analytics();
      } catch (ae) {
        // Analytics may be ignored on local environments
      }

      this.isReady = true;
      console.log("🔥 Firebase connected successfully: cube-cad-center");
      window.dispatchEvent(new CustomEvent('firebase-connected', { detail: { projectId: firebaseConfig.projectId } }));
      return true;
    } catch (err) {
      console.error("Firebase connection error:", err);
      return false;
    }
  },

  signUp: async function(email, password, displayName) {
    if (!this.init()) throw new Error("Firebase not initialized");
    if (!this.auth) throw new Error("Firebase Auth SDK not loaded");
    const userCredential = await this.auth.createUserWithEmailAndPassword(email.trim(), password);
    if (displayName && userCredential.user && userCredential.user.updateProfile) {
      try {
        await userCredential.user.updateProfile({ displayName: displayName.trim() });
      } catch (e) {
        console.warn("Could not set displayName on Firebase user:", e);
      }
    }
    return userCredential.user;
  },

  signIn: async function(email, password) {
    if (!this.init()) throw new Error("Firebase not initialized");
    if (!this.auth) throw new Error("Firebase Auth SDK not loaded");
    return this.auth.signInWithEmailAndPassword(email.trim(), password);
  },

  signOut: async function() {
    if (!this.init() || !this.auth) return;
    return this.auth.signOut();
  },

  getCurrentUser: function() {
    if (!this.init() || !this.auth) return null;
    return this.auth.currentUser;
  },

  getIdToken: async function(forceRefresh = false) {
    if (!this.init() || !this.auth) return null;
    const user = this.auth.currentUser;
    if (!user) return null;
    return user.getIdToken(forceRefresh);
  },

  onAuthStateChanged: function(callback) {
    if (!this.init() || !this.auth) {
      setTimeout(() => {
        if (this.init() && this.auth) {
          this.auth.onAuthStateChanged(callback);
        }
      }, 300);
      return () => {};
    }
    return this.auth.onAuthStateChanged(callback);
  },

  // ─── BOOKINGS / APPOINTMENTS ───
  saveBooking: async function(bookingData) {
    if (!this.init()) throw new Error("Firebase not initialized");

    const currUser = this.getCurrentUser();
    const payload = {
      booking_ref: bookingData.booking_ref || bookingData.bookingRef || ('CCC-' + Math.floor(100000 + Math.random() * 900000)),
      user_id: currUser ? currUser.uid : (bookingData.user_id || ''),
      name: bookingData.name || '',
      email: (currUser && currUser.email) || bookingData.email || '',
      phone: bookingData.phone || '',
      program: bookingData.program || bookingData.service || '',
      branch: bookingData.branch || 'Satellite Campus',
      date: bookingData.date || '',
      time_slot: bookingData.time_slot || bookingData.timeSlot || '',
      mode: bookingData.mode || 'In-Person',
      notes: bookingData.notes || '',
      status: bookingData.status || 'Pending',
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      created_at_iso: new Date().toISOString()
    };

    const docRef = await this.db.collection('bookings').add(payload);
    return { id: docRef.id, ...payload };
  },

  getBookings: async function() {
    if (!this.init()) return [];
    try {
      const snap = await this.db.collection('bookings').get();
      const list = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort newest first
      list.sort((a, b) => {
        const da = a.created_at_iso || (a.date ? a.date + ' ' + (a.time_slot || '') : '');
        const db = b.created_at_iso || (b.date ? b.date + ' ' + (b.time_slot || '') : '');
        return db.localeCompare(da);
      });
      return list;
    } catch (e) {
      console.warn("Firestore getBookings error:", e);
      return [];
    }
  },

  listenBookings: function(onUpdate, onError) {
    if (!this.init()) return () => {};
    try {
      return this.db.collection('bookings').onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        list.sort((a, b) => {
          const da = a.created_at_iso || (a.date ? a.date + ' ' + (a.time_slot || '') : '');
          const db = b.created_at_iso || (b.date ? b.date + ' ' + (b.time_slot || '') : '');
          return db.localeCompare(da);
        });
        if (onUpdate) onUpdate(list);
      }, err => {
        console.error("listenBookings error:", err);
        if (onError) onError(err);
      });
    } catch (err) {
      console.error("listenBookings subscribe error:", err);
      return () => {};
    }
  },

  updateBookingStatus: async function(id, status) {
    if (!this.init()) throw new Error("Firebase not initialized");
    await this.db.collection('bookings').doc(String(id)).update({
      status: status,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  },

  rescheduleBooking: async function(id, date, timeSlot, status) {
    if (!this.init()) throw new Error("Firebase not initialized");
    const updateObj = {
      date: date,
      time_slot: timeSlot,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (status) updateObj.status = status;
    await this.db.collection('bookings').doc(String(id)).update(updateObj);
    return true;
  },

  deleteBooking: async function(id) {
    if (!this.init()) throw new Error("Firebase not initialized");
    await this.db.collection('bookings').doc(String(id)).delete();
    return true;
  },

  // ─── USER DATA ───
  saveUser: async function(userData) {
    if (!this.init()) throw new Error("Firebase not initialized");

    const payload = {
      name: userData.name || '',
      email: (userData.email || '').toLowerCase().trim(),
      phone: userData.phone || '',
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      created_at_iso: new Date().toISOString(),
      role: userData.role || 'student'
    };

    const currUser = this.getCurrentUser();
    const uid = (currUser && currUser.uid) || userData.uid || userData.user_id || '';
    if (uid) payload.uid = uid;

    // Use user auth UID if available to satisfy Firestore security rules (request.auth.uid == userId)
    if (uid) {
      await this.db.collection('users').doc(uid).set(payload, { merge: true });
      return { id: uid, ...payload };
    } else if (payload.email) {
      await this.db.collection('users').doc(payload.email).set(payload, { merge: true });
      return { id: payload.email, ...payload };
    } else {
      const docRef = await this.db.collection('users').add(payload);
      return { id: docRef.id, ...payload };
    }
  },

  getUsers: async function() {
    if (!this.init()) return [];
    try {
      const snap = await this.db.collection('users').get();
      const list = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => (b.created_at_iso || '').localeCompare(a.created_at_iso || ''));
      return list;
    } catch (e) {
      console.warn("Firestore getUsers error:", e);
      return [];
    }
  },

  listenUsers: function(onUpdate, onError) {
    if (!this.init()) return () => {};
    try {
      return this.db.collection('users').onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        list.sort((a, b) => (b.created_at_iso || '').localeCompare(a.created_at_iso || ''));
        if (onUpdate) onUpdate(list);
      }, err => {
        console.error("listenUsers error:", err);
        if (onError) onError(err);
      });
    } catch (err) {
      console.error("listenUsers subscribe error:", err);
      return () => {};
    }
  },

  deleteUser: async function(id) {
    if (!this.init()) throw new Error("Firebase not initialized");
    await this.db.collection('users').doc(String(id)).delete();
    return true;
  },

  // ─── CUSTOMER DATA (EXCEL IMPORT & DIRECT) ───
  saveCustomer: async function(customerData) {
    if (!this.init()) throw new Error("Firebase not initialized");

    const cleanMobile = String(customerData.mobile || customerData.phone || '').trim();
    const cleanEmail = (customerData.email || '').toLowerCase().trim();
    const nowIso = new Date().toISOString();
    const payload = {
      name: customerData.name || '',
      mobile: cleanMobile,
      email: cleanEmail,
      course: customerData.course || customerData.program || '',
      status: customerData.status || 'Active',
      notes: customerData.notes || '',
      notes_history: customerData.notes_history || (customerData.notes ? [{
        text: customerData.notes,
        created_at: nowIso,
        author: 'Admin'
      }] : []),
      call_logs: customerData.call_logs || [],
      last_called_at: customerData.last_called_at || null,
      last_call_status: customerData.last_call_status || null,
      source: customerData.source || 'Direct Entry',
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      created_at_iso: nowIso,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await this.db.collection('customers').add(payload);
    return { id: docRef.id, ...payload };
  },

  getCustomers: async function() {
    if (!this.init()) return [];
    try {
      const snap = await this.db.collection('customers').get();
      const list = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => (b.created_at_iso || '').localeCompare(a.created_at_iso || ''));
      return list;
    } catch (e) {
      console.warn("Firestore getCustomers error:", e);
      return [];
    }
  },

  listenCustomers: function(onUpdate, onError) {
    if (!this.init()) return () => {};
    try {
      return this.db.collection('customers').onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        list.sort((a, b) => (b.created_at_iso || '').localeCompare(a.created_at_iso || ''));
        if (onUpdate) onUpdate(list);
      }, err => {
        console.error("listenCustomers error:", err);
        if (onError) onError(err);
      });
    } catch (err) {
      console.error("listenCustomers subscribe error:", err);
      return () => {};
    }
  },

  updateCustomer: async function(id, updateData) {
    if (!this.init()) throw new Error("Firebase not initialized");
    const payload = {
      ...updateData,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    await this.db.collection('customers').doc(String(id)).update(payload);
    return true;
  },

  addCustomerNote: async function(id, noteText, author = 'Admin') {
    if (!this.init()) throw new Error("Firebase not initialized");
    const docRef = this.db.collection('customers').doc(String(id));
    const docSnap = await docRef.get();
    if (!docSnap.exists) throw new Error("Customer not found");

    const data = docSnap.data();
    const history = data.notes_history || [];
    const newEntry = {
      text: noteText,
      created_at: new Date().toISOString(),
      author: author
    };
    history.unshift(newEntry);

    await docRef.update({
      notes: noteText,
      notes_history: history,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    return history;
  },

  addCustomerCallLog: async function(id, callLog) {
    if (!this.init()) throw new Error("Firebase not initialized");
    const docRef = this.db.collection('customers').doc(String(id));
    const docSnap = await docRef.get();
    if (!docSnap.exists) throw new Error("Customer not found");

    const data = docSnap.data();
    const logs = data.call_logs || [];
    const entry = {
      timestamp: new Date().toISOString(),
      status: callLog.status || 'Connected',
      notes: callLog.notes || '',
      agent: callLog.agent || 'Admin',
      next_follow_up: callLog.next_follow_up || null
    };
    logs.unshift(entry);

    await docRef.update({
      call_logs: logs,
      last_called_at: entry.timestamp,
      last_call_status: entry.status,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    return logs;
  },

  deleteCustomer: async function(id) {
    if (!this.init()) throw new Error("Firebase not initialized");
    await this.db.collection('customers').doc(String(id)).delete();
    return true;
  },

  batchImportCustomers: async function(records, options = { skipDuplicates: true, updateExisting: false }) {
    if (!this.init()) throw new Error("Firebase not initialized");
    if (!records || !records.length) return { imported: 0, skipped: 0, updated: 0, total: 0 };

    // 1. Fetch existing customers to identify duplicates
    const existing = await this.getCustomers();
    const existingPhoneMap = new Map();
    const existingEmailMap = new Map();

    const normalizePhone = (p) => {
      if (!p) return '';
      const digits = String(p).replace(/\D/g, '');
      return digits.length >= 10 ? digits.slice(-10) : digits;
    };

    existing.forEach(c => {
      const p = normalizePhone(c.mobile || c.phone);
      if (p) existingPhoneMap.set(p, c);
      const e = (c.email || '').toLowerCase().trim();
      if (e) existingEmailMap.set(e, c);
    });

    const fileSeenPhones = new Set();
    const fileSeenEmails = new Set();

    let imported = 0;
    let skipped = 0;
    let updated = 0;

    // Process in chunks of 400 for Firestore batch write limit (max 500)
    const BATCH_SIZE = 400;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const chunk = records.slice(i, i + BATCH_SIZE);
      const batch = this.db.batch();

      for (const row of chunk) {
        const name = (row.name || row.Name || row.customer_name || '').trim();
        const rawMobile = row.mobile || row.Mobile || row.phone || row.Phone || row.contact || '';
        const normPhone = normalizePhone(rawMobile);
        const email = (row.email || row.Email || '').toLowerCase().trim();
        const course = (row.course || row.Course || row.program || row.Program || '').trim();
        const status = (row.status || row.Status || 'Active').trim();
        const notes = (row.notes || row.Notes || row.remarks || row.Remarks || '').trim();

        // Check if duplicate within file
        const isFileDup = (normPhone && fileSeenPhones.has(normPhone)) || (email && fileSeenEmails.has(email));
        if (normPhone) fileSeenPhones.add(normPhone);
        if (email) fileSeenEmails.add(email);

        // Check against existing database
        const existingRecord = (normPhone && existingPhoneMap.get(normPhone)) || (email && existingEmailMap.get(email));

        if (isFileDup || existingRecord) {
          if (options.updateExisting && existingRecord) {
            const docRef = this.db.collection('customers').doc(existingRecord.id);
            const updatePayload = {
              updated_at: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (name && !existingRecord.name) updatePayload.name = name;
            if (course && !existingRecord.course) updatePayload.course = course;
            if (status && status !== 'Active') updatePayload.status = status;
            if (notes) {
              const hist = existingRecord.notes_history || [];
              hist.unshift({ text: notes, created_at: new Date().toISOString(), author: 'Excel Import' });
              updatePayload.notes = notes;
              updatePayload.notes_history = hist;
            }
            batch.update(docRef, updatePayload);
            updated++;
            continue;
          }

          if (options.skipDuplicates) {
            skipped++;
            continue;
          }
        }

        // New record
        const docRef = this.db.collection('customers').doc();
        const nowIso = new Date().toISOString();
        const payload = {
          name: name || 'Unnamed Customer',
          mobile: rawMobile ? String(rawMobile).trim() : '',
          email: email,
          course: course || 'General Inquiry',
          status: status || 'Active',
          notes: notes,
          notes_history: notes ? [{ text: notes, created_at: nowIso, author: 'Excel Import' }] : [],
          call_logs: [],
          last_called_at: null,
          source: 'Excel Import',
          created_at: firebase.firestore.FieldValue.serverTimestamp(),
          created_at_iso: nowIso,
          updated_at: firebase.firestore.FieldValue.serverTimestamp()
        };

        batch.set(docRef, payload);
        imported++;

        // Add to map so subsequent rows in same file respect it
        if (normPhone) existingPhoneMap.set(normPhone, { id: docRef.id, ...payload });
        if (email) existingEmailMap.set(email, { id: docRef.id, ...payload });
      }

      await batch.commit();
    }

    return {
      total: records.length,
      imported,
      skipped,
      updated
    };
  }
};

// Auto-initialize when script loads
if (typeof firebase !== 'undefined') {
  window.FirebaseDB.init();
} else {
  window.addEventListener('DOMContentLoaded', () => {
    window.FirebaseDB.init();
  });
}
