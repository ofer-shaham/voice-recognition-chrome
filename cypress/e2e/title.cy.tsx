describe('Translation request routing', () => {
  it('uses the local proxy URL for translation-backed transcript requests', () => {
    cy.intercept('GET', '**/api/srt*', (req) => {
      expect(req.url).to.include('/api/srt');
      expect(req.url).to.not.include('youtube-dl-jrte.onrender.com');
      req.reply({
        statusCode: 200,
        body: '1\n00:00:00,000 --> 00:00:01,000\nHello',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }).as('srtProxyRequest');

    cy.visit('/');

    cy.window().then((win) => {
      const url = new URL('/api/srt', win.location.origin);
      url.searchParams.set('videoId', 'prSfxdmjNzE');
      url.searchParams.set('lang', 'auto');
      url.searchParams.set('targetLang', 'he');
      win.fetch(url.toString());
    });

    cy.wait('@srtProxyRequest').its('request.url').should('include', '/api/srt');
    cy.wait('@srtProxyRequest').its('request.url').should('not.include', 'youtube-dl-jrte.onrender.com');
  });
});