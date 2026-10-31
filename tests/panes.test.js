'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { sanitizePlan } = require('../src/validate');
const { GOOD_INPUT, MODEL_PLAN } = require('./helpers');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'public', 'js', 'panes.js')).href);
const plan = sanitizePlan(MODEL_PLAN, 1000000);
const ctx = { form: { ...GOOD_INPUT, guests: 100 }, done: {}, spent: {} };

test('budgetHtml renders one segment and one ledger row per budget line', async () => {
  const { budgetHtml } = await load();
  const html = budgetHtml(plan, ctx);
  assert.equal((html.match(/class="seg"/g) || []).length, plan.budget.length);
  assert.equal((html.match(/class="lrow"/g) || []).length, plan.budget.length);
  assert.match(html, /Spent so far on Venue/);
  assert.match(html, /10,00,000|4,00,000/, 'amounts use Indian grouping for INR');
});

test('every pane escapes text from the plan, so model output cannot inject HTML', async () => {
  const { budgetHtml, timelineHtml, vendorsHtml, ideasHtml, risksHtml } = await load();
  const evil = '<img src=x onerror=alert(1)>';
  const bad = { ...plan, budget: plan.budget.map(c => ({ ...c, category: evil, tips: evil })), timeline: [{ when: evil, tasks: [evil] }], vendors: [{ vendor: evil, priority: 'must', ask: [evil], estPercent: 1, estAmount: 1 }], ideas: [{ type: evil, idea: evil }], risks: [evil] };
  for (const html of [budgetHtml(bad, ctx), timelineHtml(bad, ctx), vendorsHtml(bad, ctx), ideasHtml(bad), risksHtml(bad)]) {
    assert.ok(!html.includes('<img'), 'raw tag leaked');
    assert.ok(html.includes('&lt;img'), 'text was escaped');
  }
});

test('timelineHtml restores saved ticks', async () => {
  const { timelineHtml } = await load();
  const html = timelineHtml(plan, { ...ctx, done: { 't0-0': true } });
  assert.equal((html.match(/ checked>/g) || []).length, 1);
  assert.match(html, /data-id="t0-0" checked/);
});

test('vendorsHtml labels priority and shows the estimate', async () => {
  const { vendorsHtml } = await load();
  const html = vendorsHtml(plan, ctx);
  assert.match(html, /Book first/);
  assert.match(html, /estimated/);
});

test('risksHtml has a friendly empty state', async () => {
  const { risksHtml } = await load();
  assert.match(risksHtml({ ...plan, risks: [] }), /No specific risks/);
});

test('trackerState reports left, over and untouched lines', async () => {
  const { trackerState } = await load();
  const s = trackerState(plan, ctx.form, { 0: 1000, 1: 99999999 });
  assert.equal(s.rows[0].cls, 'ok');
  assert.match(s.rows[0].text, /left/);
  assert.equal(s.rows[1].cls, 'over');
  assert.match(s.rows[1].text, /Over by/);
  assert.equal(s.rows[2].text, '');
  assert.match(s.html, /Over budget by/);
  assert.match(trackerState(plan, ctx.form, {}).html, /left/);
});

test('sentenceHtml reports guests, per-head cost, tasks and vendors', async () => {
  const { sentenceHtml } = await load();
  const html = sentenceHtml(plan, ctx.form);
  assert.match(html, /data-c="100"/);
  assert.match(html, /data-c="10000"/);
  assert.match(html, /data-c="2"/, 'two tasks in the sample plan');
});
