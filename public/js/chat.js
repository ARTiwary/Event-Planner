// The "Ask the planner" dialog.
import { $, announce } from './util.js';
import { postJson } from './api.js';

export function initChat(getContext) {
  const chat = $('#chat'), fab = $('#fab'), log = $('#log'), msg = $('#msg');
  const history = [];

  function open() {
    chat.inert = false; chat.classList.add('on');
    fab.hidden = true; fab.setAttribute('aria-expanded', 'true');
    msg.focus();
  }
  function close() {
    chat.classList.remove('on'); chat.inert = true;
    fab.hidden = false; fab.setAttribute('aria-expanded', 'false');
    fab.focus();
  }
  function add(role, text) {
    const d = document.createElement('div');
    d.className = `m ${role === 'user' ? 'u' : 'a'}`;
    d.textContent = text;
    log.append(d); log.scrollTop = log.scrollHeight;
    return d;
  }

  fab.addEventListener('click', open);
  $('#cx').addEventListener('click', close);
  chat.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  $('#sugg').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) { msg.value = b.textContent; $('#cf').requestSubmit(); }
  });

  $('#cf').addEventListener('submit', async e => {
    e.preventDefault();
    const text = msg.value.trim();
    if (!text) return;
    msg.value = ''; $('#sugg').hidden = true; msg.focus();
    add('user', text); history.push({ role: 'user', content: text });
    const typing = document.createElement('div');
    typing.className = 'm t'; typing.innerHTML = '<span class="sr-only">The planner is typing</span><i></i><i></i><i></i>';
    log.append(typing); log.scrollTop = log.scrollHeight;
    try {
      const { form, plan } = getContext();
      const { reply } = await postJson('/api/chat', { messages: history, plan, form });
      typing.remove(); add('assistant', reply); history.push({ role: 'assistant', content: reply });
    } catch (err) {
      typing.remove(); add('assistant', `The planner could not answer: ${err.message} Try sending it again.`); history.pop();
      announce('The planner could not answer.');
    }
  });

  return { reset() { history.length = 0; log.textContent = ''; $('#sugg').hidden = false; add('assistant', 'Your plan is ready. Ask me to change a budget line, swap a vendor or draft a message.'); } };
}
