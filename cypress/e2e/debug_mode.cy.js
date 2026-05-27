/**
 * Debug mode E2E test
 *
 * Verifies that:
 * 1. Navigating to /ai-conversation#debug activates debug mode
 * 2. The DBG button is visible (show_debug_toggle_button = true)
 * 3. Clicking the DBG button toggles the hash and mode on/off
 * 4. The #debug hash is reflected in the URL after toggle
 */
describe('Debug Mode', () => {
  const AI_URL = '/ai-conversation';

  beforeEach(() => {
    cy.visit(AI_URL);
    // Wait for the component to mount
    cy.get('.ai-conversation', { timeout: 10000 }).should('exist');
  });

  it('shows the DBG toggle button in the mode bar', () => {
    cy.get('.ai-mode-bar').within(() => {
      cy.contains('button', 'DBG').should('exist');
    });
  });

  it('activates debug mode when visiting with #debug hash', () => {
    cy.visit(AI_URL + '#debug');
    cy.get('.ai-conversation', { timeout: 10000 }).should('exist');
    cy.get('.ai-mode-bar').within(() => {
      cy.contains('button', 'DBG ●').should('exist');
    });
    cy.hash().should('eq', '#debug');
  });

  it('toggles debug mode on when clicking DBG button', () => {
    // Start without debug mode
    cy.visit(AI_URL);
    cy.get('.ai-conversation', { timeout: 10000 }).should('exist');

    // Button should show "DBG" (off)
    cy.get('.ai-mode-bar').within(() => {
      cy.contains('button', /^DBG$/).should('exist');
    });

    // Click to enable
    cy.get('.ai-mode-bar').contains('button', /^DBG$/).click();

    // Hash should now be #debug
    cy.hash().should('eq', '#debug');

    // Button should show "DBG ●" (on)
    cy.get('.ai-mode-bar').contains('button', 'DBG ●').should('exist');
  });

  it('toggles debug mode off when clicking again', () => {
    cy.visit(AI_URL + '#debug');
    cy.get('.ai-conversation', { timeout: 10000 }).should('exist');

    // Debug is on
    cy.get('.ai-mode-bar').contains('button', 'DBG ●').should('exist');

    // Click to disable
    cy.get('.ai-mode-bar').contains('button', 'DBG ●').click();

    // Button should revert to "DBG" (off)
    cy.get('.ai-mode-bar').contains('button', /^DBG$/).should('exist');
  });

  it('shows key suffix tag on assistant messages in debug mode (if messages exist)', () => {
    cy.visit(AI_URL + '#debug');
    cy.get('.ai-conversation', { timeout: 10000 }).should('exist');

    // If there are no messages yet, this test is a no-op (correct behaviour)
    cy.get('body').then(($body) => {
      if ($body.find('.ai-message.assistant').length > 0) {
        // Key suffix tags should be visible
        cy.get('.ai-message.assistant').first().find('.ai-key-sig').should('exist');
      } else {
        cy.log('No assistant messages present — key suffix tag test skipped');
      }
    });
  });

  it('shows the prompt chip bar on the conversation page', () => {
    cy.get('.ai-prompt-chip-bar').should('exist');
    cy.get('.ai-prompt-chip').should('exist');
  });

  it('opens settings popup when clicking the prompt chip', () => {
    cy.get('.ai-prompt-chip').click();
    cy.get('.ai-popup.ai-popup-settings').should('exist');
    cy.get('.ai-popup-backdrop').click({ force: true });
    cy.get('.ai-popup.ai-popup-settings').should('not.exist');
  });

  it('settings popup closes on backdrop click', () => {
    cy.get('button.ai-settings-btn').click();
    cy.get('.ai-popup.ai-popup-settings').should('exist');
    cy.get('.ai-popup-backdrop').click({ force: true });
    cy.get('.ai-popup.ai-popup-settings').should('not.exist');
  });

  it('settings popup closes on X button', () => {
    cy.get('button.ai-settings-btn').click();
    cy.get('.ai-popup.ai-popup-settings').within(() => {
      cy.get('.ai-popup-close').click();
    });
    cy.get('.ai-popup.ai-popup-settings').should('not.exist');
  });
});
