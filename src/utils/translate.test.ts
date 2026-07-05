// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { translate, clearTranslationCache } from './translate';

describe('translate', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        clearTranslationCache();
        localStorage.clear();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        clearTranslationCache();
    });

    it('returns a translated string from a supported API payload', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ content: 'Hola' }),
        }) as unknown as typeof fetch;

        const result = await translate({ finalTranscriptProxy: 'Hello', fromLang: 'en', toLang: 'es', videoId: 'abc123' });

        expect(result).toBe('Hola');
        expect(globalThis.fetch).toHaveBeenCalled();
    });
});
