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
  { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (free)', free: true },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)', free: true },
  { id: 'google/gemma-3-4b-it:free', label: 'Gemma 3 4B (free)', free: true },
  { id: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B (free)', free: true },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', free: false },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', free: false },
  { id: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku', free: false },
  { id: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5', free: false },
];

export const DEFAULT_MODEL = OPENROUTER_MODELS[0].id;

export const chatWithAI = async (
  messages: ChatMessage[],
  model: string,
  apiKey: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key not configured. Set REACT_APP_OPENAI_API_KEY in Replit Secrets.');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Voice Translation App',
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`OpenRouter ${response.status}: ${errBody || response.statusText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in OpenRouter response');
  return content;
};
