import appConfig from '../config/appConfig.json';

const CACHE_KEY = 'yl_translation_cache_v1';

type TranslationCache = Record<string, string>;
type TranslationMethod = 'openapi' | 'google';

const normalizeLanguage = (value: string): string => {
    const normalized = (value || '').trim().toLowerCase();
    if (!normalized || normalized === 'auto' || normalized.endsWith('_auto') || normalized.endsWith('-auto')) {
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
    return configured === 'google' ? 'google' : 'openapi';
};

const cacheKeyFor = (fromLang: string, toLang: string, text: string) =>
    `${fromLang}|${toLang}|${text}`;

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
    } catch {
        // ignore
    }
};

const translateWithOpenApi = async ({ text, fromLang, toLang, videoId }: { text: string; fromLang: string; toLang: string; videoId?: string }): Promise<string> => {
    if (!videoId) {
        throw new Error('OpenAPI translation requires a videoId');
    }

    const baseUrl = 'https://youtube-dl-jrte.onrender.com';
    const url = new URL(`${baseUrl}/api/translate-transcript`);
    url.searchParams.set('videoID', videoId);
    url.searchParams.set('language', normalizeLanguage(fromLang));
    url.searchParams.set('targetLanguage', normalizeLanguage(toLang));
    url.searchParams.set('type', 'txt');

    const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(body || `OpenAPI translation failed with ${response.status}`);
    }

    const payload = await response.json().catch(() => ({}));
    const translated = payload?.content || '';
    if (typeof translated === 'string' && translated.trim()) {
        return translated;
    }

    throw new Error('OpenAPI translation returned no content');
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

export const translate = ({ finalTranscriptProxy, fromLang, toLang, videoId, method }: { finalTranscriptProxy: string, fromLang: string, toLang: string, videoId?: string, method?: TranslationMethod }): Promise<string> => {
    const normalizedFromLang = normalizeLanguage(fromLang);
    const normalizedToLang = normalizeLanguage(toLang);
    const text = normalizeText(finalTranscriptProxy);

    const cached = getCachedTranslation(normalizedFromLang, normalizedToLang, text);
    if (cached !== undefined) {
        return Promise.resolve(cached);
    }

    const selectedMethod = method || getConfiguredTranslationMethod();

    const runTranslation = selectedMethod === 'openapi'
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
