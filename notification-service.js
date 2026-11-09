/**
 * Notification Service for Cube Cad Center
 * Handles multi-channel notifications (Email & Indian DLT-compliant SMS).
 * 
 * Features:
 * - Feature flags: EMAIL_ENABLED, SMS_ENABLED (skips silently if disabled)
 * - Server-side only with no client-side secret exposure
 * - Resilient: Non-blocking, retries once on failure, masked logging
 * - Idempotent per appointment ID and event type
 * - Strict HTML entity escaping and header newline injection protection
 * - Indian TRAI DLT registration compliant SMS templates
 */

const https = require('https');
const http = require('http');

// --- Helper Functions ---

/**
 * Mask sensitive phone number for privacy-compliant logging
 * e.g. "9978999694" -> "99XXXXXX94"
 */
function maskPhone(phone) {
    if (!phone) return 'N/A';
    const clean = String(phone).replace(/\D/g, '');
    if (clean.length < 4) return '***';
    return clean.slice(0, 2) + 'X'.repeat(Math.max(0, clean.length - 4)) + clean.slice(-2);
}

/**
 * Mask sensitive email address for privacy-compliant logging
 * e.g. "student@example.com" -> "s***t@example.com"
 */
function maskEmail(email) {
    if (!email) return 'N/A';
    const parts = String(email).trim().split('@');
    if (parts.length !== 2) return '***';
    const user = parts[0];
    const domain = parts[1];
    const maskedUser = user.length <= 2 
        ? user[0] + '***' 
        : user[0] + '***' + user[user.length - 1];
    return `${maskedUser}@${domain}`;
}

/**
 * Escape HTML special characters to prevent HTML/XSS injection
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Strip newlines (\r, \n) to prevent header injection in email subjects and addresses
 */
function stripNewlines(str) {
    if (!str) return '';
    return String(str).replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Format date and time in Asia/Kolkata timezone (e.g. "Wed, 5 Nov 2026, 11:00 AM IST")
 */
function formatISTDateTime(dateStr, timeSlotStr) {
    if (!dateStr) return timeSlotStr || '';
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        return `${dateStr} ${timeSlotStr || ''} IST`;
    }
    // Noon IST is safe from boundary day shifts
    const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 6, 30, 0));
    const df = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    const dateFormatted = df.format(dt);
    return `${dateFormatted}, ${timeSlotStr || ''} IST`;
}

// In-memory idempotency cache to prevent duplicate notifications per appointment and event
const idempotencyStore = new Set();

class NotificationService {
    constructor() {
        this.emailEnabled = process.env.EMAIL_ENABLED === 'true';
        this.smsEnabled = process.env.SMS_ENABLED === 'true';

        this.siteUrl = (process.env.SITE_URL || 'https://cubecadcenter.co').replace(/\/+$/, '');
        this.emailFrom = process.env.EMAIL_FROM || 'Cube Cad Center <noreply@cubecadcenter.co>';
        this.replyTo = process.env.EMAIL_REPLY_TO || 'info@cubecadcenter.co';
        this.adminEmail = process.env.ADMIN_EMAIL || 'cubecadcenter0711@gmail.com';
        this.adminPhone = process.env.ADMIN_PHONE || '';

        this.emailProvider = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase().trim();
        this.smsProvider = (process.env.SMS_PROVIDER || 'msg91').toLowerCase().trim();

        // Check DLT config once at startup
        this.dltValid = !!(
            process.env.SMS_SENDER_ID &&
            process.env.DLT_ENTITY_ID &&
            (process.env.DLT_TEMPLATE_ID_RECEIVED || process.env.DLT_TEMPLATE_ID_BOOKING)
        );

        if (this.smsEnabled && !this.dltValid) {
            console.warn('[Notification Warning] SMS_ENABLED is true but TRAI DLT variables (SMS_SENDER_ID, DLT_ENTITY_ID, DLT_TEMPLATE_ID_*) are missing. SMS sending will be safely bypassed until configured.');
        }
    }

