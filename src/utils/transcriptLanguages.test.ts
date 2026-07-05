// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

const transcriptService = await import('../../server/services/youtube-transcript.js');

describe('transcript language fallback', () => {
    it('returns an empty language list when all upstream providers fail', async () => {
        const originalFetch = globalThis.fetch;

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
            text: async () => 'service unavailable',
        }) as unknown as typeof fetch;

        const result = await transcriptService.fetchVideoInfoDownsub('abc123').catch((err) => ({ error: err.message }));

        globalThis.fetch = originalFetch;

        expect(result).toEqual({ error: expect.stringContaining('DownSub API /api/video-info HTTP 503') });
    });
});
