'use strict';
// Gather: AI event planner. Entry point. Run with `node server.js`.
const http = require('http');
const { loadEnv, getConfig } = require('./src/config');
const { createApp } = require('./src/app');
const { createGroqClient } = require('./src/groq');

loadEnv();
const config = getConfig();
const log = (...a) => console.error('[gather]', ...a); // never log user text or keys
const groq = config.apiKey ? createGroqClient({ apiKey: config.apiKey, model: config.model, timeoutMs: config.upstreamTimeoutMs, log }) : null;

const server = http.createServer(createApp({ config, groq, log }));
server.requestTimeout = 90000;
server.headersTimeout = 15000;
server.listen(config.port, () => {
  console.log(`Gather running at http://localhost:${config.port} (${groq ? `live, model ${config.model}` : 'demo mode, no GROQ_API_KEY'})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
process.on('unhandledRejection', e => log('unhandledRejection', e && e.message));
