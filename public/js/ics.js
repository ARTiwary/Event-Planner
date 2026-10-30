// Calendar export: turns the timeline stages ("Two weeks before") into all-day events.

const WORDS = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const UNIT = { day: 1, week: 7, month: 30 };

/** Days before the event for a phrase such as "Six months before". Returns null if it cannot be read. */
export function parseWhen(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(event day|day of|wedding day|party day|big day|on the day)\b/.test(t)) return 0;
  const m = t.match(/\b(\d+|a|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(day|week|month)s?\b/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : WORDS[m[1]];
  return n * UNIT[m[2]];
}

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const escapeText = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold long lines to 75 characters as the iCalendar format requires. */
function fold(line) {
  const out = [];
  for (let i = 0; i < line.length; i += 74) out.push((i ? ' ' : '') + line.slice(i, i + 74));
  return out.join('\r\n');
}

/**
 * Build an .ics file. Returns null when there is no valid event date.
 * @param {{title: string, date: string, timeline: {when: string, tasks: string[]}[]}} plan
 */
export function buildIcs({ title, date, timeline }, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const eventDay = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(eventDay.getTime())) return null;
  const stamp = `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
  let last = 0;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gather//Event Planner//EN', 'CALSCALE:GREGORIAN'];
  timeline.forEach((stage, i) => {
    const before = parseWhen(stage.when);
    const offset = before === null ? last : before;
    last = offset;
    const start = new Date(eventDay.getTime() - offset * 86400000);
    const end = new Date(start.getTime() + 86400000);
    lines.push('BEGIN:VEVENT', `UID:gather-${date}-${i}@gather.app`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${escapeText(`${title}: ${stage.when}`)}`, `DESCRIPTION:${escapeText(stage.tasks.map(t => `- ${t}`).join('\n'))}`, 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
