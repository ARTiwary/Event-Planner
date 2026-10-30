'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { GOOD_INPUT, MODEL_PLAN, startApp, post } = require('./helpers');

test('POST /api/plan returns a sanitised plan whose money adds up', async () => {
  const app = await startApp({ reply: JSON.stringify(MODEL_PLAN) });
  try {
    const { res, json } = await post(app.base, '/api/plan', GOOD_INPUT);
    assert.equal(res.status, 200);
    assert.equal(json.plan.budget.reduce((a, c) => a + c.amount, 0), GOOD_INPUT.budget);
    assert.equal(json.demo, undefined);
    const sent = app.calls[0];
    assert.equal(sent.body.model, 'test-model');
    assert.match(sent.body.messages[1].content, /<event_brief>/);
    assert.equal(sent.headers.Authorization, 'Bearer test-key');
  } finally { await app.close(); }
});

test('POST /api/plan rejects invalid input with a 400 and never calls the AI', async () => {
  const app = await startApp({ reply: '{}' });
  try {
    const { res, json } = await post(app.base, '/api/plan', { ...GOOD_INPUT, guests: -3 });
    assert.equal(res.status, 400); assert.match(json.error, /guests/);
    assert.equal(app.calls.length, 0);
  } finally { await app.close(); }
});

test('POST /api/plan survives fenced JSON from the model', async () => {
  const app = await startApp({ reply: '```json\n' + JSON.stringify(MODEL_PLAN) + '\n```' });
  try { assert.equal((await post(app.base, '/api/plan', GOOD_INPUT)).res.status, 200); } finally { await app.close(); }
});

test('a model reply that is not a plan gives a safe 502', async () => {
  const app = await startApp({ reply: 'sorry I cannot' });
  try {
    const { res, json } = await post(app.base, '/api/plan', GOOD_INPUT);
    assert.equal(res.status, 502); assert.match(json.error, /not a valid plan/);
  } finally { await app.close(); }
});

test('upstream errors are mapped to safe messages and never leak details or the key', async () => {
  for (const [status, code, text] of [[401, 502, /rejected/], [429, 503, /busy/], [500, 502, /error/]]) {
    const app = await startApp({ reply: '', status });
    try {
      const { res, json } = await post(app.base, '/api/plan', GOOD_INPUT);
      assert.equal(res.status, code); assert.match(json.error, text);
      assert.ok(!JSON.stringify(json).includes('secret upstream detail'));
      assert.ok(!JSON.stringify(json).includes('test-key'));
    } finally { await app.close(); }
  }
});

test('a 400 from the AI triggers one retry without optional settings', async () => {
  const app = await startApp({ reply: '', status: 400 });
  try {
    await post(app.base, '/api/plan', GOOD_INPUT);
    assert.equal(app.calls.length, 2);
    assert.ok(app.calls[0].body.reasoning_effort); assert.equal(app.calls[1].body.reasoning_effort, undefined);
  } finally { await app.close(); }
});

test('a slow AI hits the timeout and returns 504', async () => {
  const app = await startApp({ reply: '{}', delay: 500, overrides: { upstreamTimeoutMs: 50 } });
  try { assert.equal((await post(app.base, '/api/plan', GOOD_INPUT)).res.status, 504); } finally { await app.close(); }
});

test('rate limit returns 429 with Retry-After', async () => {
  const app = await startApp({ reply: JSON.stringify(MODEL_PLAN), overrides: { rateLimitPlan: 2 } });
  try {
    await post(app.base, '/api/plan', GOOD_INPUT); await post(app.base, '/api/plan', GOOD_INPUT);
    const { res, json } = await post(app.base, '/api/plan', GOOD_INPUT);
    assert.equal(res.status, 429); assert.ok(Number(res.headers.get('retry-after')) >= 1); assert.match(json.error, /Too many/);
  } finally { await app.close(); }
});

test('POST /api/chat answers, and sends the plan summary as context', async () => {
  const app = await startApp({ reply: 'Move it to Sunday.' });
  try {
    const { res, json } = await post(app.base, '/api/chat', { form: GOOD_INPUT, plan: MODEL_PLAN, messages: [{ role: 'user', content: 'Cut 15%' }] });
    assert.equal(res.status, 200); assert.equal(json.reply, 'Move it to Sunday.');
    assert.match(app.calls[0].body.messages[0].content, /Garden wedding/);
  } finally { await app.close(); }
});

test('POST /api/chat validates its input', async () => {
  const app = await startApp({ reply: 'x' });
  try {
    assert.equal((await post(app.base, '/api/chat', { form: GOOD_INPUT, messages: [] })).res.status, 400);
    assert.equal((await post(app.base, '/api/chat', 'not json')).res.status, 400);
  } finally { await app.close(); }
});

test('without an API key the app runs in demo mode and never calls out', async () => {
  const app = await startApp({ reply: '', apiKey: '' });
  try {
    const { res, json } = await post(app.base, '/api/plan', { ...GOOD_INPUT, eventType: 'Birthday' });
    assert.equal(res.status, 200); assert.equal(json.demo, true);
    assert.equal(json.plan.budget.reduce((a, c) => a + c.amount, 0), GOOD_INPUT.budget);
    const chat = await post(app.base, '/api/chat', { form: GOOD_INPUT, messages: [{ role: 'user', content: 'hi' }] });
    assert.equal(chat.json.demo, true);
    assert.equal((await (await fetch(app.base + '/healthz')).json()).mode, 'demo');
  } finally { await app.close(); }
});

test('every response carries security headers, including errors and static files', async () => {
  const app = await startApp({ reply: '{}' });
  try {
    for (const path of ['/', '/healthz', '/nope']) {
      const r = await fetch(app.base + path);
      assert.match(r.headers.get('content-security-policy'), /default-src 'self'/, path);
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff', path);
    }
  } finally { await app.close(); }
});

test('static serving: index loads, secrets and traversal do not', async () => {
  const app = await startApp({ reply: '{}' });
  try {
    const home = await fetch(app.base + '/'); assert.equal(home.status, 200); assert.match(home.headers.get('content-type'), /text\/html/);
    for (const p of ['/.env', '/%2e%2e/server.js', '/../package.json', '/src/app.js', '/server.js', '/%2e%2e%2f.env']) {
      const r = await fetch(app.base + p); assert.equal(r.status, 404, p);
      assert.ok(!(await r.text()).includes('GROQ_API_KEY'), p);
    }
  } finally { await app.close(); }
});

test('wrong methods get 405', async () => {
  const app = await startApp({ reply: '{}' });
  try {
    const r = await fetch(app.base + '/api/plan'); assert.equal(r.status, 405); assert.equal(r.headers.get('allow'), 'POST');
    assert.equal((await fetch(app.base + '/', { method: 'DELETE' })).status, 405);
  } finally { await app.close(); }
});

test('gzip is used for text assets when the client accepts it', async () => {
  const app = await startApp({ reply: '{}' });
  try {
    const r = await fetch(app.base + '/', { headers: { 'accept-encoding': 'gzip' } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('vary'), /Accept-Encoding/);
  } finally { await app.close(); }
});
