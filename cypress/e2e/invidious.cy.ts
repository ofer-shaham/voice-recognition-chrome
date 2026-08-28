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

describe('YouTube learner playback with subtitle fixture', () => {
    const sourceUrl = 'https://invidious.nerdvpn.de/companion/api/v1/captions/lXCAHAJR2-Q?check=X-ce5seVANHkTyqeXaj2WyRAlxP7oYXDK_Hf49yQGLw=';
    const subtitleUrl = `${sourceUrl}&label=English%20(auto-generated)`;
    const subtitles = [
        '1', '00:00:00,000 --> 00:00:02,350', 'What do you make of the most historic,',
        '', '2', '00:00:02,360 --> 00:00:03,950', 'What do you make of the most historic,',
        'remarkable scenes that we\'ve seen over',
        '', '3', '00:00:03,960 --> 00:00:04,830', 'remarkable scenes that we\'ve seen over',
        'the past few days?',
        '', '4', '00:00:04,840 --> 00:00:06,190', 'the past few days?', '>> Good news.',
        '', '5', '00:00:06,200 --> 00:00:09,590', '>> Good news.', 'Good news. Sometimes war,',
        '', '6', '00:00:09,600 --> 00:00:11,830', 'Good news. Sometimes war,', 'alongside being terrible, is also',
        '', '7', '00:00:11,840 --> 00:00:14,790', 'alongside being terrible, is also', 'liberating. And now we\'re responding to',
        '', '8', '00:00:14,800 --> 00:00:17,630', 'liberating. And now we\'re responding to', 'the head of the snake. We need to',
        '', '9', '00:00:17,640 --> 00:00:21,630', 'the head of the snake. We need to', 'infuriate the New York Times and the BBC',
        '', '10', '00:00:21,640 --> 00:00:25,470', 'infuriate the New York Times and the BBC', 'and CNN and the United Nations and',
        '', '11', '00:00:25,480 --> 00:00:28,670', 'and CNN and the United Nations and', 'Amnesty International. If you take',
        '', '12', '00:00:28,680 --> 00:00:31,310', 'Amnesty International. If you take', 'progressives seriously, you stop',
        '', '13', '00:00:31,320 --> 00:00:32,950', 'progressives seriously, you stop', 'understanding the world. And if you',
        '', '14', '00:00:32,960 --> 00:00:35,830', 'understanding the world. And if you', 'waste your time even listening to them,',
        '', '15', '00:00:35,840 --> 00:00:38,710', 'waste your time even listening to them,', 'it\'s a waste of time. We are the Jewish',
        '', '16', '00:00:38,720 --> 00:00:40,510', 'it\'s a waste of time. We are the Jewish', 'people. Some people want to be',
        '', '17', '00:00:40,520 --> 00:00:42,470', 'people. Some people want to be', 'religious, fine. That\'s that\'s their',
        '', '18', '00:00:42,480 --> 00:00:44,270', 'religious, fine. That\'s that\'s their', 'privilege. As long as they\'re not',
        '', '19', '00:00:44,280 --> 00:00:46,710', 'privilege. As long as they\'re not', 'ultra-Orthodox parasites. There\'s a a',
        '', '20', '00:00:46,720 --> 00:00:48,270', 'ultra-Orthodox parasites. There\'s a a', 'sense within the ultra-Orthodox world',
        '', '21', '00:00:48,280 --> 00:00:49,670', 'sense within the ultra-Orthodox world', 'that they feel there\'s a fundamental',
        '', '22', '00:00:49,680 --> 00:00:51,630', 'that they feel there\'s a fundamental', 'disrespect for them and what and their',
        '', '23', '00:00:51,640 --> 00:00:53,230', 'disrespect for them and what and their', 'Torah values. And I think that, you',
    ].join('\n');

    beforeEach(() => {
        cy.clearLocalStorage();
        cy.intercept('GET', '/api/invidious-caption*', {
            statusCode: 200,
            body: { subtitleUrl },
        });
        cy.intercept('GET', '/api/srt-url*', {
            statusCode: 200,
            body: subtitles,
        });
    });

    it('renders the supplied subtitle fixture and keeps playback controls synchronized', () => {
        cy.visit('/youtube');
        cy.contains('button', 'Invidious').click();
        cy.get('input[placeholder="https://www.youtube.com/watch?v=..."]').clear().type(sourceUrl);
        cy.contains('button', 'Continue →').click();
        cy.contains('button', 'Continue to view →').should('be.visible').click();

        cy.get('.yl-table tbody .yl-row').should('have.length', 23);
        cy.get('.yl-table tbody .yl-td-text').first()
            .should('contain.text', 'What do you make of the most historic,');
        cy.get('.yl-table tbody .yl-td-text').eq(1)
            .should('contain.text', 'remarkable scenes that we\'ve seen over');
        cy.get('.yl-table tbody .yl-td-text').last()
            .should('contain.text', 'Torah values. And I think that, you');

        cy.contains('button', /▶ (Play|Resume)/).click();
        cy.wait(1000);
        cy.contains('button', '⏸ Pause').should('be.visible');

        cy.contains('button', '⏸ Pause').click();
        cy.wait(1000);
        cy.contains('button', '▶ Resume').should('be.visible');

        cy.contains('button', '▶ Resume').click();
        cy.wait(1000);
        cy.contains('button', '⏸ Pause').should('be.visible');
    });
});