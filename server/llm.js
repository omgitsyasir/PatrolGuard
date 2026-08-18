import { db } from './db.js';

export class LLMError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Resolve the LLM profile to use: explicit id > default profile > first profile.
 */
export function resolveProfile(id) {
  let p = null;
  if (id) {
    p = db.prepare('SELECT * FROM llm_profiles WHERE id = ?').get(id);
    if (!p) throw new LLMError('LLM profile not found.', 404);
  }
  if (!p) p = db.prepare('SELECT * FROM llm_profiles WHERE is_default = 1 ORDER BY id LIMIT 1').get();
  if (!p) p = db.prepare('SELECT * FROM llm_profiles ORDER BY id LIMIT 1').get();
  if (!p) {
    throw new LLMError('No LLM profile configured. Add one in Settings → AI Profiles.', 400);
  }
  if (!p.endpoint || !p.model_name) {
    throw new LLMError(`LLM profile "${p.name}" is missing an endpoint or model name.`, 400);
  }
  return p;
}

function normalizeEndpoint(endpoint) {
  let e = endpoint.trim().replace(/\/+$/, '');
  if (!e.endsWith('/chat/completions')) {
    e += '/chat/completions';
  }
  return e;
}

/**
 * Call any OpenAI-compatible chat completions API
 * (OpenRouter, Ollama /v1, LM Studio, ...).
 */
export async function chatCompletion({ endpoint, apiKey, model, system, user, maxTokens = 2048, temperature = 0.4 }) {
  const url = normalizeEndpoint(endpoint);
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
    max_tokens: maxTokens,
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });
  } catch (err) {
    throw new LLMError(
      `Could not reach LLM at ${url}. Check the endpoint and that the server is running. (${err.message})`,
      502
    );
  }

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data.error?.message || JSON.stringify(data);
    } catch {
      detail = await res.text();
    }
    throw new LLMError(`LLM request failed (HTTP ${res.status}): ${detail.slice(0, 500)}`, 502);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new LLMError('LLM returned an empty response.', 502);
  }
  return text.trim();
}

export async function testProfile(profile) {
  const reply = await chatCompletion({
    endpoint: profile.endpoint,
    apiKey: profile.api_key,
    model: profile.model_name,
    system: 'You are a connectivity test. Reply with the single word: OK',
    user: 'Ping',
    maxTokens: 10,
    temperature: 0,
  });
  return { ok: true, model: profile.model_name, reply };
}