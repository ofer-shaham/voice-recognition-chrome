export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenRouterModel {
  id: string;
  label: string;
  free: boolean;
}

export const OPENROUTER_MODELS: OpenRouterModel[] = [
  { id: 'meta-llama/llama-3.1-8b-instruct:free',  label: 'Llama 3.1 8B (free)',   free: true  },
  { id: 'meta-llama/llama-3.3-70b-instruct:free',  label: 'Llama 3.3 70B (free)',  free: true  },
  { id: 'google/gemma-3-4b-it:free',               label: 'Gemma 3 4B (free)',     free: true  },
  { id: 'mistralai/mistral-7b-instruct:free',       label: 'Mistral 7B (free)',     free: true  },
  { id: 'deepseek/deepseek-chat',                   label: 'DeepSeek Chat',         free: false },
  { id: 'openai/gpt-4o-mini',                       label: 'GPT-4o Mini',           free: false },
  { id: 'anthropic/claude-3-haiku',                 label: 'Claude 3 Haiku',        free: false },
  { id: 'google/gemini-flash-1.5',                  label: 'Gemini Flash 1.5',      free: false },
];

export const DEFAULT_MODEL = OPENROUTER_MODELS[0].id;

// In development CRA proxies /api/* → http://localhost:3001 (see package.json "proxy").
// In Docker the build arg REACT_APP_API_URL=http://localhost:3001 is baked in.
const API_BASE = process.env.REACT_APP_API_URL || '';

export const checkServerKey = async (): Promise<boolean> => {
  // Retry a few times — server may not be up the instant the page loads
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res  = await fetch(`${API_BASE}/api/config`);
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

/**
 * Send a chat request through the local proxy server.
 * @param apiKey  Optional UI-provided key.  If omitted the server uses its env var.
 */
export const chatWithAI = async (
  messages: ChatMessage[],
  model: string,
  apiKey?: string,
): Promise<string> => {
  const body: Record<string, unknown> = { messages, model };
  if (apiKey) body.apiKey = apiKey;

  const res = await fetch(`${API_BASE}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Server error ${res.status}`);
  }

  const data = await res.json();
  if (!data.content) throw new Error('No content in server response');
  return data.content;
};
