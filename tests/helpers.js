'use strict';
const http = require('http');
const { createApp } = require('../src/app');
const { getConfig } = require('../src/config');

const GOOD_INPUT = { eventType: 'Wedding', guests: 120, budget: 1000000, currency: 'INR', date: '', location: 'Jaipur', style: 'Garden', needs: 'Vegetarian', focus: '', notes: '', priorities: ['Food'] };

const MODEL_PLAN = {
  title: 'Garden wedding', summary: 'A warm plan.',
  budget: [{ category: 'Venue', percent: 40, tips: 'Negotiate.' }, { category: 'Food', percent: 35, tips: 'Taste first.' }, { category: 'Contingency', percent: 25, tips: 'Keep.' }],
  timeline: [{ when: 'Three months before', tasks: ['Book venue'] }, { when: 'Event day', tasks: ['Arrive early'] }],
  vendors: [{ vendor: 'Caterer', priority: 'must', ask: ['Tasting?'], estPercent: 35 }],
  ideas: [{ type: 'Theme', idea: 'Marigold' }], risks: ['Rain'],
};

/** Start the app on a random port. `reply` is what the fake Groq returns. */
async function startApp({ reply, status = 200, apiKey = 'test-key', overrides = {}, delay = 0 } = {}) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body), headers: opts.headers });
    if (delay) await new Promise((r, j) => { const t = setTimeout(r, delay); opts.signal?.addEventListener('abort', () => { clearTimeout(t); j(Object.assign(new Error('aborted'), { name: 'AbortError' })); }); });
    const content = typeof reply === 'function' ? reply(calls.length) : reply;
    return { ok: status < 400, status, text: async () => JSON.stringify(status < 400 ? { choices: [{ message: { content } }] } : { error: { message: 'secret upstream detail' } }) };
  };
  const { createGroqClient } = require('../src/groq');
  const config = { ...getConfig({}), apiKey, ...overrides };
  const groq = apiKey ? createGroqClient({ apiKey, model: 'test-model', timeoutMs: overrides.upstreamTimeoutMs || 5000, fetchImpl }) : null;
  const server = http.createServer(createApp({ config, groq }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, calls, close: () => new Promise(r => server.close(r)) };
}

async function post(base, path, body, headers = {}) {
  const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch { /* not json */ }
  return { res, json };
}

module.exports = { GOOD_INPUT, MODEL_PLAN, startApp, post };
