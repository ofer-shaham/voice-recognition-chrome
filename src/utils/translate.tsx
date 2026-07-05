const CACHE_KEY = 'yl_translation_cache_v1';

type TranslationCache = Record<string, string>;

const cacheKeyFor = (fromLang: string, toLang: string, text: string) =>
    `${fromLang}|${toLang}|${text}`;

const readCache = (): TranslationCache => {
    try {
        const raw = window.localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

const writeCache = (cache: TranslationCache) => {
    try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
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

export const translate = ({ finalTranscriptProxy, fromLang, toLang }: { finalTranscriptProxy: string, fromLang: string, toLang: string }): Promise<string> => {
    const cached = getCachedTranslation(fromLang, toLang, finalTranscriptProxy);
    if (cached !== undefined) {
        return Promise.resolve(cached);
    }
    return fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(finalTranscriptProxy)}`)
        .then(res => res.json())
        .then(data => {
            const y = data[0][0][0]
            setCachedTranslation(fromLang, toLang, finalTranscriptProxy, y);
            return y
        })
        .catch(err => {
            console.error(err.message); return `translation error`
        })
}
