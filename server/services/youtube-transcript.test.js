const assert = require('node:assert/strict');
const test = require('node:test');
const {
    resolveInvidiousCaptionUrl,
    vttToSrt,
} = require('./youtube-transcript');

test('resolves captions[0].label into the Invidious subtitle URL', async () => {
    const originalFetch = global.fetch;
    const sourceUrl = 'https://invidious.nerdvpn.de/companion/api/v1/captions/lXCAHAJR2-Q?check=check-id';
    let requestedUrl = '';
    global.fetch = async url => {
        requestedUrl = String(url);
        return {
            ok: true,
            json: async () => ({ captions: [{ label: 'English (US)' }] }),
        };
    };

    try {
        const result = await resolveInvidiousCaptionUrl(sourceUrl);
        assert.equal(requestedUrl, sourceUrl);
        assert.equal(
            result,
            `${sourceUrl}&label=English+%28US%29`,
        );
    } finally {
        global.fetch = originalFetch;
    }
});

test('validates VTT cues and converts them to deduplicated SRT', () => {
    const vtt = [
        'WEBVTT',
        '',
        '00:00:01.000 --> 00:00:02.000',
        'first line',
        'second line',
        '',
        '00:00:01.000 --> 00:00:02.000',
        'first line',
        'second line',
        '',
        '00:00:02.000 --> 00:00:03.000',
        'next cue',
    ].join('\n');

    assert.equal(
        vttToSrt(vtt),
        [
            '1',
            '00:00:01,000 --> 00:00:02,000',
            'first line',
            'second line',
            '',
            '2',
            '00:00:02,000 --> 00:00:03,000',
            'next cue',
        ].join('\n'),
    );
});
