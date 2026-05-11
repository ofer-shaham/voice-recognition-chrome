export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenRouterModel {
  id: string;
  label: string;
}

export const OPENROUTER_MODELS: OpenRouterModel[] = [
  { id: 'openrouter/auto:free',                        label: 'OpenRouter Auto (free)'       },
  { id: 'meta-llama/llama-3.1-8b-instruct:free',       label: 'Llama 3.1 8B'                },
  { id: 'meta-llama/llama-3.3-70b-instruct:free',      label: 'Llama 3.3 70B'               },
  { id: 'meta-llama/llama-4-scout:free',               label: 'Llama 4 Scout'               },
  { id: 'meta-llama/llama-4-maverick:free',            label: 'Llama 4 Maverick'            },
  { id: 'google/gemma-3-4b-it:free',                   label: 'Gemma 3 4B'                  },
  { id: 'google/gemma-3-12b-it:free',                  label: 'Gemma 3 12B'                 },
  { id: 'google/gemma-3-27b-it:free',                  label: 'Gemma 3 27B'                 },
  { id: 'mistralai/mistral-7b-instruct:free',          label: 'Mistral 7B'                  },
  { id: 'deepseek/deepseek-r1:free',                   label: 'DeepSeek R1'                 },
  { id: 'deepseek/deepseek-chat-v3-0324:free',         label: 'DeepSeek Chat v3'            },
  { id: 'qwen/qwen-2.5-72b-instruct:free',             label: 'Qwen 2.5 72B'                },
  { id: 'qwen/qwen3-8b:free',                          label: 'Qwen3 8B'                    },
  { id: 'microsoft/phi-4-reasoning:free',              label: 'Phi-4 Reasoning'             },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free',  label: 'Hermes 3 Llama 405B'         },
];

export const DEFAULT_MODEL = OPENROUTER_MODELS[0].id;

const API_BASE = process.env.REACT_APP_API_URL || '';

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

export const chatWithAI = async (
  messages: ChatMessage[],
  model: string,
  apiKey?: string,
  maxTokens?: number,
): Promise<string> => {
  const body: Record<string, unknown> = { messages, model };
  if (apiKey)    body.apiKey    = apiKey;
  if (maxTokens) body.maxTokens = maxTokens;

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
