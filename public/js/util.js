// Small shared helpers: DOM queries, escaping, formatting, announcements.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape text before putting it into an HTML string. */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

export const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Format an amount in the chosen currency (Indian grouping for INR). */
export function fmtMoney(n, currency) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

/** Count a number up in an element. Jumps straight to the value when motion is reduced. */
export function countTo(el, to, format, duration = 1400) {
  if (reducedMotion()) { el.textContent = format(to); return; }
  const t0 = performance.now();
  (function tick(t) {
    const p = Math.min(1, (t - t0) / duration);
    el.textContent = format(Math.round(to * (1 - (1 - p) ** 4)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

/** Say something to screen readers through the polite live region. */
export function announce(message) {
  const live = $('#status');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = message; }, 50);
}

/**
 * The page's Content Security Policy blocks inline style attributes, so dynamic
 * values travel as data-* attributes and are applied here through the CSS object model.
 */
export function applyDynamic(root) {
  for (const el of $$('[data-i]', root)) el.style.setProperty('--i', el.dataset.i);
  for (const el of $$('[data-bg]', root)) el.style.background = el.dataset.bg;
  for (const el of $$('[data-fg]', root)) el.style.color = el.dataset.fg;
}

/** localStorage that never throws (private windows, blocked storage). */
export const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
};
