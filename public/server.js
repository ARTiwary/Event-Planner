// AI Event Planner — zero-dependency Node server (Node 18+).
// Calls Groq's OpenAI-compatible API with an OpenAI open-weight model.
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- tiny .env loader (no dotenv needed) ---
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach(l => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch {}

const KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const PORT = process.env.PORT || 3000;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM = `You are an expert event planner for weddings, birthdays and community events.
Be practical, specific, culturally aware and budget-honest. Never exceed the user's budget.
Respond ONLY with valid JSON matching this schema:
{
 "title": string, "summary": string (2-3 sentences),
 "budget": [ {"category": string, "percent": number, "tips": string} ]  // percents sum to 100
 "timeline": [ {"when": string, "tasks": [string]} ]  // from earliest to event day, relative to the event date
 "vendors": [ {"vendor": string, "priority": "must"|"nice", "ask": [string], "estPercent": number} ]
 "ideas": [ {"type": string, "idea": string} ]  // themes, decor, food, activities, entertainment, favors, personalised touches
 "risks": [string]  // top things that commonly go wrong + a fix
}
Use 6-9 budget categories, 5-8 timeline stages, 5-9 vendors, 8-12 ideas, 3-5 risks.`;

async function groq(messages, json) {
  const body = { model: MODEL, messages, temperature: 0.7, max_completion_tokens: 6000, reasoning_effort: 'low' };
  if (json) body.response_format = { type: 'json_object' };
  const r = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Groq error ${r.status}`);
  return data.choices[0].message.content;
}

// Make the numbers always add up, regardless of what the model returned.
function normalize(plan, budget) {
  const cats = Array.isArray(plan.budget) ? plan.budget : [];
  const total = cats.reduce((s, c) => s + (Number(c.percent) || 0), 0) || 1;
  cats.forEach(c => {
    c.percent = Math.round(((Number(c.percent) || 0) / total) * 1000) / 10;
    c.amount = Math.round((c.percent / 100) * budget);
  });
  (plan.vendors || []).forEach(v => (v.estAmount = Math.round(((Number(v.estPercent) || 0) / 100) * budget)));
  plan.budgetTotal = budget;
  return plan;
}

const DEMO = (f) => ({
  title: `${f.eventType} for ${f.guests} guests`,
  summary: 'A sample plan that shows the layout. Real plans are written by the AI for your exact event.',
  budget: [['Venue',30],['Food & drinks',30],['Decor',10],['Photography',10],['Entertainment',8],['Attire & favors',7],['Contingency',5]].map(([category,percent]) => ({category,percent,tips:'Negotiate off-peak dates and bundle services.'})),
  timeline: [{when:'3 months before',tasks:['Fix budget & guest list','Book venue']},{when:'1 month before',tasks:['Confirm vendors','Send invites']},{when:'1 week before',tasks:['Final headcount','Run-of-show']},{when:'Event day',tasks:['Setup 4h early','Assign a point person']}],
  vendors: [{vendor:'Venue',priority:'must',ask:['Capacity','Cancellation policy'],estPercent:30},{vendor:'Caterer',priority:'must',ask:['Tasting','Dietary options'],estPercent:30},{vendor:'Photographer',priority:'nice',ask:['Package hours'],estPercent:10}],
  ideas: [{type:'Theme',idea:'Golden-hour garden party'},{type:'Activity',idea:'Guest memory-jar station'}],
  risks: ['Weather: keep an indoor backup.'],
});

function readBody(req) {
  return new Promise((res, rej) => {
    let b = ''; req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch (e) { rej(e); } });
  });
}
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/plan') {
      const f = await readBody(req);
      const budget = Math.max(0, Number(f.budget) || 0);
      if (!KEY) return send(res, 200, { demo: true, plan: normalize(DEMO(f), budget) });
      const prompt = `Plan this event:
Type: ${f.eventType}
Guests: ${f.guests}
Total budget: ${budget} ${f.currency}
Event date: ${f.date || 'not fixed (assume ~3 months away)'}
Location: ${f.location || 'unspecified'}
Style / theme wishes: ${f.style || 'none'}
Culture, dietary or accessibility needs: ${f.needs || 'none'}
Extra notes: ${f.notes || 'none'}`;
      const raw = await groq([{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], true);
      return send(res, 200, { plan: normalize(JSON.parse(raw), budget) });
    }
    if (req.method === 'POST' && req.url === '/api/chat') {
      const { messages = [], plan, form } = await readBody(req);
      if (!KEY) return send(res, 200, { reply: 'Demo mode: add GROQ_API_KEY to .env to chat with the planner.' });
      const sys = `You are a friendly, concise event-planning assistant. The user's event: ${JSON.stringify(form)}.
Current plan (JSON): ${JSON.stringify(plan).slice(0, 7000)}.
Answer follow-ups, suggest swaps that keep within budget, draft invitations or toasts, and show cost trade-offs. Use short paragraphs or bullets.`;
      const reply = await groq([{ role: 'system', content: sys }, ...messages.slice(-12)], false);
      return send(res, 200, { reply });
    }
    // static files
    const file = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const p = path.join(__dirname, 'public', path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
    if (!p.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(p)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'text/plain' });
    fs.createReadStream(p).pipe(res);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}).listen(PORT, () => console.log(`Event planner running → http://localhost:${PORT}  (${KEY ? 'Groq: ' + MODEL : 'DEMO mode, no GROQ_API_KEY'})`));
