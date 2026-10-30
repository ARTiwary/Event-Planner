// The hero dot field: one dot per guest, with a pointer ripple.
import { reducedMotion } from './util.js';

const NS = 'http://www.w3.org/2000/svg';

/** Build the dots (rings from the centre outward) and return a function that sets the visible guest count. */
export function createField(svg) {
  const dots = [];
  let r = 20, ring = 0;
  while (r < 190) {
    const capacity = ring === 0 ? 6 : Math.floor((2 * Math.PI * r) / 14);
    for (let k = 0; k < capacity; k++) {
      const a = ring * 0.6 + (k / capacity) * Math.PI * 2;
      dots.push({ x: 200 + r * Math.cos(a), y: 200 + r * Math.sin(a), ring });
    }
    r += 17; ring++;
  }
  const still = reducedMotion();
  dots.forEach((d, i) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', d.x.toFixed(1)); c.setAttribute('cy', d.y.toFixed(1)); c.setAttribute('r', '4.4');
    c.setAttribute('class', i < 2 ? 'dot host' : 'dot');
    c.style.transform = 'scale(0)';
    if (!still) c.style.transitionDelay = `${d.ring * 45 + 300}ms`;
    svg.appendChild(c); d.el = c;
  });

  let count = 0, pointer = null, frame = 0, settled = false;
  function paint() {
    frame = 0;
    dots.forEach((d, i) => {
      let s = i < count ? 1 : 0;
      if (s && pointer && !still) { const dist = Math.hypot(d.x - pointer.x, d.y - pointer.y); if (dist < 55) s = 1 + (1 - dist / 55) * 1.5; }
      d.el.style.transform = `scale(${s.toFixed(2)})`;
      if (settled) d.el.style.transitionDelay = '0ms';
    });
    settled = true;
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
  svg.addEventListener('pointermove', e => {
    const b = svg.getBoundingClientRect();
    pointer = { x: ((e.clientX - b.left) / b.width) * 400, y: ((e.clientY - b.top) / b.height) * 400 };
    schedule();
  });
  svg.addEventListener('pointerleave', () => { pointer = null; schedule(); });
  return n => { count = n; svg.setAttribute('aria-label', `One dot for each guest: ${n} guests`); schedule(); };
}
