describe('Invidious subtitle import', () => {
    const sourceUrl = 'https://invidious.nerdvpn.de/companion/api/v1/captions/5DW_AopdpqU?check=dKi8-UYLD3E-MjOzTEwPRvuaSUgYbUUtK-bvRNcNHgY=';
    const subtitleUrl = `${sourceUrl}&label=English%20%28US%29`;

    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', '/api/invidious-caption*', {
            statusCode: 200,
            body: { subtitleUrl },
        }).as('resolveCaptions');
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
        cy.intercept('GET', '/api/srt-url*', {
            statusCode: 200,
            body: '1\n00:00:00,000 --> 00:00:01,000\nactual subtitle response',
        }).as('fetchSubtitles');
        cy.visit('/youtube');
        cy.contains('button', 'Invidious').click();
        pasteSourceUrl();
        cy.wait('@resolveCaptions').then(({ request, response }) => {
            expect(new URL(request.url).searchParams.get('url')).to.equal(sourceUrl);
            expect(response?.body.subtitleUrl).to.equal(subtitleUrl);
        });
        cy.wait('@fetchSubtitles').then(({ request }) => {
            expect(new URL(request.url).searchParams.get('url')).to.equal(subtitleUrl);
        });
        cy.url().should('match', /\/youtube\/view\/5DW_AopdpqU$/);
        cy.get('.yl-table tbody .yl-row').should('have.length.greaterThan', 0);
        cy.get('.yl-table tbody .yl-td-text').first().invoke('text').should('not.be.empty');
    });

    it('stays on setup when the final subtitle request fails', () => {
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