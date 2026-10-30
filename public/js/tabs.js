// Accessible tabs: arrow keys, Home and End move between tabs; a sliding indicator follows the active one.
import { $, $$ } from './util.js';

/** Position the sliding underline under the selected tab. */
export function moveIndicator() {
  const tab = $('#tabs [role="tab"][aria-selected="true"]');
  const ind = $('#ind');
  if (!tab || !ind) return;
  ind.style.left = `${tab.offsetLeft}px`;
  ind.style.width = `${tab.offsetWidth}px`;
}

/** Select a tab and show its panel. */
export function showTab(name, { focus = false, onShow } = {}) {
  for (const t of $$('#tabs [role="tab"]')) {
    const on = t.dataset.p === name;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  }
  for (const p of $$('.pane')) p.classList.toggle('on', p.id === `p-${name}`);
  moveIndicator();
  onShow?.(name);
}

export function initTabs(onShow) {
  const tabs = () => $$('#tabs [role="tab"]');
  $('#tabs').addEventListener('click', e => {
    const t = e.target.closest('[role="tab"]');
    if (t) showTab(t.dataset.p, { onShow });
  });
  $('#tabs').addEventListener('keydown', e => {
    const list = tabs();
    const i = list.findIndex(t => t.getAttribute('aria-selected') === 'true');
    const to = { ArrowRight: (i + 1) % list.length, ArrowLeft: (i - 1 + list.length) % list.length, Home: 0, End: list.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    showTab(list[to].dataset.p, { focus: true, onShow });
  });
  addEventListener('resize', () => { if (!$('#results').hidden) moveIndicator(); });
}
