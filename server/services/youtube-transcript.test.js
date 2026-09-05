const assert = require('node:assert/strict');
const test = require('node:test');
const {
    resolveInvidiousCaptionUrl,
    vttToSrt,
} = require('./youtube-transcript');

test('resolves the provider returned relative caption URL', async () => {
    const originalFetch = global.fetch;
    const sourceUrl = 'https://invidious.nerdvpn.de/companion/api/v1/captions/lXCAHAJR2-Q?check=check-id';
    let requestedUrl = '';
    global.fetch = async url => {
        requestedUrl = String(url);
        return {
            ok: true,
            json: async () => ({ captions: [{ label: 'English (US)', url: '/companion/api/v1/captions/lXCAHAJR2-Q?label=English%20(US)' }] }),
        };
    };

    try {
        const result = await resolveInvidiousCaptionUrl(sourceUrl);
        assert.equal(requestedUrl, sourceUrl);
        assert.equal(
            result,
            'https://invidious.nerdvpn.de/companion/api/v1/captions/lXCAHAJR2-Q?label=English%20(US)',
        );
    } finally {
        global.fetch = originalFetch;
    }
});

test('resolves the selected caption label from the provider options', async () => {
    const originalFetch = global.fetch;
    const sourceUrl = 'https://invidious.nerdvpn.de/companion/api/v1/captions/lXCAHAJR2-Q?check=check-id&label=Hebrew%20(auto-generated)';
    global.fetch = async () => ({
        ok: true,
        json: async () => ({ captions: [
            { label: 'English (auto-generated)', url: '/companion/api/v1/captions/lXCAHAJR2-Q?label=English%20(auto-generated)' },
            { label: 'Hebrew (auto-generated)', url: '/companion/api/v1/captions/lXCAHAJR2-Q?label=Hebrew%20(auto-generated)' },
        ] }),
    });

    try {
        assert.equal(
            await resolveInvidiousCaptionUrl(sourceUrl),
            'https://invidious.nerdvpn.de/companion/api/v1/captions/lXCAHAJR2-Q?label=Hebrew%20(auto-generated)',
        );
    } finally {
        global.fetch = originalFetch;
    }
});

test('validates VTT cues and converts them to deduplicated SRT', () => {
    const vtt = [
        'WEBVTT',
        'Kind: captions',
        '',
        'cue-1',
        '00:00:01.000 --> 00:00:02.000',
        ' ',
        'first line',
        'second line',
        '',
        'cue-1-duplicate',
        '00:00:01.000 --> 00:00:02.000 align:start position:0%',
        'first line',
        'second line',
        '',
        'malformed cue',
        'not a timestamp',
        'ignored text',
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
    assert.equal((vttToSrt(vtt).match(/00:00:01,000 --> 00:00:02,000/g) || []).length, 1);
});

test('removes short boundary cues that duplicate the next cue prefix', () => {
    const vtt = [
        'WEBVTT',
        '',
        '00:01:43.270 --> 00:01:43.280',
        'right now, and the last thing we need is',
        '',
        '00:01:43.280 --> 00:01:45.710',
        'right now, and the last thing we need is',
        'to<00:01:43.400><c> deepen</c> our internal divisions.',
    ].join('\n');

    const result = vttToSrt(vtt);
    assert.equal((result.match(/00:01:43,270 --> 00:01:43,280/g) || []).length, 0);
    assert.equal((result.match(/00:01:43,280 --> 00:01:45,710/g) || []).length, 1);
    assert.match(result, /right now, and the last thing we need is\nto deepen our internal divisions\./);
});
