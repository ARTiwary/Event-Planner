// Shows the generated plan and wires up the checklist, spend tracker, hover links and exports.
import { $, $$, hit, countTo, applyDynamic, announce, store, fmtMoney } from './util.js';
import { buildIcs } from './ics.js';
import { showTab } from './tabs.js';
import { budgetHtml, timelineHtml, vendorsHtml, ideasHtml, risksHtml, sentenceHtml, trackerState } from './panes.js';

/** @typedef {import('../../src/types.js').Plan} Plan */
/** @typedef {import('../../src/types.js').PlanInput} PlanInput */

const PROGRESS_RING_LENGTH = 113.1; // circumference of the r=18 progress ring
const TILT_DEGREES = 12;

/** @type {{plan: Plan | null, form: PlanInput | null, done: Record<string, boolean>, spent: Record<string, number>}} */
const ctx = { plan: null, form: null, done: {}, spent: {} };
export const current = () => ({ plan: ctx.plan, form: ctx.form });

function updateTracker() {
  const { rows, html } = trackerState(ctx.plan, ctx.form, ctx.spent);
  rows.forEach((r, i) => { const el = $(`[data-rem="${i}"]`); if (el) { el.textContent = r.text; el.className = `rem ${r.cls}`; } });
  $('#tracker').innerHTML = html;
}

export function animateSegments() {
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.seg').forEach((s, i) => setTimeout(() => { s.style.width = `calc(${s.dataset.w}% - 3px)`; }, i * 90))));
}

export function updateProgress() {
  const boxes = $$('.chk input');
  const pct = boxes.length ? Math.round((boxes.filter(b => b.checked).length / boxes.length) * 100) : 0;
  $('#pct').textContent = `${pct}%`;
  $('#rfg').style.strokeDashoffset = String(PROGRESS_RING_LENGTH * (1 - pct / 100));
  $('.ring').setAttribute('aria-valuenow', String(pct));
  $('.ring').setAttribute('aria-valuetext', `${pct} percent of checklist items done`);
}

/**
 * Show a plan: fill the page, restore saved progress and remember it as the last plan.
 * @param {Plan} plan
 * @param {PlanInput} form
 * @param {{demo?: boolean}} [options]
 */
export function showPlan(plan, form, { demo = false } = {}) {
  Object.assign(ctx, { plan, form, done: store.get(`gather:done:${plan.title}`, {}), spent: store.get(`gather:spent:${plan.title}`, {}) });
  $('#results').hidden = false;
  $('#title').textContent = plan.title;
  $('#summary').textContent = plan.summary;
  $('#demo').hidden = !demo;
  if (demo) $('#demo').textContent = 'This is a sample plan. Add a Groq API key on the server to generate plans for your own event.';
  $('#sentence').innerHTML = sentenceHtml(plan, form);
  $$('#sentence b').forEach(b => countTo(b, Number(b.dataset.c), b.dataset.m ? n => fmtMoney(n, form.currency) : String));
  $('#p-budget').innerHTML = budgetHtml(plan, ctx);
  $('#p-timeline').innerHTML = timelineHtml(plan, ctx);
  $('#p-vendors').innerHTML = vendorsHtml(plan, ctx);
  $('#p-ideas').innerHTML = ideasHtml(plan);
  $('#p-risks').innerHTML = risksHtml(plan);
  applyDynamic($('#results'));
  updateTracker();
  $('#ics').setAttribute('aria-disabled', String(!/^\d{4}-\d{2}-\d{2}$/.test(form.date)));
  updateProgress();
  showTab('budget', { onShow: name => { if (name === 'budget') animateSegments(); } });
  animateSegments();
  store.set('gather:last', { plan, form });
}

function initChecklistAndTracker() {
  document.addEventListener('change', e => {
    const box = hit(e, '.chk input');
    if (!box) return;
    ctx.done[box.dataset.id] = box.checked;
    store.set(`gather:done:${ctx.plan.title}`, ctx.done);
    updateProgress();
  });
  document.addEventListener('input', e => {
    const field = hit(e, '[data-spend]');
    if (!field) return;
    ctx.spent[field.dataset.spend] = Math.max(0, Number(field.value) || 0);
    store.set(`gather:spent:${ctx.plan.title}`, ctx.spent);
    updateTracker();
  });
}

function initHoverEffects() {
  // Link the budget bar and the ledger rows on hover and focus.
  const link = (/** @type {Event} */ e) => {
    const t = hit(e, '.seg,.lrow');
    $$('.seg,.lrow').forEach(x => x.classList.toggle('hl', !!t && x.dataset.k === t.dataset.k));
  };
  document.addEventListener('mouseover', link);
  document.addEventListener('focusin', link);
  // Gentle 3D tilt on idea tiles. Skipped when the user prefers reduced motion.
  document.addEventListener('pointermove', e => {
    $$('.tilt').forEach(x => { x.style.setProperty('--rx', '0deg'); x.style.setProperty('--ry', '0deg'); });
    const tile = hit(e, '.tilt');
    if (!tile || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = tile.getBoundingClientRect();
    tile.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * TILT_DEGREES}deg`);
    tile.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * TILT_DEGREES}deg`);
  });
}

function initExports() {
  $('#copy').addEventListener('click', async () => {
    const { plan, form } = ctx;
    const money = (/** @type {number} */ n) => fmtMoney(n, form.currency);
    const text = `${plan.title}\n\nTIMELINE\n${plan.timeline.map(s => `${s.when}\n${s.tasks.map(t => `  [ ] ${t}`).join('\n')}`).join('\n\n')}\n\nVENDORS\n${plan.vendors.map(v => `  [ ] ${v.vendor} (${money(v.estAmount)})`).join('\n')}`;
    const label = $('#copy span');
    try { await navigator.clipboard.writeText(text); label.textContent = 'Copied'; announce('Checklist copied to the clipboard.'); }
    catch { label.textContent = 'Copy failed'; announce('Could not copy. Select the text and copy it manually.'); }
    setTimeout(() => { label.textContent = 'Copy checklist'; }, 1800);
  });
  $('#ics').addEventListener('click', () => {
    const ics = buildIcs({ title: ctx.plan.title, date: ctx.form.date, timeline: ctx.plan.timeline });
    const label = $('#ics span');
    if (!ics) {
      announce('Choose an event date in the form, then build the plan again to add milestones to your calendar.');
      label.textContent = 'Pick a date first';
      setTimeout(() => { label.textContent = 'Add to calendar'; }, 2500);
      return;
    }
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'gather-plan.ics' });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Calendar file downloaded.');
  });
  $('#print').addEventListener('click', () => window.print());
}

export function initView() {
  initChecklistAndTracker();
  initHoverEffects();
  initExports();
}
