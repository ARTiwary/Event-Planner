// The hero controls, the occasion list, the chip inputs and form submission.
import { $, $$, fmtMoney, announce, reducedMotion } from './util.js';

const FOCUS_LABEL = { Wedding: 'Names, faith and traditions', Birthday: 'Who it is for and which milestone', 'Community event': 'Purpose and who it serves' };
const ARTICLE = { Wedding: 'a wedding', Birthday: 'a birthday', 'Community event': 'a community event' };
const MAX_PRIORITIES = 4;
const tokens = v => v.split(',').map(s => s.trim()).filter(Boolean);

/** @type {{type: import('../../src/types.js').EventType}} */
export const state = { type: 'Wedding' };

/** @returns {import('../../src/types.js').PlanInput} the form as the server expects it */
export function readForm() {
  return {
    eventType: state.type, guests: Number($('#hg').value), budget: Math.round(Number($('#hb').value)), currency: $('#hc').value,
    date: $('#date').value, location: $('#location').value, style: $('#style').value, needs: $('#needs').value,
    focus: $('#focus').value, notes: $('#notes').value,
    priorities: $$('#priorities .chip[aria-pressed="true"]').map(c => c.textContent),
  };
}

/** Put a saved form back into the controls. */
export function writeForm(/** @type {any} */ f, /** @type {(n: number) => void} */ setField) {
  setType(f.eventType);
  $('#hg').value = f.guests; $('#hb').value = f.budget; $('#hc').value = f.currency;
  for (const id of ['date', 'location', 'style', 'needs', 'focus', 'notes']) $(`#${id}`).value = f[id] || '';
  $$('#priorities .chip').forEach(c => c.setAttribute('aria-pressed', String((f.priorities || []).includes(c.textContent))));
  syncChips($('#style')); syncChips($('#needs'));
  refresh(setField);
}

function setType(type) {
  state.type = type;
  $$('.occ').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === type)));
  $('#focus-label').textContent = FOCUS_LABEL[type];
}

function refresh(setField) {
  const guests = Number($('#hg').value), budget = Number($('#hb').value) || 0, cur = $('#hc').value;
  $('#rGuests').textContent = String(guests);
  $('#rHead').textContent = fmtMoney(Math.round(budget / guests), cur);
  $('#hg').setAttribute('aria-valuetext', `${guests} guests`);
  $('#echo').textContent = `Planning ${ARTICLE[state.type]} for ${guests} guests with ${fmtMoney(budget, cur)} to spend.`;
  setField(guests);
}

function syncChips(input) {
  const have = tokens(input.value.toLowerCase());
  $$(`.chips[data-for="${input.id}"] .chip`).forEach(c => c.setAttribute('aria-pressed', String(have.includes(c.textContent.toLowerCase()))));
}

/** @param {{setField: (n: number) => void, onSubmit: (form: import('../../src/types.js').PlanInput) => void}} handlers */
export function initForm({ setField, onSubmit }) {
  for (const id of ['hg', 'hb', 'hc']) $(`#${id}`).addEventListener('input', () => refresh(setField));
  refresh(setField);

  $('#occs').addEventListener('click', e => {
    const b = e.target.closest('.occ');
    if (!b) return;
    setType(b.dataset.t); refresh(setField);
    announce(`${b.dataset.t} selected.`);
    setTimeout(() => $('#details').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }), 350);
  });

  // Chips add or remove a word in the text box next to them.
  for (const box of $$('.chips[data-for]')) {
    const input = $(`#${box.dataset.for}`);
    box.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const list = tokens(input.value);
      const at = list.findIndex(t => t.toLowerCase() === chip.textContent.toLowerCase());
      if (at > -1) list.splice(at, 1); else list.push(chip.textContent);
      input.value = list.join(', ');
      syncChips(input);
    });
    input.addEventListener('input', () => syncChips(input));
  }

  $('#priorities').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const on = chip.getAttribute('aria-pressed') === 'true';
    if (!on && $$('#priorities .chip[aria-pressed="true"]').length >= MAX_PRIORITIES) { announce(`You can choose up to ${MAX_PRIORITIES} priorities.`); return; }
    chip.setAttribute('aria-pressed', String(!on));
  });

  $('#f').addEventListener('submit', e => {
    e.preventDefault();
    const f = readForm();
    const err = $('#err');
    if (!Number.isInteger(f.guests) || f.guests < 1) { err.textContent = 'Set a guest count of at least 1.'; $('#hg').focus(); return; }
    if (!Number.isFinite(f.budget) || f.budget < 1) { err.textContent = 'Enter a total budget above zero in the top section.'; $('#hb').focus(); return; }
    err.textContent = '';
    onSubmit(f);
  });
}
