'use strict';
const { HttpError } = require('./errors');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Create a small client for Groq's OpenAI-compatible chat API.
 * `fetchImpl` is injectable so tests never touch the network.
 */
function createGroqClient({ apiKey, model, timeoutMs = 60000, fetchImpl = globalThis.fetch, log = () => {} }) {
  async function call(messages, { json = false, lean = false } = {}) {
    const body = { model, messages, temperature: 0.7, max_tokens: 6000 };
    if (!lean) {
      body.reasoning_effort = 'low';
      if (json) body.response_format = { type: 'json_object' };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res, text;
    try {
      res = await fetchImpl(GROQ_URL, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      text = await res.text();
    } catch (e) {
      log('groq network error', e.name, e.cause?.code || '');
      throw new HttpError(504, e.name === 'AbortError' ? 'The AI took too long to answer. Please try again.' : 'Could not reach the AI service. Check the connection and try again.');
    } finally { clearTimeout(timer); }

    let data; try { data = JSON.parse(text); } catch { data = null; }
    if (!res.ok) {
      log('groq error', res.status, data?.error?.message || '');
      if (res.status === 400 && !lean) return call(messages, { json, lean: true }); // retry without optional settings
      if (res.status === 401 || res.status === 403) throw new HttpError(502, 'The AI service rejected the server API key.');
      if (res.status === 429) throw new HttpError(503, 'The AI service is busy. Wait a moment and try again.');
      throw new HttpError(502, 'The AI service returned an error. Please try again.');
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content) throw new HttpError(502, 'The AI service returned an empty reply. Please try again.');
    return content;
  }
  return { call };
}

module.exports = { createGroqClient, GROQ_URL };
