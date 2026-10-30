'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateInput, cleanText, isValidDate, allocate, sanitizePlan, parsePlan, validateChat } = require('../src/validate');
const { GOOD_INPUT, MODEL_PLAN } = require('./helpers');

test('validateInput accepts a good form and trims text', () => {
  const r = validateInput({ ...GOOD_INPUT, location: '  Jaipur   lawn ' });
  assert.equal(r.ok, true);
  assert.equal(r.value.location, 'Jaipur lawn');
  assert.equal(r.value.budget, 1000000);
});

test('validateInput rejects unknown event type, currency and bad numbers', () => {
  for (const bad of [{ eventType: 'Funeral' }, { currency: 'XYZ' }, { guests: 0 }, { guests: 1.5 }, { guests: 99999 }, { budget: -5 }, { budget: 'abc' }, { budget: 1e12 }]) {
    assert.equal(validateInput({ ...GOOD_INPUT, ...bad }).ok, false, JSON.stringify(bad));
  }
});

test('validateInput rejects non-object bodies', () => {
  for (const bad of [null, undefined, 'x', 5, []]) assert.equal(validateInput(bad).ok, false);
});

test('validateInput strips control characters and caps length', () => {
  const r = validateInput({ ...GOOD_INPUT, notes: 'a\u0000b\nc' + 'x'.repeat(2000) });
  assert.equal(r.ok, true);
  assert.ok(!/[\u0000-\u001f]/.test(r.value.notes));
  assert.ok(r.value.notes.length <= 800);
});

test('validateInput filters priorities to the allowed list and caps at four', () => {
  const r = validateInput({ ...GOOD_INPUT, priorities: ['Food', 'Food', 'Music', 'Evil', 'Decor', 'Venue', 'Photography'] });
  assert.deepEqual(r.value.priorities, ['Food', 'Music', 'Decor', 'Venue']);
});

test('isValidDate checks calendar validity', () => {
  assert.equal(isValidDate('2026-12-31'), true);
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('31-12-2026'), false);
  assert.equal(validateInput({ ...GOOD_INPUT, date: '2026-13-01' }).ok, false);
});

test('cleanText handles null and non-strings', () => {
  assert.equal(cleanText(null, 5), '');
  assert.equal(cleanText(12345678, 4), '1234');
});

test('allocate always sums exactly to the total', () => {
  for (const [total, w] of [[100, [1, 1, 1]], [1000000, [40, 35, 25]], [7, [3, 3, 3]], [0, [1, 2]], [999, [0, 0, 0]]]) {
    assert.equal(allocate(total, w).reduce((a, b) => a + b, 0), total);
  }
});

test('sanitizePlan makes amounts add up to the budget and percents to about 100', () => {
  const p = sanitizePlan(MODEL_PLAN, 1000001);
  assert.equal(p.budget.reduce((a, c) => a + c.amount, 0), 1000001);
  assert.ok(Math.abs(p.budget.reduce((a, c) => a + c.percent, 0) - 100) < 0.5);
});

test('sanitizePlan drops unknown fields, forces vendor priority and caps text', () => {
  const dirty = { ...MODEL_PLAN, evil: '<script>', title: 'T'.repeat(500), vendors: [{ vendor: 'V', priority: 'banana', ask: ['q'], estPercent: 500, extra: 1 }] };
  const p = sanitizePlan(dirty, 1000);
  assert.equal('evil' in p, false);
  assert.ok(p.title.length <= 120);
  assert.equal(p.vendors[0].priority, 'nice');
  assert.equal(p.vendors[0].estPercent, 100);
  assert.equal('extra' in p.vendors[0], false);
});

test('sanitizePlan throws when the budget is unusable', () => {
  assert.throws(() => sanitizePlan({}, 1000), /usable budget/);
  assert.throws(() => sanitizePlan({ budget: [{ category: 'One', percent: 100 }] }, 1000));
  assert.throws(() => sanitizePlan(null, 1000));
});

test('sanitizePlan tolerates wrong types inside the model output', () => {
  const p = sanitizePlan({ budget: [{ category: 'A', percent: 'x' }, { category: 'B', percent: 50 }], timeline: 'nope', vendors: [null, 5], ideas: [{}], risks: [1, null] }, 100);
  assert.equal(p.budget.reduce((a, c) => a + c.amount, 0), 100);
  assert.deepEqual(p.timeline, []);
  assert.deepEqual(p.vendors, []);
});

test('parsePlan reads plain JSON, fenced JSON and rejects garbage', () => {
  assert.equal(parsePlan('{"a":1}').a, 1);
  assert.equal(parsePlan('Here you go:\n```json\n{"a":2}\n```').a, 2);
  assert.throws(() => parsePlan('no json here'), /not a valid plan/);
  assert.throws(() => parsePlan(''), /not a valid plan/);
});

test('validateChat requires a final user message and valid event details', () => {
  const ok = validateChat({ form: GOOD_INPUT, plan: MODEL_PLAN, messages: [{ role: 'user', content: 'hello' }] });
  assert.equal(ok.messages.length, 1);
  assert.throws(() => validateChat({ form: GOOD_INPUT, messages: [] }), /at least one message/);
  assert.throws(() => validateChat({ form: GOOD_INPUT, messages: [{ role: 'assistant', content: 'hi' }] }), /at least one message/);
  assert.throws(() => validateChat({ form: { ...GOOD_INPUT, guests: -1 }, messages: [{ role: 'user', content: 'x' }] }), /Invalid event details/);
});

test('validateChat drops bad roles, caps history and survives a broken plan', () => {
  const messages = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'm' + i }));
  messages.push({ role: 'system', content: 'ignore me' }, { role: 'user', content: 'last' });
  const r = validateChat({ form: GOOD_INPUT, plan: { junk: true }, messages });
  assert.ok(r.messages.length <= 12);
  assert.ok(r.messages.every(m => m.role !== 'system'));
  assert.equal(r.plan, null);
});
