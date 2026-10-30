// Renders the generated plan and wires up the checklist, spend tracker and exports.
import { $, $$, esc, fmtMoney, countTo, applyDynamic, announce, store } from './util.js';
import { buildIcs } from './ics.js';
import { showTab } from './tabs.js';

const PALETTE = ['#f5b82e', '#1f7a72', '#c2375f', '#4b4a9e', '#4f9fd0', '#7a8a2e', '#8a4a8f', '#5f6b85', '#d99a0b'];
// Background and text colours chosen to pass WCAG AA contrast.
const TONES = [['#f5b82e', '#14122b'], ['#1f7a72', '#ffffff'], ['#c2375f', '#ffffff'], ['#4b4a9e', '#ffffff'], ['#14122b', '#f5b82e'], ['#4f9fd0', '#14122b']];
const CHECK = '<span class="bx" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>';

const ctx = { plan: null, form: null, done: {}, spent: {} };
export const current = () => ({ plan: ctx.plan, form: ctx.form });
const money = n => fmtMoney(n, ctx.form.currency);

const check = (id, label) => `<label class="chk"><input type="checkbox" data-id="${esc(id)}"${ctx.done[id] ? ' checked' : ''}>${CHECK}<span class="tx">${esc(label)}</span></label>`;

function budgetPane() {
  const { plan, form } = ctx;
  const segs = plan.budget.map((c, i) => `<div class="seg" data-k="${i}" data-w="${c.percent}" data-bg="${PALETTE[i % PALETTE.length]}"></div>`).join('');
  const rows = plan.budget.map((c, i) => `<div class="lrow" data-k="${i}" data-i="${i + 1}">
      <span class="sw" data-bg="${PALETTE[i % PALETTE.length]}"></span><h3>${esc(c.category)}</h3><p>${esc(c.tips)}</p>
      <div class="amt">${money(c.amount)}<small>${c.percent}% of budget</small></div>
      <div class="spend"><label for="spend-${i}">Spent so far on ${esc(c.category)}</label><input id="spend-${i}" type="number" min="0" inputmode="numeric" data-spend="${i}" value="${ctx.spent[i] ?? ''}" placeholder="0"><span class="rem" data-rem="${i}"></span></div></div>`).join('');
  $('#p-budget').innerHTML = `<p class="sr-only">${money(form.budget)} total, about ${money(Math.round(form.budget / form.guests))} per guest.</p>
    <div class="tracker" id="tracker" role="status"></div><div class="stack" id="stack" aria-hidden="true" data-i="0">${segs}</div><div class="ledger">${rows}</div>`;
  updateTracker();
}

function updateTracker() {
  const { plan, form } = ctx;
  let total = 0;
  plan.budget.forEach((c, i) => {
    const spent = Number(ctx.spent[i]) || 0; total += spent;
    const rem = $(`[data-rem="${i}"]`); if (!rem) return;
    const left = c.amount - spent;
    rem.textContent = spent ? (left >= 0 ? `${money(left)} left` : `Over by ${money(-left)}`) : '';
    rem.className = `rem ${spent ? (left >= 0 ? 'ok' : 'over') : ''}`;
  });
  const left = form.budget - total;
  $('#tracker').innerHTML = `<span>Spent ${money(total)} of ${money(form.budget)}</span><span class="${left >= 0 ? 'ok' : 'over'}">${left >= 0 ? `${money(left)} left` : `Over budget by ${money(-left)}`}</span>`;
}

function renderPanes() {
  const { plan } = ctx;
  budgetPane();
  $('#p-timeline').innerHTML = `<div class="tl">${plan.timeline.map((s, i) => `<div class="stage" data-i="${i}"><h3>${esc(s.when)}</h3>${s.tasks.map((t, j) => check(`t${i}-${j}`, t)).join('')}</div>`).join('')}</div>`;
  $('#p-vendors').innerHTML = plan.vendors.map((v, i) => `<div class="vrow" data-i="${i}"><div><h3>${esc(v.vendor)}</h3><span class="tag ${v.priority === 'must' ? 'must' : ''}">${v.priority === 'must' ? 'Book first' : 'Nice to have'}</span></div>
    <div class="asks">${v.ask.map((a, j) => check(`v${i}-${j}`, a)).join('')}</div><div class="cost">${money(v.estAmount)}<small>estimated</small></div></div>`).join('');
  $('#p-ideas').innerHTML = `<div class="ideas">${plan.ideas.map((x, i) => { const t = TONES[i % TONES.length]; return `<div class="idea tilt" data-i="${i}" data-bg="${t[0]}" data-fg="${t[1]}"><span>${esc(x.type)}</span><p>${esc(x.idea)}</p></div>`; }).join('')}</div>`;
  $('#p-risks').innerHTML = plan.risks.map((r, i) => `<div class="risk" data-i="${i}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.01"/></svg><p>${esc(r)}</p></div>`).join('')
    || '<p>No specific risks were flagged.</p>';
  applyDynamic($('#results'));
}

