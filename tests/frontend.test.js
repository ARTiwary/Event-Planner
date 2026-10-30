'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const load = name => import(pathToFileURL(path.join(__dirname, '..', 'public', 'js', name)).href);
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('parseWhen reads words, digits and event-day phrases', async () => {
  const { parseWhen } = await load('ics.js');
  assert.equal(parseWhen('Six months before'), 180);
  assert.equal(parseWhen('2 weeks before'), 14);
  assert.equal(parseWhen('One week before'), 7);
  assert.equal(parseWhen('A day before'), 1);
  assert.equal(parseWhen('Event day'), 0);
  assert.equal(parseWhen('Wedding day'), 0);
  assert.equal(parseWhen('Sometime soon'), null);
  assert.equal(parseWhen(undefined), null);
});

test('buildIcs makes one all-day event per stage on the right dates', async () => {
  const { buildIcs } = await load('ics.js');
  const ics = buildIcs({ title: 'My, "party"', date: '2026-12-20', timeline: [{ when: 'Two weeks before', tasks: ['Book; venue'] }, { when: 'Event day', tasks: ['Enjoy'] }] }, new Date('2026-10-26T10:00:00Z'));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /DTSTART;VALUE=DATE:20261206/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261220/);
  assert.match(ics, /DTEND;VALUE=DATE:20261221/);
  assert.match(ics, /My\\, "party"/, 'commas are escaped');
  assert.match(ics, /Book\; venue/, 'semicolons are escaped');
});

test('buildIcs folds long lines and returns null without a valid date', async () => {
  const { buildIcs } = await load('ics.js');
  const long = buildIcs({ title: 'T', date: '2026-12-20', timeline: [{ when: 'Event day', tasks: ['x'.repeat(300)] }] });
  assert.ok(long.split('\r\n').every(l => l.length <= 75));
  assert.equal(buildIcs({ title: 'T', date: '', timeline: [] }), null);
  assert.equal(buildIcs({ title: 'T', date: 'nonsense', timeline: [] }), null);
});

test('buildIcs keeps the previous date for stages it cannot read', async () => {
  const { buildIcs } = await load('ics.js');
  const ics = buildIcs({ title: 'T', date: '2026-12-20', timeline: [{ when: 'One week before', tasks: ['a'] }, { when: 'Soon-ish', tasks: ['b'] }] });
  assert.equal((ics.match(/DTSTART;VALUE=DATE:20261213/g) || []).length, 2);
});

test('esc neutralises HTML and quotes', async () => {
  const { esc } = await load('util.js');
  assert.equal(esc('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
  assert.equal(esc("it's & <b>"), 'it&#39;s &amp; &lt;b&gt;');
  assert.equal(esc(null), '');
});

test('fmtMoney groups INR the Indian way', async () => {
  const { fmtMoney } = await load('util.js');
  assert.match(fmtMoney(1800000, 'INR'), /18,00,000/);
  assert.match(fmtMoney(1800000, 'USD'), /1,800,000/);
});

test('index.html is CSP-safe: no inline scripts, handlers or style attributes', () => {
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'inline <script>');
  assert.ok(!/\son[a-z]+\s*=/i.test(html), 'inline event handler');
  assert.ok(!/\sstyle\s*=/i.test(html), 'inline style attribute');
  assert.ok(!/<style[\s>]/i.test(html), 'inline <style>');
});

test('index.html has the landmarks and labels assistive tech needs', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /<main id="main">/);
  assert.match(html, /role="tablist"/);
  assert.equal((html.match(/role="tab"\s/g) || []).length, 5);
  assert.equal((html.match(/role="tabpanel"/g) || []).length, 5);
  assert.match(html, /aria-live="polite"/);
  const ids = [...html.matchAll(/<input[^>]*\bid="([^"]+)"[^>]*>/g)].map(m => m[1]);
  for (const id of ids) {
    const labelled = new RegExp(`for="${id}"`).test(html) || new RegExp(`<input[^>]*id="${id}"[^>]*aria-label=`).test(html) || new RegExp(`<label[^>]*>(?:(?!</label>)[\\s\\S])*id="${id}"`).test(html);
    assert.ok(labelled, `input #${id} has no label`);
  }
});

test('the stylesheet respects reduced motion and defines visible focus', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'styles.css'), 'utf8');
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /:focus-visible/);
});
