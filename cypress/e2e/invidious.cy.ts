describe('Invidious subtitle import', () => {
    const sourceUrl = 'https://invidious.nerdvpn.de/companion/api/v1/captions/lXCAHAJR2-Q?check=X-ce5seVANHkTyqeXaj2WyRAlxP7oYXDK_Hf49yQGLw=';

    beforeEach(() => {
        cy.clearLocalStorage();
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
        cy.visit('/youtube');
        cy.contains('button', 'Invidious').click();
        pasteSourceUrl();
        cy.location('pathname').should('equal', '/youtube');
        cy.contains('Subtitles fetched successfully').should('be.visible');
        cy.wait(1000);
        cy.location('pathname').should('equal', '/youtube');
        cy.contains('button', 'Continue to view').click();
        cy.url().should('match', /\/youtube\/view\/lXCAHAJR2-Q$/);
        cy.get('.yl-table tbody .yl-row').should('have.length', 2);
        cy.get('.yl-table tbody .yl-td-text').eq(0)
            .should('contain.text', 'What do you make of the most historic,')
            .and('contain.text', 'remarkable scenes that we\'ve seen over');
        cy.get('.yl-table tbody .yl-td-text').eq(1)
            .should('contain.text', 'remarkable scenes that we\'ve seen over')
            .and('contain.text', 'the past few days?');
        cy.contains('button', '← Home').scrollIntoView().click({ force: true });
        cy.location('pathname').should('equal', '/youtube');
        cy.wait(1000);
        cy.location('pathname').should('equal', '/youtube');
    });
});