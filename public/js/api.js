// Talks to our own server. Turns every failure into a readable Error message.

/**
 * POST JSON to our server and return the parsed reply. Every failure becomes a readable Error.
 * @param {string} url
 * @param {unknown} body
 * @param {number} [timeoutMs]
 * @returns {Promise<any>}
 */
export async function postJson(url, body, timeoutMs = 80000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res, text;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    text = await res.text();
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'The request took too long.' : 'Could not reach the server. Check your connection and that the app is running.', { cause: e });
  } finally { clearTimeout(timer); }
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(data?.error || `The server answered with status ${res.status}.`);
  if (!data) throw new Error('The server sent an unreadable reply.');
  return data;
}
