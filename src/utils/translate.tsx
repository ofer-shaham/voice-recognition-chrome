import appConfig from '../config/appConfig.json';
import { chatWithAI, getStoredOpenRouterMaxTokens } from '../services/openRouterService';

const CACHE_KEY = 'yl_translation_cache_v1';
const AI_CACHE_KEY = 'yt_ai_translation_cache_v1';
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/auto:free';
import aiConfig from '../config/aiConfig.json';
const DEFAULT_AI_LEVEL = aiConfig.translationSettings.defaultLevel;

type TranslationCache = Record<string, string>;
type TranslationMethod = 'openapi' | 'google' | 'openrouter';

type AiTranslationCacheEntry = Record<string, string>;

const normalizeLanguage = (value: string): string => {
    const normalized = (value || '').trim().toLowerCase();
    if (!normalized || normalized === 'auto' || normalized === 'und' || normalized === 'unknown' || normalized.endsWith('_auto') || normalized.endsWith('-auto')) {
        return 'auto';
    }
    return normalized.replace(/_/g, '-');
};

const normalizeText = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';

    if (trimmed.includes('%')) {
        try {
            const decoded = decodeURIComponent(trimmed);
            return decoded === trimmed ? trimmed : decoded;
        } catch {
            return trimmed;
        }
    }

    return trimmed;
};

