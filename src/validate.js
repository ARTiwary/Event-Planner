'use strict';
const { HttpError } = require('./errors');

const EVENT_TYPES = ['Wedding', 'Birthday', 'Community event'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD'];
const PRIORITIES = ['Food', 'Music', 'Photography', 'Decor', 'Venue', 'Entertainment', 'Guest comfort', 'Sustainability'];
const LIMITS = { guests: [1, 5000], budget: [1, 1e9], location: 120, style: 200, needs: 200, focus: 200, notes: 800, maxPriorities: 4 };

/**
 * Strip control characters, collapse whitespace, trim and cap the length.
 * @param {unknown} value
 * @param {number} max
 */
function cleanText(value, max) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex -- removing control characters is the point
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** @param {string} s */
function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100;
}

/**
 * Validate and normalise the planning form sent by the browser.
 * @param {unknown} raw
 * @returns {import('./types').ValidationResult}
 */
function validateInput(raw) {
  /** @type {string[]} */
  const errors = [];
  /** @type {Record<string, any>} */
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (!EVENT_TYPES.includes(r.eventType)) errors.push(`eventType must be one of: ${EVENT_TYPES.join(', ')}`);
  const guests = Number(r.guests);
  if (!Number.isInteger(guests) || guests < LIMITS.guests[0] || guests > LIMITS.guests[1]) errors.push(`guests must be a whole number from ${LIMITS.guests[0]} to ${LIMITS.guests[1]}`);
  const budget = Number(r.budget);
  if (!Number.isFinite(budget) || budget < LIMITS.budget[0] || budget > LIMITS.budget[1]) errors.push('budget must be a positive number');
  if (!CURRENCIES.includes(r.currency)) errors.push(`currency must be one of: ${CURRENCIES.join(', ')}`);
  const date = cleanText(r.date, 10);
  if (date && !isValidDate(date)) errors.push('date must be a valid YYYY-MM-DD date');
  const priorities = Array.isArray(r.priorities)
    ? [...new Set(r.priorities.filter(p => PRIORITIES.includes(p)))].slice(0, LIMITS.maxPriorities)
    : [];
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      eventType: r.eventType, guests, budget: Math.round(budget), currency: r.currency, date, priorities,
      location: cleanText(r.location, LIMITS.location), style: cleanText(r.style, LIMITS.style),
      needs: cleanText(r.needs, LIMITS.needs), focus: cleanText(r.focus, LIMITS.focus), notes: cleanText(r.notes, LIMITS.notes),
    },
  };
}

/** @type {(v: unknown, lo: number, hi: number, d?: number) => number} */
const num = (v, lo, hi, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
/** @type {(v: unknown, max: number) => any[]} */
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
/** @type {(v: unknown, max: number) => any[]} */
const lastN = (v, max) => (Array.isArray(v) ? v.slice(-max) : []);

/**
 * Split `total` into integer parts proportional to `weights`, so the parts always add up exactly.
 * @param {number} total
 * @param {number[]} weights
 * @returns {number[]}
 */
function allocate(total, weights) {
  const positive = weights.some(w => w > 0);
  const w = positive ? weights : weights.map(() => 1); // all-zero weights: split evenly
  const sum = w.reduce((a, b) => a + b, 0);
  const raw = w.map(x => (x / sum) * total);
  const parts = raw.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { parts[i]++; left--; } });
  return parts;
}

/**
 * Turn untrusted model output into a plan with a guaranteed shape.
 * Unknown fields are dropped, strings are capped, and money always adds up to the budget.
 * @param {unknown} plan
 * @param {number} budget
 * @returns {import('./types').Plan}
 */
function sanitizePlan(plan, budget) {
  /** @type {Record<string, any>} */
  const p = plan && typeof plan === 'object' ? plan : {};
  /** @type {import('./types').BudgetLine[]} */
  const cats = list(p.budget, 12).map(c => ({
    category: cleanText(c?.category, 60), percent: num(c?.percent, 0, 100), tips: cleanText(c?.tips, 260), amount: 0,
  })).filter(c => c.category);
  if (cats.length < 2) throw new HttpError(502, 'The AI reply did not contain a usable budget. Please try again.');
  const amounts = allocate(budget, cats.map(c => c.percent));
  const sumPct = cats.reduce((a, c) => a + c.percent, 0) || 1;
  cats.forEach((c, i) => { c.amount = amounts[i]; c.percent = Math.round((c.percent / sumPct) * 1000) / 10; });

  const timeline = list(p.timeline, 10).map(s => ({
    when: cleanText(s?.when, 60), tasks: list(s?.tasks, 8).map(t => cleanText(t, 180)).filter(Boolean),
  })).filter(s => s.when && s.tasks.length);
  /** @type {import('./types').Vendor[]} */
  const vendors = list(p.vendors, 12).map(v => {
    const estPercent = num(v?.estPercent, 0, 100);
    return {
      vendor: cleanText(v?.vendor, 60), priority: /** @type {'must' | 'nice'} */ (v?.priority === 'must' ? 'must' : 'nice'),
      ask: list(v?.ask, 5).map(a => cleanText(a, 160)).filter(Boolean), estPercent, estAmount: Math.round((estPercent / 100) * budget),
    };
  }).filter(v => v.vendor);
  const ideas = list(p.ideas, 16).map(i => ({ type: cleanText(i?.type, 40), idea: cleanText(i?.idea, 220) })).filter(i => i.idea);
  const risks = list(p.risks, 8).map(r => cleanText(r, 260)).filter(Boolean);
  return {
    title: cleanText(p.title, 120) || 'Your event plan', summary: cleanText(p.summary, 700),
    budget: cats, timeline, vendors, ideas, risks, budgetTotal: budget,
  };
}

/**
 * Parse JSON from a model reply, tolerating code fences or text around the object.
 * @param {unknown} raw
 * @returns {unknown}
 */
function parsePlan(raw) {
  const text = String(raw ?? '');
  try { return JSON.parse(text); } catch { /* fall through */ }
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a > -1 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch { /* fall through */ } }
  throw new HttpError(502, 'The AI reply was not a valid plan. Please try again.');
}

/**
 * Validate the chat request body.
 * @param {unknown} raw
 * @returns {{form: import('./types').PlanInput, messages: import('./types').ChatMessage[], plan: import('./types').Plan | null}}
 */
function validateChat(raw) {
  /** @type {Record<string, any>} */
  const r = raw && typeof raw === 'object' ? raw : {};
  const form = validateInput(r.form);
  if (form.ok === false) throw new HttpError(400, `Invalid event details: ${form.errors[0]}`);
  const msgs = lastN(r.messages, 20).filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .map(m => /** @type {import('./types').ChatMessage} */ ({ role: m.role, content: cleanText(m.content, 1500) })).filter(m => m.content);
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') throw new HttpError(400, 'Send at least one message from the user.');
  /** @type {import('./types').Plan | null} */
  let plan = null;
  try { plan = sanitizePlan(r.plan, form.value.budget); } catch { /* chat still works without the plan */ }
  return { form: form.value, messages: msgs.slice(-12), plan };
}

module.exports = { EVENT_TYPES, CURRENCIES, PRIORITIES, LIMITS, cleanText, isValidDate, validateInput, allocate, sanitizePlan, parsePlan, validateChat };
