// Small shared helpers: DOM queries, escaping, formatting, announcements.

/**
 * First element matching `sel`. Typed loosely on purpose: the page's ids are known, and
 * callers read element-specific properties such as `.value` or `.hidden`.
 * @param {string} sel
 * @param {ParentNode} [root]
 * @returns {any}
 */
export const $ = (sel, root = document) => root.querySelector(sel);
/**
 * All elements matching `sel`.
 * @param {string} sel
 * @param {ParentNode} [root]
 * @returns {any[]}
 */
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * The closest ancestor of an event's target that matches `sel`, or null.
 * @param {Event} e
 * @param {string} sel
 * @returns {any}
 */
export const hit = (e, sel) => (e.target instanceof Element ? e.target.closest(sel) : null);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/**
 * Escape text before putting it into an HTML string.
 * @param {unknown} s
 */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

export const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Format an amount in the chosen currency (Indian grouping for INR).
 * @param {number} n
 * @param {string} currency
 */
export function fmtMoney(n, currency) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

/**
 * Count a number up in an element. Jumps straight to the value when motion is reduced.
 * @param {HTMLElement} el
 * @param {number} to
 * @param {(n: number) => string} format
 * @param {number} [duration]
 */
export function countTo(el, to, format, duration = 1400) {
  if (reducedMotion()) { el.textContent = format(to); return; }
  const t0 = performance.now();
  (function tick(t) {
    const p = Math.min(1, (t - t0) / duration);
    el.textContent = format(Math.round(to * (1 - (1 - p) ** 4)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

/**
 * Say something to screen readers through the polite live region.
 * @param {string} message
 */
export function announce(message) {
  const live = $('#status');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = message; }, 50);
}

/**
 * The page's Content Security Policy blocks inline style attributes, so dynamic
 * values travel as data-* attributes and are applied here through the CSS object model.
 * @param {ParentNode} root
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
