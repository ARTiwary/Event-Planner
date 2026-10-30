'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createRateLimiter, clientIp, readJsonBody, SECURITY_HEADERS } = require('../src/security');
const { resolveSafe } = require('../src/static');
const { HttpError } = require('../src/errors');
const path = require('path');

test('rate limiter allows up to max, then blocks with a retry time', () => {
  let t = 1000; const check = createRateLimiter({ windowMs: 60000, max: 3, now: () => t });
  assert.equal(check('a').allowed, true); assert.equal(check('a').allowed, true); assert.equal(check('a').allowed, true);
  const blocked = check('a');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter >= 1 && blocked.retryAfter <= 60);
  assert.equal(check('b').allowed, true, 'other clients are unaffected');
});

test('rate limiter resets after the window', () => {
  let t = 0; const check = createRateLimiter({ windowMs: 1000, max: 1, now: () => t });
  assert.equal(check('a').allowed, true); assert.equal(check('a').allowed, false);
  t = 1500; assert.equal(check('a').allowed, true);
});

test('clientIp only trusts X-Forwarded-For behind a proxy', () => {
  const req = { headers: { 'x-forwarded-for': '9.9.9.9, 1.1.1.1' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(clientIp(req, false), '127.0.0.1');
  assert.equal(clientIp(req, true), '9.9.9.9');
});

test('security headers include a strict CSP without inline scripts', () => {
  const csp = SECURITY_HEADERS['Content-Security-Policy'];
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.ok(!/unsafe-inline|unsafe-eval/.test(csp));
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(SECURITY_HEADERS['X-Content-Type-Options'], 'nosniff');
});

test('resolveSafe blocks traversal, dotfiles and encoded tricks', () => {
  const root = path.resolve('/srv/public');
  assert.equal(resolveSafe(root, '/index.html'), path.join(root, 'index.html'));
  assert.equal(resolveSafe(root, '/'), path.join(root, 'index.html'));
  for (const bad of ['/../server.js', '/%2e%2e/.env', '/.env', '/js/../../x', '/%00', '/%zz', '/a/.git/config']) assert.equal(resolveSafe(root, bad), null, bad);
});

async function withBodyServer(max, fn) {
  const server = http.createServer(async (req, res) => {
    try { const b = await readJsonBody(req, max); res.end(JSON.stringify({ ok: true, b })); }
    catch (e) { res.statusCode = e instanceof HttpError ? e.status : 500; res.end(e.message); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise(r => { server.closeAllConnections?.(); server.close(r); }); }
}

test('readJsonBody enforces content type, size and valid JSON', async () => {
  await withBodyServer(50, async base => {
    const ok = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' });
    assert.equal(ok.status, 200);
    assert.equal((await fetch(base, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
    assert.equal((await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
    assert.equal((await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 'y'.repeat(200) }) })).status, 413);
  });
});