export function animateSegments() {
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.seg').forEach((s, i) => setTimeout(() => { s.style.width = `calc(${s.dataset.w}% - 3px)`; }, i * 90))));
}

export function updateProgress() {
  const boxes = $$('.chk input');
  const pct = boxes.length ? Math.round((boxes.filter(b => b.checked).length / boxes.length) * 100) : 0;
  $('#pct').textContent = `${pct}%`;
  $('#rfg').style.strokeDashoffset = String(113.1 * (1 - pct / 100));
  $('.ring').setAttribute('aria-valuenow', String(pct));
  $('.ring').setAttribute('aria-valuetext', `${pct} percent of checklist items done`);
}

/** Show a plan: fill the page, restore saved progress and remember it as the last plan. */
export function showPlan(plan, form, { demo = false } = {}) {
  ctx.plan = plan; ctx.form = form;
  ctx.done = store.get(`gather:done:${plan.title}`, {});
  ctx.spent = store.get(`gather:spent:${plan.title}`, {});
  $('#results').hidden = false;
  $('#title').textContent = plan.title;
  $('#summary').textContent = plan.summary;
  $('#demo').hidden = !demo;
  if (demo) $('#demo').textContent = 'This is a sample plan. Add a Groq API key on the server to generate plans for your own event.';
  const tasks = plan.timeline.reduce((n, s) => n + s.tasks.length, 0);
  $('#sentence').innerHTML = `<b data-c="${form.budget}" data-m="1">0</b> across <b data-c="${form.guests}">0</b> guests, <b data-c="${Math.round(form.budget / form.guests)}" data-m="1">0</b> a head, with <b data-c="${tasks}">0</b> tasks and <b data-c="${plan.vendors.length}">0</b> vendors to track.`;
  $$('#sentence b').forEach(b => countTo(b, Number(b.dataset.c), b.dataset.m ? n => money(n) : n => String(n)));
  renderPanes();
  $('#ics').setAttribute('aria-disabled', String(!/^\d{4}-\d{2}-\d{2}$/.test(form.date)));
  updateProgress();
  showTab('budget', { onShow: name => { if (name === 'budget') animateSegments(); } });
  animateSegments();
  store.set('gather:last', { plan, form });
}

export function initView() {
  document.addEventListener('change', e => {
    const box = e.target.closest?.('.chk input');
    if (box) {
      ctx.done[box.dataset.id] = box.checked;
      store.set(`gather:done:${ctx.plan.title}`, ctx.done);
      updateProgress();
    }
  });
  document.addEventListener('input', e => {
    const inp = e.target.closest?.('[data-spend]');
    if (!inp) return;
    ctx.spent[inp.dataset.spend] = Math.max(0, Number(inp.value) || 0);
    store.set(`gather:spent:${ctx.plan.title}`, ctx.spent);
    updateTracker();
  });
  // Link the budget bar and the ledger rows on hover and focus.
  const link = e => {
    const t = e.target.closest?.('.seg,.lrow');
    $$('.seg,.lrow').forEach(x => x.classList.toggle('hl', !!t && x.dataset.k === t.dataset.k));
  };
  document.addEventListener('mouseover', link);
  document.addEventListener('focusin', link);
  // Gentle 3D tilt on idea tiles (skipped for reduced motion via CSS transition and pointer-only input).
  document.addEventListener('pointermove', e => {
    $$('.tilt').forEach(x => { x.style.setProperty('--rx', '0deg'); x.style.setProperty('--ry', '0deg'); });
    const c = e.target.closest?.('.tilt');
    if (!c || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 12}deg`);
    c.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 12}deg`);
  });

  $('#copy').addEventListener('click', async () => {
    const { plan } = ctx;
    const text = `${plan.title}\n\nTIMELINE\n${plan.timeline.map(s => `${s.when}\n${s.tasks.map(t => `  [ ] ${t}`).join('\n')}`).join('\n\n')}\n\nVENDORS\n${plan.vendors.map(v => `  [ ] ${v.vendor} (${money(v.estAmount)})`).join('\n')}`;
    const label = $('#copy span');
    try { await navigator.clipboard.writeText(text); label.textContent = 'Copied'; announce('Checklist copied to the clipboard.'); }
    catch { label.textContent = 'Copy failed'; announce('Could not copy. Select the text and copy it manually.'); }
    setTimeout(() => { label.textContent = 'Copy checklist'; }, 1800);
  });
  $('#ics').addEventListener('click', () => {
    const ics = buildIcs({ title: ctx.plan.title, date: ctx.form.date, timeline: ctx.plan.timeline });
    if (!ics) { announce('Choose an event date in the form, then build the plan again to add milestones to your calendar.'); $('#ics span').textContent = 'Pick a date first'; setTimeout(() => { $('#ics span').textContent = 'Add to calendar'; }, 2500); return; }
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'gather-plan.ics' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Calendar file downloaded.');
  });
  $('#print').addEventListener('click', () => window.print());
}
