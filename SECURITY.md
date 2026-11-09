# Security Policy & Architecture - Cube Cad Center

## Reporting Vulnerabilities

If you discover a security vulnerability within Cube Cad Center web applications or APIs, please report it privately to our security administration team:

- **Security Email:** [info@cubecadcenter.co](mailto:info@cubecadcenter.co)
- **Response Commitment:** Initial acknowledgment within 24–48 hours, with status updates until resolved.
- **Responsible Disclosure:** Please do not publicly disclose vulnerabilities before a fix has been deployed.

---

## Security Controls & Best Practices

### 1. HTTP Security Headers
Configured via `vercel.json` edge headers:
- **Content-Security-Policy (CSP):** Restricted script sources (`'self'`, Google Static, Cloudflare Turnstile, Tailwind CDN), frame restrictions, and `frame-ancestors 'none'`.
- **Strict-Transport-Security (HSTS):** `max-age=63072000; includeSubDomains; preload`
- **X-Content-Type-Options:** `nosniff`
- **X-Frame-Options:** `DENY`
- **Referrer-Policy:** `strict-origin-when-cross-origin`
- **Permissions-Policy:** Disables unauthorized access to camera, microphone, and geolocation.

### 2. Authentication & Session Management
- **Role-Based Access Control:** Separate cryptographic scopes for Students, Admissions Callers, and Administrators.
- **No Client-Side Passwords:** Passwords and secrets are never stored in localStorage, sessionStorage, or browser cookies.
- **Admin Endpoints:** Protected by server-side JWT verification and `ADMIN_SECRET` header validation. Unauthorized requests return HTTP 401/403.

### 3. Server-Side Data Protection & Validation
- **Parameterized SQL Queries:** All database lookups and mutations utilize parameterized prepared statements, preventing SQL injection.
- **Input Sanitization:** User-submitted text is stripped of newlines in headers and escaped for HTML entities (`&`, `<`, `>`, `"`, `'`) before template rendering.
- **Masked Logging:** Phone numbers (e.g. `98XXXXXX94`) and email addresses (e.g. `r***l@example.com`) are masked in server logs to prevent PII exposure.
- **Zero Secrets in Repository:** API keys, database credentials, and service accounts are managed strictly through server-side environment variables.

### 4. Spam & Concurrency Protection
- **Honeypot Traps:** Silent bot detection via hidden form fields.
- **Rate Limiting:** Sliding-window per-IP and per-phone request limiters on booking endpoints.
- **Concurrency Mutex:** Atomic server-side lock ensures slot capacity (maximum 3 bookings per slot) is strictly enforced under concurrent race conditions.

