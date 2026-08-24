---
name: YouTube subtitle providers
description: Compatibility rule for choosing the subtitle fetch implementation.
---

The YouTube learner supports three subtitle fetch implementations. A project may retain the provider selected during setup; projects created before provider selection must continue using youtube-transcript-plus by default.

**Why:** Existing saved projects do not have a provider field, and silently changing their fetch behavior would make adding a later language track inconsistent with the tracks already loaded.

**How to apply:** Use the provider choice for every subtitle-fetch request associated with a project, including tracks added after the initial setup. OnRender setup should use its video-info endpoint for language discovery and its subtitles endpoint for SRT content.