const looksLikeSrtContent = (value: string): boolean => {
    const trimmed = (value || '').trim();
    if (!trimmed) return false;

    const srtTimestampPattern = /\d{1,2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[.,]\d{3}/;
    if (srtTimestampPattern.test(trimmed)) return true;

    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return false;

    const hasCueNumber = lines.some(line => /^\d+$/.test(line));
    const hasCueArrow = lines.some(line => line.includes('-->'));
    return hasCueNumber && hasCueArrow;
};

const getConfiguredTranslationMethod = (): TranslationMethod => {
    if (typeof window !== 'undefined') {
        try {
            const params = new URLSearchParams(window.location.search);
            const fromUrl = params.get('translationMethod');
            if (fromUrl === 'openapi' || fromUrl === 'google') {
                return fromUrl;
            }
        } catch {
            // ignore malformed query strings
        }

        try {
            const fromStorage = window.localStorage.getItem('yt_translation_method');
            if (fromStorage === 'openapi' || fromStorage === 'google') {
                return fromStorage;
            }
        } catch {
            // ignore storage access errors
        }
    }

    const configured = (appConfig as any).translation?.method;
    if (configured === 'google' || configured === 'openapi') return configured;
    return 'google';
};

const getConfiguredOpenRouterModel = (): string => {
    if (typeof window !== 'undefined') {
        try {
            const params = new URLSearchParams(window.location.search);
            const model = params.get('aiModel') || params.get('model');
            if (model && model.trim()) return model.trim();
        } catch {
            // ignore malformed query strings
        }

        try {
            const stored = window.localStorage.getItem('yt_ai_model');
            if (stored && stored.trim()) return stored.trim();
        } catch {
            // ignore storage access errors
        }
    }

    return DEFAULT_OPENROUTER_MODEL;
};

const normalizeAiLevel = (level?: number): number => {
    const { minLevel, maxLevel, defaultLevel } = aiConfig.translationSettings;
    const parsed = Number(level ?? defaultLevel);
    if (!Number.isFinite(parsed)) return defaultLevel;
    return Math.min(maxLevel, Math.max(minLevel, Math.round(parsed)));
};

const cacheKeyFor = (fromLang: string, toLang: string, text: string) =>
    `${fromLang}|${toLang}|${text}`;

const aiCacheKeyFor = ({ videoId, fromLang, toLang, level, rows }: { videoId?: string; fromLang: string; toLang: string; level: number; rows?: number }): string => {
    const scope = videoId ? videoId : 'anonymous';
    return `${scope}|${fromLang}|${toLang}|${level}|${rows ? `next:${rows}` : 'full'}`;
};

const getStorage = () => {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return null;
};

const readCache = (): TranslationCache => {
    const storage = getStorage();
    if (!storage) return {};
    try {
        const raw = storage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const writeCache = (cache: TranslationCache) => {
    const storage = getStorage();
    if (!storage) return;
    try {
        storage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
        // Storage full or unavailable — fail silently, cache is best-effort
    }
};

const readAiCache = (): AiTranslationCacheEntry => {
    const storage = getStorage();
    if (!storage) return {};
    try {
        const raw = storage.getItem(AI_CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const writeAiCache = (cache: AiTranslationCacheEntry) => {
    const storage = getStorage();
    if (!storage) return;
    try {
        storage.setItem(AI_CACHE_KEY, JSON.stringify(cache));
    } catch {
        // Storage full or unavailable — fail silently, cache is best-effort
    }
};

export const getCachedTranslation = (fromLang: string, toLang: string, text: string): string | undefined => {
    const cache = readCache();
    return cache[cacheKeyFor(fromLang, toLang, text)];
};

export const setCachedTranslation = (fromLang: string, toLang: string, text: string, value: string): void => {
    const cache = readCache();
    cache[cacheKeyFor(fromLang, toLang, text)] = value;
    writeCache(cache);
};

export const getTranslationCacheCount = (): number => Object.keys(readCache()).length;

export const clearTranslationCache = (): void => {
    try {
        window.localStorage.removeItem(CACHE_KEY);
        window.localStorage.removeItem(AI_CACHE_KEY);
    } catch {
        // ignore
    }
};

export const getCachedAiTranslation = ({ videoId, fromLang, toLang, level, rows }: { videoId?: string; fromLang: string; toLang: string; level: number; rows?: number }): string | undefined => {
    const cache = readAiCache();
    const key = aiCacheKeyFor({ videoId, fromLang, toLang, level, rows });
    return cache[key];
};

const rememberAiTranslation = ({ videoId, fromLang, toLang, level, rows, value }: { videoId?: string; fromLang: string; toLang: string; level: number; rows?: number; value: string }): void => {
    const cache = readAiCache();
    cache[aiCacheKeyFor({ videoId, fromLang, toLang, level, rows })] = value;
    writeAiCache(cache);
};

const extractSrtFromMarkdown = (value: string): string => {
    const trimmed = value.trim();
    const fenced = trimmed.match(/```(?:srt|text)?\s*([\s\S]*?)```/i);
    if (fenced) return fenced[1].trim();
    return trimmed;
};

const splitSrtBlocks = (value: string): string[] => {
    const cleaned = value.replace(/\r\n/g, '\n').trim();
    if (!cleaned) return [];
    const blocks = cleaned.split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
    return blocks;
};

const truncateToRowCount = (value: string, rows: number): string => {
    const blocks = splitSrtBlocks(value);
    if (!blocks.length) return value.trim();
    if (rows <= 0) return value.trim();
    return blocks.slice(0, rows).join('\n\n').trim();
};

const translateWithOpenApi = async ({ text, fromLang, toLang, videoId }: { text: string; fromLang: string; toLang: string; videoId?: string }): Promise<string> => {
    if (!videoId) {
        throw new Error('OpenAPI translation requires a videoId');
    }

    const url = new URL('/api/srt', window.location.origin);
    url.searchParams.set('videoId', videoId);
    url.searchParams.set('lang', normalizeLanguage(fromLang));
    url.searchParams.set('targetLang', normalizeLanguage(toLang));

    const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(body || `OpenAPI translation failed with ${response.status}`);
    }

    const translated = await response.text();
    if (typeof translated === 'string' && translated.trim()) {
        return translated;
    }

    throw new Error('OpenAPI translation returned no content');
};

const translateWithOpenRouterText = async ({ text, fromLang, toLang, level, model }: { text: string; fromLang: string; toLang: string; level: number; model?: string }): Promise<string> => {
    const response = await chatWithAI([
        {
            role: 'user',
            content: `Translate the following text from ${normalizeLanguage(fromLang)} to ${normalizeLanguage(toLang)}. Keep it easier to understand for education, use a language difficulty level of ${level}/5, and prefer fewer words while preserving the meaning. Return only the translated result, without explanation or markdown.\n\n${text}`,
        },
    ], model || getConfiguredOpenRouterModel(), undefined, getStoredOpenRouterMaxTokens());

    const result = extractSrtFromMarkdown(response.content).trim();
    if (!result) throw new Error('OpenRouter returned no translated text');
    return result;
};



const translateWithGoogle = ({ text, fromLang, toLang }: { text: string; fromLang: string; toLang: string }): Promise<string> => {
    const normalizedFromLang = normalizeLanguage(fromLang);
    const normalizedToLang = normalizeLanguage(toLang);
    const requestUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${normalizedFromLang}&tl=${normalizedToLang}&dt=t&q=${encodeURIComponent(text)}`;

    return fetch(requestUrl)
        .then(res => res.json())
        .then(data => {
            const translated = data?.translatedText || data?.[0]?.[0]?.[0] || '';
            if (translated) {
                return translated;
            }
            throw new Error('No translated text returned');
        });
};

export const translate = ({ finalTranscriptProxy, fromLang, toLang, videoId, method, level, rows, model }: { finalTranscriptProxy: string, fromLang: string, toLang: string, videoId?: string, method?: TranslationMethod, level?: number, rows?: number, model?: string }): Promise<string> => {
    const normalizedFromLang = normalizeLanguage(fromLang);
    const normalizedToLang = normalizeLanguage(toLang);
    const text = normalizeText(finalTranscriptProxy);

    const cached = getCachedTranslation(normalizedFromLang, normalizedToLang, text);
    if (cached !== undefined) {
        return Promise.resolve(cached);
    }

    const selectedMethod = method || getConfiguredTranslationMethod();
    if (selectedMethod === 'openrouter') {
        return translateWithOpenRouterText({ text, fromLang: normalizedFromLang, toLang: normalizedToLang, level: normalizeAiLevel(level), model: model || getConfiguredOpenRouterModel() })
            .then(result => {
                setCachedTranslation(normalizedFromLang, normalizedToLang, text, result);
                return result;
            })
            .catch(err => {
                console.error(err.message);
                return 'translation error';
            });
    }

    const shouldUseTranscriptApi = selectedMethod === 'openapi' && !!videoId && looksLikeSrtContent(text);
    const runTranslation = shouldUseTranscriptApi
        ? translateWithOpenApi({ text, fromLang: normalizedFromLang, toLang: normalizedToLang, videoId })
        : translateWithGoogle({ text, fromLang: normalizedFromLang, toLang: normalizedToLang });

    return runTranslation
        .then(translated => {
            setCachedTranslation(normalizedFromLang, normalizedToLang, text, translated);
            return translated;
        })
        .catch(err => {
            console.error(err.message);
            return 'translation error';
        });
}
