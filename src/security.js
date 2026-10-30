'use strict';
const { HttpError } = require('./errors');

/** Headers added to every response. The CSP allows only our own scripts and Google Fonts. */
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'", "script-src 'self'", "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com", "img-src 'self' data:", "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
    "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

/** Fixed-window rate limiter keyed by client id (usually IP). */
function createRateLimiter({ windowMs, max, now = Date.now }) {
  const hits = new Map();
  return function check(key) {
    const t = now();
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= t) hits.delete(k);
    let e = hits.get(key);
    if (!e || e.reset <= t) { e = { count: 0, reset: t + windowMs }; hits.set(key, e); }
    e.count++;
    return e.count <= max ? { allowed: true, retryAfter: 0 } : { allowed: false, retryAfter: Math.max(1, Math.ceil((e.reset - t) / 1000)) };
  };
}

/** Client address. X-Forwarded-For is only trusted when the app runs behind a known proxy. */
function clientIp(req, trustProxy) {
  if (trustProxy) {
    const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xf) return xf;
  }
  return req.socket.remoteAddress || 'unknown';
}

/** Read and parse a JSON body with a hard size cap. */
function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return reject(new HttpError(415, 'Send the request as application/json.'));
    if (Number(req.headers['content-length']) > maxBytes) return reject(new HttpError(413, 'The request is too large.'));
    const chunks = []; let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > maxBytes) { reject(new HttpError(413, 'The request is too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new HttpError(400, 'The request body is not valid JSON.')); } });
    req.on('error', () => reject(new HttpError(400, 'The request could not be read.')));
  });
}

module.exports = { SECURITY_HEADERS, createRateLimiter, clientIp, readJsonBody };