    /**
     * Generic HTTP/HTTPS POST helper
     */
    async postJson(urlStr, headers, payload) {
        return new Promise((resolve, reject) => {
            const u = new URL(urlStr);
            const isHttps = u.protocol === 'https:';
            const client = isHttps ? https : http;
            const data = JSON.stringify(payload);
            const req = client.request({
                hostname: u.hostname,
                port: u.port || (isHttps ? 443 : 80),
                path: u.pathname + u.search,
                method: 'POST',
                headers: Object.assign({
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }, headers)
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try { resolve(JSON.parse(body || '{}')); } catch (e) { resolve({ body }); }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 150)}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    /**
     * Send email via configured provider (Resend, Brevo, or Nodemailer)
     */
    async sendEmail({ to, subject, html, text }) {
        if (!this.emailEnabled || !to) return { skipped: true };

        const safeSubject = stripNewlines(subject);
        const safeTo = stripNewlines(to);
        const safeFrom = stripNewlines(this.emailFrom);
        const safeReplyTo = stripNewlines(this.replyTo);

        if (this.emailProvider === 'resend') {
            const apiKey = process.env.RESEND_API_KEY;
            if (!apiKey) {
                console.warn('[Email Warning] RESEND_API_KEY missing; skipping email.');
                return { skipped: true };
            }
            return this.postJson('https://api.resend.com/emails', {
                'Authorization': `Bearer ${apiKey}`
            }, {
                from: safeFrom,
                to: [safeTo],
                reply_to: safeReplyTo,
                subject: safeSubject,
                html,
                text
            });
        }

        if (this.emailProvider === 'brevo') {
            const apiKey = process.env.BREVO_API_KEY;
            if (!apiKey) {
                console.warn('[Email Warning] BREVO_API_KEY missing; skipping email.');
                return { skipped: true };
            }
            return this.postJson('https://api.brevo.com/v3/smtp/email', {
                'api-key': apiKey
            }, {
                sender: { name: 'Cube Cad Center', email: safeFrom.replace(/.*<([^>]+)>.*/, '$1') },
                to: [{ email: safeTo }],
                replyTo: { email: safeReplyTo },
                subject: safeSubject,
                htmlContent: html,
                textContent: text
            });
        }

        if (this.emailProvider === 'nodemailer') {
            try {
                const nodemailer = require('nodemailer');
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || 'localhost',
                    port: Number(process.env.SMTP_PORT) || 587,
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });
                return transporter.sendMail({
                    from: safeFrom,
                    to: safeTo,
                    replyTo: safeReplyTo,
                    subject: safeSubject,
                    text,
                    html
                });
            } catch (err) {
                throw new Error(`Nodemailer transport error: ${err.message}`);
            }
        }

        console.warn(`[Email Warning] Unknown EMAIL_PROVIDER '${this.emailProvider}'; skipping email.`);
        return { skipped: true };
    }

    /**
     * Send DLT-compliant SMS to an Indian mobile number
     */
    async sendSms({ phone, messageText, templateId }) {
        if (!this.smsEnabled || !this.dltValid || !phone) return { skipped: true };

        const cleanDigits = String(phone).replace(/\D/g, '');
        const recipient = cleanDigits.length === 12 && cleanDigits.startsWith('91') 
            ? cleanDigits.slice(2) 
            : cleanDigits.slice(-10);

        if (!/^[6-9]\d{9}$/.test(recipient)) {
            console.warn(`[SMS Warning] Invalid recipient phone format: ${maskPhone(recipient)}`);
            return { skipped: true };
        }

        const senderId = process.env.SMS_SENDER_ID;
        const entityId = process.env.DLT_ENTITY_ID;

        if (this.smsProvider === 'msg91') {
            const authKey = process.env.MSG91_AUTH_KEY;
            if (!authKey) return { skipped: true };

            return this.postJson('https://api.msg91.com/api/v2/sendsms', {
                'authkey': authKey
            }, {
                sender: senderId,
                route: '4',
                country: '91',
                dlt_te_id: templateId,
                sms: [{
                    message: messageText,
                    to: [recipient]
                }]
            });
        }

        if (this.smsProvider === 'fast2sms') {
            const apiKey = process.env.FAST2SMS_API_KEY;
            if (!apiKey) return { skipped: true };

            return this.postJson('https://www.fast2sms.com/dev/bulkV2', {
                'authorization': apiKey
            }, {
                route: 'dlt',
                sender_id: senderId,
                message: templateId,
                flash: 0,
                numbers: recipient
            });
        }

        return { skipped: true };
    }

    /**
     * Send initial booking notifications (to student and admin)
     */
    async notifyAppointmentCreated(appointment) {
        const appointmentId = appointment.bookingRef || appointment.booking_ref || String(appointment.id);
        const idempotencyKey = `${appointmentId}:request_received`;

        if (idempotencyStore.has(idempotencyKey)) {
            return { idempotentSkipped: true };
        }
        idempotencyStore.add(idempotencyKey);

        const studentName = escapeHtml(appointment.name);
        const serviceName = escapeHtml(appointment.program || appointment.service || 'CAD/BIM Consultation');
        const branchName = escapeHtml(appointment.branch || 'Satellite Branch');
        const branchAddress = branchName.includes('Bopal')
            ? 'C449, 4th Floor, SoBo Center, South Bopal, Above Gwalia, Ahmedabad 380058'
            : '310, Iscon Emporio, Beside Star Bazaar, Near Jodhpur Cross Road, Satellite, Ahmedabad 380015';
        const mapsLink = branchName.includes('Bopal')
            ? 'https://maps.google.com/?q=Cube+CAD+Center+South+Bopal+Ahmedabad'
            : 'https://maps.google.com/?q=Cube+Cad+Center+Satellite+Ahmedabad';
        const formattedDateTime = formatISTDateTime(appointment.date, appointment.timeSlot || appointment.time_slot);

        // 1. Student Email (if email provided)
        if (appointment.email) {
            const studentHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;">
    <div style="max-width:580px;margin:0 auto;background:#FFFFFF;border-radius:16px;border:1px solid #E2E8F0;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,0.03);">
        <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #E2E8F0;">
            <h1 style="color:#0047AB;font-size:22px;margin:0;font-weight:800;">Cube Cad Center</h1>
            <p style="color:#64748B;font-size:13px;margin:4px 0 0 0;">Premier CAD, BIM & Engineering Institute in Ahmedabad</p>
        </div>
        <div style="padding:24px 0;">
            <p style="font-size:16px;margin:0 0 16px 0;">Hi <strong>${studentName}</strong>,</p>
            <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px 0;">
                We have received your appointment request. Our admissions counseling team is reviewing the schedule and will confirm your slot shortly.
            </p>
            <div style="background:#F1F5F9;border-radius:12px;padding:20px;margin:0 0 24px 0;">
                <table style="width:100%;font-size:14px;border-collapse:collapse;">
                    <tr><td style="padding:6px 0;color:#64748B;width:120px;">Appointment ID:</td><td style="padding:6px 0;font-weight:700;color:#0047AB;font-family:monospace;">${escapeHtml(appointmentId)}</td></tr>
                    <tr><td style="padding:6px 0;color:#64748B;">Service:</td><td style="padding:6px 0;font-weight:600;">${serviceName}</td></tr>
                    <tr><td style="padding:6px 0;color:#64748B;">Branch:</td><td style="padding:6px 0;font-weight:600;">${branchName}</td></tr>
                    <tr><td style="padding:6px 0;color:#64748B;">Address:</td><td style="padding:6px 0;color:#334155;font-size:13px;">${escapeHtml(branchAddress)}</td></tr>
                    <tr><td style="padding:6px 0;color:#64748B;">Date & Time:</td><td style="padding:6px 0;font-weight:700;color:#0F172A;">${escapeHtml(formattedDateTime)}</td></tr>
                    <tr><td style="padding:6px 0;color:#64748B;">Status:</td><td style="padding:6px 0;"><span style="background:#FEF3C7;color:#92400E;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;">Pending Approval</span></td></tr>
                </table>
            </div>
            <div style="display:flex;gap:12px;margin:0 0 24px 0;">
                <a href="${escapeHtml(mapsLink)}" style="display:inline-block;background:#0047AB;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:700;">Open in Google Maps</a>
                <a href="https://wa.me/919978999694?text=Hi%20Cube%20Cad%20Center%2C%20regarding%20my%20appointment%20${escapeHtml(appointmentId)}" style="display:inline-block;background:#25D366;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:700;">Chat on WhatsApp</a>
            </div>
            <p style="font-size:13px;color:#64748B;line-height:1.6;margin:0;">
                Need to reschedule or have questions? Call us at <a href="tel:+919978999694" style="color:#0047AB;font-weight:600;">+91 99789 99694</a> or email <a href="mailto:info@cubecadcenter.co" style="color:#0047AB;">info@cubecadcenter.co</a>.
            </p>
        </div>
        <div style="padding-top:20px;border-top:1px solid #E2E8F0;text-align:center;font-size:12px;color:#94A3B8;">
            <p style="margin:0;">Cube Cad Center &bull; Ahmedabad, Gujarat, India</p>
        </div>
    </div>
</body>
</html>`;

            const studentText = `Hi ${appointment.name},\n\nWe have received your appointment request at Cube Cad Center.\n\nDetails:\n- Appointment ID: ${appointmentId}\n- Service: ${appointment.program || appointment.service}\n- Branch: ${appointment.branch}\n- Address: ${branchAddress}\n- Date & Time: ${formattedDateTime}\n- Status: Pending Approval\n\nGoogle Maps: ${mapsLink}\nWhatsApp Contact: https://wa.me/919978999694\nPhone: +91 99789 99694\n\nCube Cad Center Ahmedabad`;

            this.dispatchWithRetry(() => this.sendEmail({
                to: appointment.email,
                subject: `Appointment Request Received: ${appointmentId}`,
                html: studentHtml,
                text: studentText
            }), `Student email (${maskEmail(appointment.email)})`);
        }

        // 2. Admin Email
        const adminHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;padding:20px;color:#0F172A;">
    <h2>New Appointment Request: ${escapeHtml(appointmentId)}</h2>
    <p>A new student has requested a consultation session:</p>
    <ul>
        <li><strong>Student Name:</strong> ${studentName}</li>
        <li><strong>Phone:</strong> ${escapeHtml(appointment.phone)}</li>
        <li><strong>Email:</strong> ${escapeHtml(appointment.email || 'None provided')}</li>
        <li><strong>Branch:</strong> ${branchName}</li>
        <li><strong>Program/Service:</strong> ${serviceName}</li>
        <li><strong>Date & Time:</strong> ${escapeHtml(formattedDateTime)}</li>
        <li><strong>Notes:</strong> ${escapeHtml(appointment.notes || 'None')}</li>
    </ul>
    <p><a href="${this.siteUrl}/admin.html" style="background:#0047AB;color:#fff;padding:8px 16px;text-decoration:none;border-radius:6px;font-weight:bold;">Open Admin Dashboard to Approve</a></p>
</body>
</html>`;

        this.dispatchWithRetry(() => this.sendEmail({
            to: this.adminEmail,
            subject: `[New Appointment] ${appointmentId} - ${stripNewlines(appointment.name)}`,
            html: adminHtml,
            text: `New Appointment Request:\nID: ${appointmentId}\nName: ${appointment.name}\nPhone: ${appointment.phone}\nEmail: ${appointment.email || 'N/A'}\nBranch: ${appointment.branch}\nProgram: ${appointment.program || appointment.service}\nDate: ${formattedDateTime}\nNotes: ${appointment.notes || 'None'}`
        }), `Admin email (${maskEmail(this.adminEmail)})`);

        // 3. Student SMS (DLT TRAI registered template)
        // Approved template text:
        // "Hi {#var#}, your Cube Cad Center appointment request {#var#} for {#var#} at {#var#} is received. We will confirm shortly. Call {#var#}"
        const dltTemplateId = process.env.DLT_TEMPLATE_ID_RECEIVED || process.env.DLT_TEMPLATE_ID_BOOKING;
        const smsText = `Hi ${appointment.name.slice(0, 20)}, your Cube Cad Center appointment request ${appointmentId} for ${(appointment.program || 'Counseling').slice(0, 25)} at ${appointment.branch.slice(0, 20)} is received. We will confirm shortly. Call 9978999694`;

        this.dispatchWithRetry(() => this.sendSms({
            phone: appointment.phone,
            messageText: smsText,
            templateId: dltTemplateId
        }), `Student SMS (${maskPhone(appointment.phone)})`);

        // 4. Admin SMS (if ADMIN_PHONE set)
        if (this.adminPhone) {
            this.dispatchWithRetry(() => this.sendSms({
                phone: this.adminPhone,
                messageText: `New CCC Request ${appointmentId}: ${appointment.name.slice(0, 15)}, ${appointment.phone}, ${formattedDateTime}. Call 9978999694`,
                templateId: dltTemplateId
            }), `Admin SMS (${maskPhone(this.adminPhone)})`);
        }

        return { dispatched: true };
    }

    /**
     * Send status change notification (e.g. Confirmed or Cancelled/Rejected)
     */
    async notifyStatusChange(appointment, newStatus) {
        const appointmentId = appointment.bookingRef || appointment.booking_ref || String(appointment.id);
        const idempotencyKey = `${appointmentId}:${newStatus.toLowerCase()}`;

        if (idempotencyStore.has(idempotencyKey)) {
            return { idempotentSkipped: true };
        }
        idempotencyStore.add(idempotencyKey);

        const studentName = escapeHtml(appointment.name);
        const branchName = escapeHtml(appointment.branch || 'Satellite Branch');
        const formattedDateTime = formatISTDateTime(appointment.date, appointment.timeSlot || appointment.time_slot);

        const isConfirmed = newStatus === 'Confirmed';
        const isCancelled = newStatus === 'Cancelled' || newStatus === 'Rejected';

        // 1. Email
        if (appointment.email) {
            const subject = isConfirmed 
                ? `Appointment Confirmed - Cube Cad Center [${appointmentId}]`
                : `Appointment Update - Cube Cad Center [${appointmentId}]`;

            const statusBadge = isConfirmed
                ? '<span style="background:#DCFCE7;color:#166534;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;">Confirmed</span>'
                : '<span style="background:#FEE2E2;color:#991B1B;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;">Cancelled</span>';

            const statusMessage = isConfirmed
                ? 'Your appointment has been confirmed! Our senior faculty is looking forward to meeting you.'
                : 'Your appointment could not be confirmed or has been cancelled. Please visit our website or call us to reschedule.';

            const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;padding:24px;background:#F8FAFC;color:#0F172A;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;border:1px solid #E2E8F0;">
        <h2 style="color:#0047AB;margin-top:0;">Cube Cad Center</h2>
        <p>Hi <strong>${studentName}</strong>,</p>
        <p style="color:#334155;font-size:14px;line-height:1.5;">${statusMessage}</p>
        <div style="background:#F1F5F9;border-radius:10px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;font-size:13px;"><strong>Appointment ID:</strong> ${escapeHtml(appointmentId)}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Branch:</strong> ${branchName}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Date & Time:</strong> ${escapeHtml(formattedDateTime)}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Status:</strong> ${statusBadge}</p>
        </div>
        <p style="font-size:13px;color:#64748B;">For inquiries, call <a href="tel:+919978999694">+91 99789 99694</a> or WhatsApp <a href="https://wa.me/919978999694">Click here</a>.</p>
    </div>
</body>
</html>`;

            this.dispatchWithRetry(() => this.sendEmail({
                to: appointment.email,
                subject,
                html: emailHtml,
                text: `Hi ${appointment.name},\n\n${statusMessage}\n\nID: ${appointmentId}\nBranch: ${appointment.branch}\nDate & Time: ${formattedDateTime}\nStatus: ${newStatus}\n\nCube Cad Center Ahmedabad`
            }), `Student status update email (${maskEmail(appointment.email)})`);
        }

        // 2. SMS (DLT TRAI templates)
        if (isConfirmed) {
            // "Hi {#var#}, your appointment {#var#} at Cube Cad Center {#var#} on {#var#} is confirmed. See you there! Call {#var#}"
            const templateId = process.env.DLT_TEMPLATE_ID_CONFIRMED;
            const smsText = `Hi ${appointment.name.slice(0, 15)}, your appointment ${appointmentId} at Cube Cad Center ${appointment.branch.slice(0, 15)} on ${formattedDateTime.slice(0, 20)} is confirmed. See you there! Call 9978999694`;
            this.dispatchWithRetry(() => this.sendSms({
                phone: appointment.phone,
                messageText: smsText,
                templateId
            }), `Student confirmation SMS (${maskPhone(appointment.phone)})`);
        } else if (isCancelled) {
            // "Hi {#var#}, your appointment {#var#} at Cube Cad Center on {#var#} has been cancelled. To reschedule, visit {#var#}"
            const templateId = process.env.DLT_TEMPLATE_ID_CANCELLED;
            const smsText = `Hi ${appointment.name.slice(0, 15)}, your appointment ${appointmentId} at Cube Cad Center on ${formattedDateTime.slice(0, 20)} has been cancelled. To reschedule, visit cubecadcenter.co`;
            this.dispatchWithRetry(() => this.sendSms({
                phone: appointment.phone,
                messageText: smsText,
                templateId
            }), `Student cancellation SMS (${maskPhone(appointment.phone)})`);
        }

        return { dispatched: true };
    }

    /**
     * Dispatches an async action, logging masked errors and retrying once on failure
     */
    dispatchWithRetry(fn, description) {
        // Run completely asynchronously without holding caller thread
        setImmediate(async () => {
            try {
                await fn();
            } catch (err1) {
                console.warn(`[Notification] 1st attempt failed for ${description}: ${err1.message}. Retrying in 1.5s...`);
                setTimeout(async () => {
                    try {
                        await fn();
                    } catch (err2) {
                        console.error(`[Notification Error] 2nd attempt failed for ${description}: ${err2.message}`);
                    }
                }, 1500);
            }
        });
    }
}

// Export singleton instance and helpers
module.exports = new NotificationService();
module.exports.NotificationService = NotificationService;
module.exports.maskPhone = maskPhone;
module.exports.maskEmail = maskEmail;
module.exports.escapeHtml = escapeHtml;
module.exports.stripNewlines = stripNewlines;
module.exports.formatISTDateTime = formatISTDateTime;

