import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const transcriptService = await import('../../server/services/youtube-transcript.js');

describe('transcript fetch config', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '1\n00:00:00,000 --> 00:00:01,000\nHello',
        }) as unknown as typeof fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('returns SRT content through the supported fetcher', async () => {
        const result = await transcriptService.fetchSrt('abc123', 'en', '4');

        expect(result).toContain('00:00:00,000 --> 00:00:01,000');
        expect(globalThis.fetch).toHaveBeenCalled();
    });
});
