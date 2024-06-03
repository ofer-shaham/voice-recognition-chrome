import { cy } from 'cypress';

describe('Example Test Suite', () => {
  beforeEach(() => {
    // Load the page before each test
    cy.visit('http://localhost:3000')
  });

  it('should have the correct page title', () => {
    // Assert that the page title matches the expected value
    cy.title().should('equal', 'Chrome voice recognition');
  });
});