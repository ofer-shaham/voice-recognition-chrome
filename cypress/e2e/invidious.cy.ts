describe('Invidious subtitle import', () => {
    const sourceUrl = 'https://invidious.nerdvpn.de/companion/api/v1/captions/lXCAHAJR2-Q?check=X-ce5seVANHkTyqeXaj2WyRAlxP7oYXDK_Hf49yQGLw=';

    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', '/api/invidious-caption*').as('resolveCaptions');
    });

    const pasteSourceUrl = () => {
        cy.get('input[placeholder="https://www.youtube.com/watch?v=..."]')
            .clear()
            .then(input => {
                const clipboardData = new DataTransfer();
                clipboardData.setData('text/plain', sourceUrl);
                input[0].dispatchEvent(new ClipboardEvent('paste', {
                    bubbles: true,
                    clipboardData,
                }));
            });
    };

    it('resolves and fetches pasted Invidious captions', () => {
        const resolvedUrl = new URL(sourceUrl);
        resolvedUrl.searchParams.set('label', 'English (auto-generated)');
        cy.intercept('GET', '/api/invidious-caption*', {
            statusCode: 200,
            body: { subtitleUrl: resolvedUrl.toString() },
        }).as('resolveCaptions');
        cy.intercept('GET', '/api/srt-url*', {
            statusCode: 200,
            body: '1\n00:00:00,000 --> 00:00:01,000\nTest subtitle',
        }).as('fetchSubtitles');
        cy.visit('/youtube');
        cy.contains('button', 'Invidious').click();
        pasteSourceUrl();
        cy.wait('@resolveCaptions').then(({ request, response }) => {
            expect(new URL(request.url).searchParams.get('url')).to.equal(sourceUrl);
            const responseBody = typeof response?.body === 'string' ? JSON.parse(response.body) : response?.body;
            const resolvedUrl = new URL(responseBody.subtitleUrl);
            expect(resolvedUrl.searchParams.get('check')).to.equal(new URL(sourceUrl).searchParams.get('check'));
            expect(resolvedUrl.searchParams.get('label')).to.equal('English (auto-generated)');
        });
        cy.wait('@fetchSubtitles').then(({ request, response }) => {
            const subtitleRequestUrl = new URL(new URL(request.url).searchParams.get('url'));
            expect(subtitleRequestUrl.pathname).to.equal('/companion/api/v1/captions/lXCAHAJR2-Q');
            expect(subtitleRequestUrl.searchParams.get('label')).to.equal('English (auto-generated)');
            expect(response?.body).to.match(/^1\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n\S/);
            const timestamps = response?.body.match(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/g) || [];
            expect(new Set(timestamps).size, 'SRT cue timestamps should be unique').to.equal(timestamps.length);
        });
        cy.location('pathname').should('equal', '/youtube');
        cy.contains('Subtitles fetched successfully').should('be.visible');
        cy.wait(1000);
        cy.location('pathname').should('equal', '/youtube');
        cy.contains('button', 'Continue to view').click();
        cy.url().should('match', /\/youtube\/view\/lXCAHAJR2-Q$/);
        cy.get('.yl-table tbody .yl-row').should('have.length.greaterThan', 0);
        cy.get('.yl-table tbody .yl-td-text').first().invoke('text').should('not.be.empty');
        cy.contains('button', '← Home').scrollIntoView().click({ force: true });
        cy.location('pathname').should('equal', '/youtube');
        cy.wait(1000);
        cy.location('pathname').should('equal', '/youtube');
    });

    it('stays on setup when the final subtitle request fails', () => {
        cy.intercept('GET', '/api/invidious-caption*', {
            statusCode: 200,
            body: { subtitleUrl: `${sourceUrl}&label=English%20(auto-generated)` },
        }).as('resolveCaptions');
        cy.intercept('GET', '/api/srt-url*', {
            statusCode: 502,
            body: { error: 'Subtitle URL returned HTTP 503' },
        }).as('fetchSubtitles');
        cy.visit('/youtube');
        cy.contains('button', 'Invidious').click();
        pasteSourceUrl();

        cy.wait('@resolveCaptions');
        cy.wait('@fetchSubtitles');
        cy.location('pathname').should('not.match', /\/youtube\/view\//);
        cy.contains('Subtitle URL returned HTTP 503').should('be.visible');
    });
});