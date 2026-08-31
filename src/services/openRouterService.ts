export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  lang_code?: string;
  translation?: string;
  keySuffix?: string;
}

export interface OpenRouterModel {
  id: string;
  label: string;
}

export const OPENROUTER_MODELS: OpenRouterModel[] = [
  { id: 'openrouter/auto:free', label: 'OpenRouter Auto (free)' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B' },
  { id: 'meta-llama/llama-4-scout:free', label: 'Llama 4 Scout' },
  { id: 'meta-llama/llama-4-maverick:free', label: 'Llama 4 Maverick' },
  { id: 'google/gemma-3-4b-it:free', label: 'Gemma 3 4B' },
  { id: 'google/gemma-3-12b-it:free', label: 'Gemma 3 12B' },
  { id: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B' },
  { id: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B' },
  { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1' },
  { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek Chat v3' },
  { id: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B' },
  { id: 'qwen/qwen3-8b:free', label: 'Qwen3 8B' },
  { id: 'microsoft/phi-4-reasoning:free', label: 'Phi-4 Reasoning' },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', label: 'Hermes 3 Llama 405B' },
];

export const DEFAULT_MODEL = OPENROUTER_MODELS[0].id;

const API_BASE = import.meta.env.VITE_API_URL || '';
export const OPENROUTER_API_KEY_STORAGE = 'openrouter_api_key';

export const getStoredOpenRouterApiKey = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(OPENROUTER_API_KEY_STORAGE)?.trim() || '';
  } catch {
    return '';
  }
};

const getUrlApiKey = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;

  try {
    const params = new URLSearchParams(window.location.search);
    for (const name of ['apiKey', 'openrouter_api_key', 'openrouterKey', 'openrouterApiKey', 'key', 'orKey']) {
      const value = params.get(name)?.trim();
      if (value) return value;
    }
  } catch {
    // ignore malformed query strings
  }

  return undefined;
};

export const checkServerKey = async (): Promise<boolean> => {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      if (res.ok) {
        const data = await res.json();
        return !!data.serverHasKey;
      }
    } catch {
      // network error — server not ready yet
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
};

export const validateOpenRouterKey = async (apiKey?: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const response = await fetch(`${API_BASE}/api/health_ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}),
    });
    const data = await response.json().catch(() => ({}));
    return data.ok ? { ok: true } : { ok: false, error: data.error || `Validation failed (${response.status})` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ChatResponse {
  content: string;
  model: string;
  keySuffix?: string;
}

export const chatWithAI = async (
  messages: ChatMessage[],
  model: string,
  apiKey?: string,
  maxTokens?: number,
  maxRetries = 3,
): Promise<ChatResponse> => {
  const body: Record<string, unknown> = { messages, model };
  const urlApiKey = getUrlApiKey();
  const effectiveKey = apiKey || urlApiKey || getStoredOpenRouterApiKey();
  if (effectiveKey) body.apiKey = effectiveKey;
  if (maxTokens) body.maxTokens = maxTokens;

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Don't retry on client errors (4xx) — bad key, bad request, etc.
      if (res.status >= 400 && res.status < 500) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        lastError = new Error(err.error || `Server error ${res.status}`);
        if (attempt < maxRetries) {
          await sleep(600 * Math.pow(2, attempt));
          continue;
        }
        throw lastError;
      }

      const data = await res.json();
      if (!data.content) throw new Error('No content in server response');
      return { content: data.content, model: data.model || model, keySuffix: data.keySuffix };

    } catch (e: any) {
      // Re-throw immediately on client errors (they won't have been caught above)
      if (e.message && /^Server error 4/.test(e.message)) throw e;

      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxRetries) {
        await sleep(600 * Math.pow(2, attempt));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError;
};
