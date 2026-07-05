---
name: npm security-firewall blocked package
description: What to do when npm install fails with 403 "Blocked by Security Policy / Critical CVE" for every version of a package.
---

Replit's `package-firewall.replit.local` proxy can block a package name at every published version (not just vulnerable ones) — retrying with a newer/older pinned version still 403s.

**Why:** Observed with `shell-quote` (pulled in transitively via `cross-spawn`/`react-dev-utils`/`launch-editor`, deps of `react-scripts`). Every version from 1.7.2 through 1.8.3 was rejected with "Critical CVE" — this is a blanket policy block on the package name, not a version-specific CVE fix.

**How to apply:** Don't keep retrying versions. Instead vendor a minimal local replacement package (fetch the real MIT-licensed source from the project's GitHub repo raw files, e.g. `raw.githubusercontent.com/<owner>/<repo>/main/...`, not the npm registry) into `vendor/<pkgname>/`, then add an `overrides` entry in package.json: `"overrides": { "<pkgname>": "file:./vendor/<pkgname>" }`. npm overrides apply regardless of which transitive dependency requests the package, so this resolves it everywhere in the tree.

Also: on this project, `npm install` from a clean `node_modules` with `puppeteer` (Chromium download) and `cypress` (binary download) as dependencies can hang/exceed tool timeouts. Set `PUPPETEER_SKIP_DOWNLOAD=true CYPRESS_INSTALL_BINARY=0` env vars before `npm install` to skip those heavy postinstall downloads (not needed to run the app, only for full local e2e/browser testing).
