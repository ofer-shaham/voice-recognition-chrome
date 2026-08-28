# Codespaces

## Install dependencies

From the repository root:

```bash
./manage.sh install
```

This installs the client, server, and Cypress dependencies. The project uses `pnpm-lock.yaml`; `manage.sh install` currently uses the repository's supported npm install flow.

## Native Codespaces workflow

Start the client and server, including health checks:

```bash
./manage.sh --codespace ensure
```

The client runs at `http://localhost:5000` and the server runs at `http://localhost:3001`.

Run the Invidious Cypress spec:

```bash
./manage.sh --codespace e2e
```

The command automatically installs the Linux packages required by Cypress when passwordless `sudo` is available. It selects Chrome when installed and otherwise uses the bundled Electron browser. To choose a browser explicitly:

```bash
CYPRESS_BROWSER=electron ./manage.sh --codespace e2e
```

Stop native services when finished:

```bash
./manage.sh --codespace stop
```

## Docker Cypress workflow

Docker mode builds and starts the test client, server, and Cypress containers, then cleans them up after the run:

```bash
./manage.sh --docker e2e
```

Save the Cypress video explicitly:

```bash
./manage.sh --docker e2e --record
```

Docker must be running before starting this workflow. Check the environment with:

```bash
./manage.sh doctor
```

## Subtitle E2E coverage

`cypress/e2e/invidious.cy.ts` is a live integration test. It does not stub or mock network requests. The test resolves the configured Invidious caption URL, fetches the real subtitle file, imports it through the local server, and asserts the rendered subtitle rows.

The test requires outbound network access to the configured Invidious instance. If that service is unavailable, the test should fail rather than silently pass against mocked data.

## Troubleshooting

If the native E2E command reports missing Cypress dependencies, rerun:

```bash
./manage.sh --codespace e2e
```

If automatic installation is unavailable, install the packages manually and rerun:

```bash
sudo apt-get update
sudo apt-get install -y xvfb libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libnss3 libxss1 libasound2t64 libxtst6 libatk1.0-0 libatk-bridge2.0-0
```
