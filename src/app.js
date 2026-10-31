'use strict';
const path = require('path');
const { HttpError } = require('./errors');
const { validateInput, validateChat, sanitizePlan, parsePlan } = require('./validate');
const { SYSTEM, buildPlanPrompt, buildChatSystem } = require('./prompts');
const { SECURITY_HEADERS, createRateLimiter, clientIp, readJsonBody } = require('./security');
const { serveStatic } = require('./static');
const { demoPlan } = require('./demo');

/**
 * Build the request handler. Everything it depends on is passed in, so tests can supply fakes.
 * @param {{config: import('./types').Config, groq: import('./types').GroqClient | null, publicDir?: string, log?: import('./types').Logger, now?: () => Date}} deps
 */
function createApp({ config, groq, publicDir = path.join(__dirname, '..', 'public'), log = () => {}, now = () => new Date() }) {
  const planLimit = createRateLimiter({ windowMs: config.rateWindowMs, max: config.rateLimitPlan });
  const chatLimit = createRateLimiter({ windowMs: config.rateWindowMs, max: config.rateLimitChat });
  const demo = !groq;

  function sendJson(res, status, body, headers = {}) {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(data), ...headers });
    res.end(data);
  }

  function limit(req, res, check) {
    const r = check(clientIp(req, config.trustProxy));
    if (r.allowed) return true;
    throw new HttpError(429, 'Too many requests. Please wait a moment and try again.', { retryAfter: r.retryAfter });
  }

  async function handlePlan(req, res) {
    limit(req, res, planLimit);
    const v = validateInput(await readJsonBody(req, config.maxBodyBytes));
    if (v.ok === false) throw new HttpError(400, v.errors[0]);
    const input = v.value;
    if (demo) return sendJson(res, 200, { demo: true, plan: sanitizePlan(demoPlan(input), input.budget) });
    const reply = await groq.call([{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPlanPrompt(input, now()) }], { json: true });
    return sendJson(res, 200, { plan: sanitizePlan(parsePlan(reply), input.budget) });
  }

  async function handleChat(req, res) {
    limit(req, res, chatLimit);
    const { form, messages, plan } = validateChat(await readJsonBody(req, config.maxBodyBytes));
    if (demo) return sendJson(res, 200, { demo: true, reply: 'This is demo mode. Add a Groq API key on the server to chat with the planner.' });
    const reply = await groq.call([{ role: 'system', content: buildChatSystem(form, plan) }, ...messages]);
    return sendJson(res, 200, { reply: reply.slice(0, 4000) });
  }

  return async function handler(req, res) {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    try {
      const url = req.url.split('?')[0];
      if (url === '/healthz') return sendJson(res, 200, { ok: true, mode: demo ? 'demo' : 'live' });
      if (url === '/api/plan' || url === '/api/chat') {
        if (req.method !== 'POST') throw new HttpError(405, 'Use POST for this endpoint.', { allow: 'POST' });
        return url === '/api/plan' ? await handlePlan(req, res) : await handleChat(req, res);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.', { allow: 'GET, HEAD' });
      if (await serveStatic(req, res, publicDir)) return;
      throw new HttpError(404, 'Not found.');
    } catch (e) {
      const known = e instanceof HttpError;
      if (!known) log('unhandled', e && e.stack ? e.stack.split('\n')[0] : String(e));
      const status = known ? e.status : 500;
      const headers = {};
      if (known && e.extra.retryAfter) headers['Retry-After'] = String(e.extra.retryAfter);
      if (known && e.extra.allow) headers.Allow = e.extra.allow;
      if (res.headersSent) return res.end();
      sendJson(res, status, { error: known ? e.message : 'Something went wrong on the server.' }, headers);
    }
  };
}

module.exports = { createApp };
