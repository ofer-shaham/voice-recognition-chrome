---
name: YouTube production API parity
description: Deployment constraint for the YouTube learner subtitle endpoints.
---

The YouTube learner calls the stable `/api/transcript/languages` and `/api/srt` contracts. Both the local Express server and the Netlify function must implement those contracts; documenting an endpoint or proxying only the newer `/api/youtube/*` paths is not sufficient.

**Why:** Local development and production use different API handlers, so a client flow can pass a local build while failing after deployment if only the Express routes are updated.

**How to apply:** When changing subtitle fetching, update and syntax-check both handlers. Preserve automatic provider fallback locally and return normalized language metadata plus plain SRT text from the production function.