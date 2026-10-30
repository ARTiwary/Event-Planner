'use strict';
const fs = require('fs');
const path = require('path');

/** Load KEY=value pairs from a .env file without overriding real environment variables. */
function loadEnv(file = path.join(__dirname, '..', '.env')) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/** Build the runtime configuration from process.env. */
function getConfig(env = process.env) {
  const int = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);
  return {
    apiKey: env.GROQ_API_KEY || '',
    model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
    port: int(env.PORT, 3000),
    trustProxy: env.TRUST_PROXY === '1',
    upstreamTimeoutMs: int(env.UPSTREAM_TIMEOUT_MS, 60000),
    rateLimitPlan: int(env.RATE_LIMIT_PLAN, 8),
    rateLimitChat: int(env.RATE_LIMIT_CHAT, 30),
    rateWindowMs: int(env.RATE_WINDOW_MS, 60000),
    maxBodyBytes: 24 * 1024,
  };
}

module.exports = { loadEnv, getConfig };
