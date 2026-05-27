[![Netlify Status](https://api.netlify.com/api/v1/badges/ad488823-febb-49e2-8a6f-3c922474d39f/deploy-status)](https://app.netlify.com/sites/chrome-voice-recognition/deploys)

[Visit board!](https://github.com/users/ofer-shaham/projects/5)

## Running E2E Tests

### Locally (with Cypress)

Requires the app and server to be running on ports 5000 and 3001:

```bash
# Terminal 1 — Express server
node server/index.js

# Terminal 2 — React app
npm start

# Terminal 3 — run Cypress tests headlessly
npx cypress run --browser chrome --spec cypress/e2e/debug_mode.cy.js

# Or open the Cypress UI for interactive testing
npx cypress open
```

### With Docker Compose

Run the full stack + Cypress in one command. Videos are saved to `cypress/videos/`:

```bash
# Start the app stack
docker-compose up --build

# In a separate terminal, run the test suite against the running stack
docker-compose -f docker-compose.test.yml run --rm cypress
```

Convert test videos to animated GIFs (requires `ffmpeg`):

```bash
for f in cypress/videos/*.mp4; do
  name=$(basename "$f" .mp4)
  ffmpeg -i "$f" -vf "fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
    -loop 0 "cypress/gifs/${name}.gif" -y
done
```

### GitHub Actions

Push to `main` — the workflow at `.github/workflows/e2e-tests.yml` runs automatically:
- Builds the app
- Runs Cypress tests with video recording
- Converts videos → animated GIFs via ffmpeg
- Uploads all artifacts (videos + GIFs + screenshots)
- Deploys GIFs to `gh-pages` under `test-recordings/<run-number>/`

View the latest GIF artifacts on the Actions tab or at:
`https://<your-org>.github.io/<repo>/test-recordings/`

## Debug Mode

Navigate to `/ai-conversation#debug` to enable debug mode. Each AI message will show the last 4 characters of the API key used (`...xxxx` tag).

The **DBG** toggle button in the mode bar lets you switch in/out of debug mode without manually editing the URL.

```yaml
- run e2e test on ci

NEXT:
- 0. add state
- 1. full-screen mode:
- 1.0 - add button for reset language to english - use a confirmation dialog protection
- 1.0.0 allow sharing a full-screen state: sync full-screen mode with search params
- 1.0.1.0 dedicate space for both languages evenly - add vertical margin 
- 1.0.1.1 divide screen to 2 parts: border highlight when narrated
- 1.1 accesability: implement dark/light mode and use a better color pallete
- 1.2.0 present sentences using buttons: flexible font-size & spaces in-between buttons
- 1.2.0.1 speak a clicked word button
- 1.2.0.2 sentence click will trigger tts
- 1.3. history navigation: using a swapping gesture

- feature: repeatition game:
- collect words from historic sentences by clicking individual words
- collect few words and then trigger them by pronouncing them.
- highlight spoken word
- visualize as moving tags so that a sentence will be represented as tags which are attached by strings.

- 2. epic: multi-lingual translation:
- integrate redux and visualize the state
- sync params
- full-screen mode will be awesome


- 0. github action: e2e test with a simulated microphone
- fix recordings: pc mode
- language accordion: add a button which allow to quickly reset to english (it would enable the voice commands) 




done:
- show currently spoken text as highlighted
- show only source/target text: wrap text and highlight border when activated
- show only source/target text: hide all other buttons
- delay translation when a new sentence is being typed
- create git tag for ver 1.0.0: d1757935145bb14bea91ea3e82a4a73c3113aa9b -> deployed as branch ver1

later:
- support multiple translationBox
- multiple translaion boxes:
- once AI is employed - query AI regarding a word mutation accross languages and visualize it using a tree.

```