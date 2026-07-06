describe('Translation request routing', () => {
  it('uses the local proxy URL for transcript-backed requests from the /youtube page', () => {
    cy.visit('/youtube');
    cy.contains('YouTube Language Learner').should('be.visible');

    cy.window().then(async (win) => {
      const url = new URL('/api/transcript/languages', win.location.origin);
      url.searchParams.set('videoId', 'prSfxdmjNzE');
      const response = await win.fetch(url.toString());
      expect(response.ok).to.equal(true);
      const body = await response.json();
      expect(body).to.have.property('availableLanguages');
      expect(body.availableLanguages).to.be.an('array').that.is.not.empty;
      expect(body.videoDetails?.videoId).to.equal('prSfxdmjNzE');
    });
  });
});