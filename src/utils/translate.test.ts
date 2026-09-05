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

    it('defaults OpenRouter AI subtitle translation to the free auto model', async () => {
        const { DEFAULT_OPENROUTER_MODEL } = await import('./translate');
        expect(DEFAULT_OPENROUTER_MODEL).toBe('openrouter/auto:free');
    });

    it('uses the transcript API for SRT content', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '1\n00:00:00,000 --> 00:00:01,000\nHola',
        }) as unknown as typeof fetch;

        const result = await translate({
            finalTranscriptProxy: '1\n00:00:00,000 --> 00:00:01,000\nHello',
            fromLang: 'en',
            toLang: 'es',
            videoId: 'abc123',
        });

        expect(result).toBe('1\n00:00:00,000 --> 00:00:01,000\nHola');
        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/srt'),
            expect.anything(),
        );
    });

    it('uses text translation for single sentences even when openapi is configured', async () => {
        globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/api/srt')) {
                return Promise.resolve({
                    ok: false,
                    text: async () => 'unexpected srt response',
                }) as Promise<Response>;
            }

            return Promise.resolve({
                ok: true,
                json: async () => ({ translatedText: 'Hola' }),
            }) as Promise<Response>;
        }) as unknown as typeof fetch;

        const result = await translate({
            finalTranscriptProxy: 'Hello',
            fromLang: 'en',
            toLang: 'es',
            videoId: 'abc123',
            method: 'openapi',
        });

        expect(result).toBe('Hola');
        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('translate.googleapis.com'),
        );
        expect(globalThis.fetch).not.toHaveBeenCalledWith(
            expect.stringContaining('/api/srt'),
            expect.anything(),
        );
    });

    it('falls back to Google auto-detect when source language is unknown', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ translatedText: 'مرحبا' }),
        }) as unknown as typeof fetch;

        const result = await translate({
            finalTranscriptProxy: 'Hello',
            fromLang: 'und',
            toLang: 'ar',
        });

        expect(result).toBe('مرحبا');
        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('sl=auto'),
        );
    });
});
