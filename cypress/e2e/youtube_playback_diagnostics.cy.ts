describe('YouTube playback diagnostics', () => {
    const project = {
        id: 'playback-diagnostic-project',
        videoId: 'lXCAHAJR2-Q',
        title: 'Playback diagnostic project',
        description: 'Playback diagnostic fixture',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastLine: 2,
        lastTime: 6.2,
        tracks: [{
            lang: 'en',
            label: 'English',
            isAuto: true,
            srtContent: [
                '1', '00:00:00,000 --> 00:00:02,350', 'First subtitle line.',
                '', '2', '00:00:02,360 --> 00:00:03,950', 'Second subtitle line.',
                '', '3', '00:00:03,960 --> 00:00:07,830', 'Resumable subtitle line.',
            ].join('\n'),
        }],
        config: {
            targetLang: '',
            translationTargets: [],
            translationSource: 'track:en',
            colOrder: ['track:en', 'video'],
            colSettings: {
                'track:en': { visible: true, playOrder: 1, ttsRate: 1 },
                video: { visible: true, playOrder: 2, ttsRate: 1 },
            },
            visibleLines: 30,
        },
    };

    const seedProject = (win: Window) => {
        win.localStorage.setItem('yt-learner-projects', JSON.stringify([project]));
        win.localStorage.setItem('yt-learner-last', project.id);
    };

    beforeEach(() => {
        cy.clearLocalStorage();
    });

    it('does not start playback during load, resume navigation, settings, or home navigation', () => {
        cy.visit('/youtube', { onBeforeLoad: seedProject });
        cy.contains('button', 'Resume →').click();
        cy.wait(1000);
        cy.url().should('match', /\/youtube\/(?:project|view)\/playback-diagnostic-project(?:\?.*)?$/);
        cy.contains('button', '▶ Resume').should('be.visible');
        cy.contains('button', '⏸ Pause').should('not.exist');

        cy.contains('button', '⚙ Settings').click();
        cy.wait(1000);
        cy.contains('button', '▶ Resume').should('be.visible');
        cy.contains('button', '⏸ Pause').should('not.exist');

        cy.contains('button', '← Home').scrollIntoView().click({ force: true });
        cy.wait(1000);
        cy.location('pathname').should('equal', '/youtube');
        cy.contains('button', 'Resume →').should('be.visible');

        cy.contains('button', 'Resume →').click();
        cy.wait(1000);
        cy.contains('button', '▶ Resume').should('be.visible');
        cy.contains('button', '⏸ Pause').should('not.exist');
    });

    it('opens a shared resume URL paused until the user clicks Resume', () => {
        cy.visit('/youtube/view/playback-diagnostic-project?v=lXCAHAJR2-Q&tl=ar&l=5&t=9&vl=30', { onBeforeLoad: seedProject });
        cy.wait(1000);
        cy.contains('button', '▶ Resume').should('be.visible');
        cy.contains('button', '⏸ Pause').should('not.exist');
    });
});
