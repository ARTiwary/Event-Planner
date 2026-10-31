// Pure HTML builders for each plan panel. They take data in and return a string, so they are easy to test.
import { esc, fmtMoney } from './util.js';

/** @typedef {import('../../src/types.js').Plan} Plan */
/** @typedef {import('../../src/types.js').PlanInput} PlanInput */
/** @typedef {{form: PlanInput, done: Record<string, boolean>, spent: Record<string, number>}} PaneContext */

export const PALETTE = ['#f5b82e', '#1f7a72', '#c2375f', '#4b4a9e', '#4f9fd0', '#7a8a2e', '#8a4a8f', '#5f6b85', '#d99a0b'];
// Background and text colours for idea tiles, chosen to pass WCAG AA contrast.
export const TONES = [['#f5b82e', '#14122b'], ['#1f7a72', '#ffffff'], ['#c2375f', '#ffffff'], ['#4b4a9e', '#ffffff'], ['#14122b', '#f5b82e'], ['#4f9fd0', '#14122b']];
const CHECK = '<span class="bx" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';

/**
 * One tickable checklist row.
 * @param {string} id stable id used to save the tick
 * @param {string} label
 * @param {boolean} [checked]
 */
export const checkbox = (id, label, checked = false) =>
  `<label class="chk"><input type="checkbox" data-id="${esc(id)}"${checked ? ' checked' : ''}>${CHECK}<span class="tx">${esc(label)}</span></label>`;

/** The animated summary sentence under the title. */
export function sentenceHtml(/** @type {Plan} */ plan, /** @type {PlanInput} */ form) {
  const tasks = plan.timeline.reduce((n, s) => n + s.tasks.length, 0);
  const perHead = Math.round(form.budget / form.guests);
  return `<b data-c="${form.budget}" data-m="1">0</b> across <b data-c="${form.guests}">0</b> guests, <b data-c="${perHead}" data-m="1">0</b> a head, with <b data-c="${tasks}">0</b> tasks and <b data-c="${plan.vendors.length}">0</b> vendors to track.`;
}

/** Budget bar plus the ledger, with a "spent so far" input per line. */
export function budgetHtml(/** @type {Plan} */ plan, /** @type {PaneContext} */ { form, spent }) {
  const money = (/** @type {number} */ n) => fmtMoney(n, form.currency);
  const segs = plan.budget.map((c, i) => `<div class="seg" data-k="${i}" data-w="${c.percent}" data-bg="${PALETTE[i % PALETTE.length]}"></div>`).join('');
  const rows = plan.budget.map((c, i) => `<div class="lrow" data-k="${i}" data-i="${i + 1}">
      <span class="sw" data-bg="${PALETTE[i % PALETTE.length]}"></span><h3>${esc(c.category)}</h3><p>${esc(c.tips)}</p>
      <div class="amt">${money(c.amount)}<small>${c.percent}% of budget</small></div>
      <div class="spend"><label for="spend-${i}">Spent so far on ${esc(c.category)}</label><input id="spend-${i}" type="number" min="0" inputmode="numeric" data-spend="${i}" value="${spent[i] ?? ''}" placeholder="0"><span class="rem" data-rem="${i}"></span></div></div>`).join('');
  return `<p class="sr-only">${money(form.budget)} total, about ${money(Math.round(form.budget / form.guests))} per guest.</p>
    <div class="tracker" id="tracker" role="status"></div><div class="stack" id="stack" aria-hidden="true" data-i="0">${segs}</div><div class="ledger">${rows}</div>`;
}

/** Spent, left and over-budget text for the tracker line and each ledger row. */
export function trackerState(/** @type {Plan} */ plan, /** @type {PlanInput} */ form, /** @type {Record<string, number>} */ spent) {
  const money = (/** @type {number} */ n) => fmtMoney(n, form.currency);
  let total = 0;
  const rows = plan.budget.map((c, i) => {
    const amount = Number(spent[i]) || 0; total += amount;
    const left = c.amount - amount;
    return { text: amount ? (left >= 0 ? `${money(left)} left` : `Over by ${money(-left)}`) : '', cls: amount ? (left >= 0 ? 'ok' : 'over') : '' };
  });
  const left = form.budget - total;
  const html = `<span>Spent ${money(total)} of ${money(form.budget)}</span><span class="${left >= 0 ? 'ok' : 'over'}">${left >= 0 ? `${money(left)} left` : `Over budget by ${money(-left)}`}</span>`;
  return { rows, html };
}

export function timelineHtml(/** @type {Plan} */ plan, /** @type {PaneContext} */ { done }) {
  return `<div class="tl">${plan.timeline.map((s, i) => `<div class="stage" data-i="${i}"><h3>${esc(s.when)}</h3>${s.tasks.map((t, j) => checkbox(`t${i}-${j}`, t, !!done[`t${i}-${j}`])).join('')}</div>`).join('')}</div>`;
}

export function vendorsHtml(/** @type {Plan} */ plan, /** @type {PaneContext} */ { form, done }) {
  return plan.vendors.map((v, i) => `<div class="vrow" data-i="${i}"><div><h3>${esc(v.vendor)}</h3><span class="tag ${v.priority === 'must' ? 'must' : ''}">${v.priority === 'must' ? 'Book first' : 'Nice to have'}</span></div>
    <div class="asks">${v.ask.map((a, j) => checkbox(`v${i}-${j}`, a, !!done[`v${i}-${j}`])).join('')}</div><div class="cost">${fmtMoney(v.estAmount, form.currency)}<small>estimated</small></div></div>`).join('');
}

export function ideasHtml(/** @type {Plan} */ plan) {
  return `<div class="ideas">${plan.ideas.map((x, i) => { const t = TONES[i % TONES.length]; return `<div class="idea tilt" data-i="${i}" data-bg="${t[0]}" data-fg="${t[1]}"><span>${esc(x.type)}</span><p>${esc(x.idea)}</p></div>`; }).join('')}</div>`;
}

export function risksHtml(/** @type {Plan} */ plan) {
  const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.01"/></svg>';
  return plan.risks.map((r, i) => `<div class="risk" data-i="${i}">${icon}<p>${esc(r)}</p></div>`).join('') || '<p>No specific risks were flagged.</p>';
}
