// Entry point: wires the modules together.
import { $, $$, announce, reducedMotion, store } from './util.js';
import { postJson } from './api.js';
import { createField } from './field.js';
import { initForm, readForm, writeForm } from './form.js';
import { initTabs, moveIndicator } from './tabs.js';
import { initView, showPlan, current, animateSegments } from './view.js';
import { initChat } from './chat.js';

const MIN_LOADING_MS = 2600;
const setField = createField($('#field'));

// Hero headline: animate word by word. The real text stays available to screen readers.
$('#h1-words').innerHTML = 'Plan the whole event before you book anything.'.split(' ')
  .map((w, i) => `<span class="w"><i data-n="${i}">${w}</i></span>`).join(' ');
$$('#h1-words i').forEach(i => i.style.setProperty('--n', i.dataset.n));

// Loading orbit.
$('#orbit').innerHTML = Array.from({ length: 24 }, (_, i) => `<i data-i="${i}"></i>`).join('');
$$('#orbit i').forEach(i => i.style.setProperty('--i', i.dataset.i));

addEventListener('scroll', () => $('#nav').classList.toggle('stuck', scrollY > 60), { passive: true });

const chat = initChat(() => current());
initView();
initTabs(name => { if (name === 'budget') animateSegments(); });

let stepTimer;
function setLoading(on) {
  const overlay = $('#load');
  for (const sel of ['#main', '#nav', 'footer', '#fab']) { const el = $(sel); if (el) el.inert = on; }
  overlay.inert = !on; overlay.setAttribute('aria-hidden', String(!on)); overlay.classList.toggle('on', on);
  clearInterval(stepTimer);
  const steps = $$('#steps li');
  steps.forEach(s => { s.className = ''; });
  if (on) {
    overlay.focus();
    let i = 0; steps[0].className = 'on';
    stepTimer = setInterval(() => { if (i < steps.length - 1) { steps[i].className = 'done'; steps[++i].className = 'on'; } }, 2300);
  }
}

async function generate(form) {
  $('#go').disabled = true; setLoading(true); announce('Building your plan. This takes about ten seconds.');
  const started = Date.now();
  try {
    const data = await postJson('/api/plan', form);
    if (!reducedMotion()) await new Promise(r => setTimeout(r, Math.max(0, MIN_LOADING_MS - (Date.now() - started))));
    reveal(data.plan, form, data.demo);
  } catch (err) {
    setLoading(false);
    $('#err').textContent = `The plan could not be built: ${err.message}`;
    announce('The plan could not be built.');
    $('#go').focus();
  } finally { $('#go').disabled = false; }
}

function reveal(plan, form, demo) {
  showPlan(plan, form, { demo });
  chat.reset();
  $('#fab').hidden = false;
  document.documentElement.style.scrollBehavior = 'auto';
  $('#results').scrollIntoView();
  document.documentElement.style.scrollBehavior = '';
  setLoading(false);
  moveIndicator();
  $('#title').focus({ preventScroll: true });
  announce('Your plan is ready. Use the tabs to explore the budget, timeline, vendors, ideas and watch-outs.');
}

initForm({ setField, onSubmit: generate });

// Offer the last plan again after a reload.
const saved = store.get('gather:last', null);
if (saved?.plan?.title && saved?.form) {
  $('#saved').hidden = false;
  $('#saved-text').textContent = `You have a saved plan: ${saved.plan.title}.`;
  $('#open-saved').addEventListener('click', () => { writeForm(saved.form, setField); reveal(saved.plan, saved.form, false); });
}
