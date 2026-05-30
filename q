[33mcommit a580ce6938991aaa6f759dd24869fa7833630156[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m, [m[1;31morigin/main[m[33m, [m[1;31morigin/HEAD[m[33m)[m
Author: Replit Agent <agent@replit.com>
Date:   Sat May 30 05:00:38 2026 +0000

    Post-merge setup completed successfully
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 6807ef04-42fc-49a9-8a7e-dc1b22522c5a
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 3acf1076-6644-4fb0-b67f-134aea08157d
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/c529db3e-b906-4429-9bea-2ff48c2d0886/6807ef04-42fc-49a9-8a7e-dc1b22522c5a/dNFQy0z
    Replit-Helium-Checkpoint-Created: true

[33mcommit 1e5950eb96f537bf4eab3e6f807a9f7587a27d29[m
Author: mostuf556 <1535225-mostuf556@users.noreply.replit.com>
Date:   Sat May 30 04:59:54 2026 +0000

    feat: YouTube transcript CLI test + method switch + Swagger docs
    
    Task: YouTube transcript CLI test + method switch + Swagger docs
    
    Changes made:
    
    1. server/index.js — /api/srt handler refactored
       - Added ?method= query param: "1" forces youtube-transcript-plus only,
         "2" forces youtube-transcript-api-js only, omitted keeps auto-fallback
       - Extracted runMethod1() and runMethod2() inner functions to eliminate
         code duplication between forced and fallback paths
    
    2. server/index.js — Swagger spec updated
       - Added `method` parameter to /api/srt with enum ["1","2"] and description
       - Updated videoId example on /api/srt to full YouTube watch URL
       - Updated videoId example on /api/transcript/languages to full YouTube watch URL
       (so Swagger "Try it out" works without typing anything)
    
    3. server/test-transcript.js — new CLI test script
       - Calls /api/srt?method=1 and ?method=2 against a real video (dQw4w9WgXcQ)
       - Prints [PASS]/[FAIL] per method with HTTP status and elapsed time
       - Appends full run log to server/test-results.log (timestamp, status,
         elapsed, first 300 chars of SRT body) — retains history across runs
       - Exits 0 on all pass, 1 on any failure
       - Verified live: both methods return HTTP 200 with non-empty SRT
    
    4. server/README.md — new documentation file
       - How to start the server, open Swagger UI, run the CLI test
       - curl examples for method=1, method=2, and auto-fallback
       - Table comparing the two fetch methods and when each is preferred
       - Reference to the two standalone service implementation files
    
    5. server/services/srt_fetch1.js — rewritten as proper service module
       - Now mirrors srt_fetch.js (youtube-transcript-plus) in structure
       - Uses youtube-transcript-api-js; runs its own express server on port 3002
       - Supports SRT, VTT, and JSON output formats
       - Endpoints: GET /transcript/languages, GET /transcript
       - Proper error handling middleware with descriptive error types
    
    No frontend changes. No caching layer changes. No new packages added.
    
    Replit-Task-Id: 5f38a06b-761b-4592-bfd4-b0a24cabfb87

[33mcommit dc3740aef1ad1247b414331b51efd06d3995ef65[m
Author: Replit Agent <agent@replit.com>
Date:   Sat May 30 04:29:22 2026 +0000

    Add global error banner and debug mode toggle to the interface
    
    Introduces a persistent global error banner for all failures and a debug mode toggle for detailed error messages.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 6807ef04-42fc-49a9-8a7e-dc1b22522c5a
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: f573b624-77b9-471a-a8a4-01002ec47ce8
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/c529db3e-b906-4429-9bea-2ff48c2d0886/6807ef04-42fc-49a9-8a7e-dc1b22522c5a/dNFQy0z
    Replit-Helium-Checkpoint-Created: true

[33mcommit 3007087d59e2bca1f1089534faadba817d9ffd5f[m
Author: Replit Agent <agent@replit.com>
Date:   Sat May 30 04:06:51 2026 +0000

    Add a fullscreen player and improve transcript navigation
    
    Introduce a new FullscreenPlayer component for immersive viewing, enhance transcript line display with pagination, and refine project loading logic to prevent playback conflicts.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 6807ef04-42fc-49a9-8a7e-dc1b22522c5a
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 1baeaddc-69b0-4218-bbb1-4bc48084570e
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/c529db3e-b906-4429-9bea-2ff48c2d0886/6807ef04-42fc-49a9-8a7e-dc1b22522c5a/9HA331X
    Replit-Helium-Checkpoint-Created: true

[33mcommit 4a468d1017fe122c69a1d925625fbe2d1a347e14[m
Author: Replit Agent <agent@replit.com>
Date:   Sat May 30 03:39:12 2026 +0000

    Update project dependencies to their latest versions
    
    Update various dependencies in package.json, including react, react-dom, react-router-dom, and others, to their newest available versions.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 6807ef04-42fc-49a9-8a7e-dc1b22522c5a
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 6d6a3d73-9f13-4d0d-ba69-6cc1e1c2754c
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/c529db3e-b906-4429-9bea-2ff48c2d0886/6807ef04-42fc-49a9-8a7e-dc1b22522c5a/oAWfyhR
    Replit-Helium-Checkpoint-Created: true

[33mcommit 458c68bf0f37d0637ef05ecf7a8a370d70935bb4[m
Author: Replit Agent <agent@replit.com>
Date:   Sat May 30 02:17:23 2026 +0000

    Add a YouTube video transcript learner and player
    
    Implement a new feature for parsing YouTube video transcripts, translating them, and providing a player interface for learning and review.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 17862b63-63b0-4577-b966-d6dae8d14923
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 106908e7-88cd-4de7-8c4f-63123a3e06d9
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/400c9092-c121-4403-9ab3-0615a128b6a9/17862b63-63b0-4577-b966-d6dae8d14923/cti1fEr
    Replit-Helium-Checkpoint-Created: true

[33mcommit 9132e756a9f9d72637ed391735811e4a1ae38ea1[m
Author: Replit Agent <agent@replit.com>
Date:   Sat May 30 01:28:54 2026 +0000

    Add language selection to the project menu bar
    
    Pass `toLang` and `onToLangChange` props to the `ProjectsMenu` component in `YoutubeTranscriptParser.tsx`.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 17862b63-63b0-4577-b966-d6dae8d14923
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 89ee36f7-db4c-4e54-9c48-3076aeaf2856
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/400c9092-c121-4403-9ab3-0615a128b6a9/17862b63-63b0-4577-b966-d6dae8d14923/b3qPEqK
    Replit-Helium-Checkpoint-Created: true

[33mcommit a105bdb309d10ee268388e0febb9e2d33ada8d71[m
Author: Replit Agent <agent@replit.com>
Date:   Sat May 30 01:25:10 2026 +0000

    Enhance status display to show public URLs for services
    
    Update the `native_status` function to include a `service_url` helper. This helper determines and displays the correct public URL for services, especially the client on Replit, and adds a URL summary block when services are running.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 17862b63-63b0-4577-b966-d6dae8d14923
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: abde13b2-e8e3-45a0-a011-cbf8df3924bd
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/400c9092-c121-4403-9ab3-0615a128b6a9/17862b63-63b0-4577-b966-d6dae8d14923/b3qPEqK
    Replit-Helium-Checkpoint-Created: true

[33mcommit 28a13350b33f9be66f82542dbefa68074cb29cf9[m
Author: Replit Agent <agent@replit.com>
Date:   Sat May 30 01:23:24 2026 +0000

    Add helper to show correct public URLs in summaries
    
    Introduces a `print_urls` helper function to `manage.sh` to dynamically display either the local development URL or the Replit public URL based on the environment, and updates `native_ensure`, `compose_ensure`, `compose_start`, and `native_start` to use this helper.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 17862b63-63b0-4577-b966-d6dae8d14923
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 42b56d2d-89d3-4dd8-ab4b-c07b2e7bfede
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/400c9092-c121-4403-9ab3-0615a128b6a9/17862b63-63b0-4577-b966-d6dae8d14923/b3qPEqK
    Replit-Helium-Checkpoint-Created: true

[33mcommit 3e0a309c81e2115a7a78467fe58c8a5e365a4f02[m
Author: Replit Agent <agent@replit.com>
Date:   Sat May 30 01:22:04 2026 +0000

    Update script to start application on the correct port
    
    Modify the manage.sh script to include necessary environment variables when starting the client, ensuring it runs on the correct port and is accessible externally.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 17862b63-63b0-4577-b966-d6dae8d14923
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 56901c98-dbb6-42a7-9739-f8304265a3bc
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/400c9092-c121-4403-9ab3-0615a128b6a9/17862b63-63b0-4577-b966-d6dae8d14923/b3qPEqK
    Replit-Helium-Checkpoint-Created: true

[33mcommit 76046d798abcfd1ca054412da09d4abc30a99d40[m
Author: Replit Agent <agent@replit.com>
Date:   Sat May 30 01:16:42 2026 +0000

    Add option to ensure application is running and healthy
    
    Adds the `ensure` command to `manage.sh` which checks prerequisites, installs dependencies, starts the server and client, and performs HTTP health checks.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 17862b63-63b0-4577-b966-d6dae8d14923
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 0db26a60-5d12-46d4-8b9b-e3d42c2cdb99
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/400c9092-c121-4403-9ab3-0615a128b6a9/17862b63-63b0-4577-b966-d6dae8d14923/b3qPEqK
    Replit-Helium-Checkpoint-Created: true

[33mcommit 60462ecdac3523d21ad57ecf8b3f8bbc1d0253e7[m
Author: Replit Agent <agent@replit.com>
Date:   Sat May 30 01:09:48 2026 +0000

    Add install command and remove unused server start script
    
    Add an `install` command to `manage.sh` for installing dependencies and remove the now redundant `server/start.sh` script.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 17862b63-63b0-4577-b966-d6dae8d14923
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: f2e7bdaf-4a71-47cc-a0ab-db798369e06a
    Replit-Helium-Checkpoint-Created: true

[33mcommit cfe58b4f6fe14319fe62266888ed38e2f7177869[m
Author: Replit Agent <replit-agent@bots.noreply.replit.com>
Date:   Thu May 28 04:18:34 2026 +0000

    Simplify YouTube transcript feature and improve usability
    
    Refactor NewProjectWizard to an auto-only flow, update ProjectsMenu to include a target language field, and improve time parsing in YoutubeUtils.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 56d39852-9673-4f49-b409-22d3df676467
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 8c567b11-d2e6-4cb8-9125-655dc1e28d15
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/53862b0b-e164-49c9-b7a1-90f01e7b35ba/56d39852-9673-4f49-b409-22d3df676467/OiKT3XJ
    Replit-Helium-Checkpoint-Created: true

[33mcommit c3127a956f610837a801e481d71b978f4f133c94[m
Author: Replit Agent <replit-agent@bots.noreply.replit.com>
Date:   Thu May 28 03:45:06 2026 +0000

    Add ability to look up video details from YouTube URL in top menu
    
    Integrates a YouTube URL input into the ProjectsMenu component, which fetches video details and available languages via the `/api/transcript/languages` endpoint. These details are then passed to the NewProjectWizard for a pre-filled creation experience.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 56d39852-9673-4f49-b409-22d3df676467
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 96f7f89e-bf2d-49a3-bb67-874049137b7e
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/53862b0b-e164-49c9-b7a1-90f01e7b35ba/56d39852-9673-4f49-b409-22d3df676467/OiKT3XJ
    Replit-Helium-Checkpoint-Created: true

[33mcommit 5b7138d034ea7520475718189f956e162a9a7f5f[m
Author: Replit Agent <replit-agent@bots.noreply.replit.com>
Date:   Thu May 28 03:18:58 2026 +0000

    Update subtitle translation and import tools with new options
    
    Refactor YoutubeTranscriptParser.tsx and NewProjectWizard.tsx to fix dynamic translation, enable choosing between auto/manual/paste import modes, remove hardcoded settings, and prevent fetching local SRT files with default values.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 56d39852-9673-4f49-b409-22d3df676467
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: d80fb81c-4fe9-4740-b148-999031e4deb1
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/53862b0b-e164-49c9-b7a1-90f01e7b35ba/56d39852-9673-4f49-b409-22d3df676467/DgK1TAx
    Replit-Helium-Checkpoint-Created: true

[33mcommit d378d57f15bea925072d348dbdc37e72f522aec7[m
Author: Replit Agent <replit-agent@bots.noreply.replit.com>
Date:   Thu May 28 02:20:02 2026 +0000

    Add documentation and testing interface for API endpoints
    
    Integrate Swagger UI for API documentation and testing, including proxy configuration adjustments for proper routing.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 56d39852-9673-4f49-b409-22d3df676467
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 799bfc0b-89c6-4839-a7cc-f62e7afdb7bf
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/53862b0b-e164-49c9-b7a1-90f01e7b35ba/56d39852-9673-4f49-b409-22d3df676467/EOGSVTJ
    Replit-Helium-Checkpoint-Created: true

[33mcommit c57f3eaed9010a4a63272a4991a7bb4d649d8662[m
Author: Replit Agent <replit-agent@bots.noreply.replit.com>
Date:   Thu May 28 02:09:19 2026 +0000

    Add project management and YouTube transcript import features
    
    Refactors server-side YouTube data fetching, introduces new API endpoints for language and transcript retrieval, and implements client-side project management with persistence and auto-save functionality.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 56d39852-9673-4f49-b409-22d3df676467
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 74d25218-ffbb-4049-9848-2b7f451da456
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/53862b0b-e164-49c9-b7a1-90f01e7b35ba/56d39852-9673-4f49-b409-22d3df676467/K1o74Qk
    Replit-Helium-Checkpoint-Created: true

[33mcommit 3ac41c0779f1bb82162de330ae9e8b70942b6225[m
Author: Replit Agent <replit-agent@bots.noreply.replit.com>
Date:   Thu May 28 01:17:08 2026 +0000

    Document the current state of the YouTube transcript feature and its components
    
    Adds a `plan.current.yaml` file detailing the implemented features of the YouTube transcript route, alongside updates to `server/services/srt_fetch.js` and related metadata files.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 56d39852-9673-4f49-b409-22d3df676467
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 5e86f81b-7e70-43f2-8aa7-9b633ae40b93
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/53862b0b-e164-49c9-b7a1-90f01e7b35ba/56d39852-9673-4f49-b409-22d3df676467/ar8xcRF
    Replit-Helium-Checkpoint-Created: true

[33mcommit 509def816ba351a34dcc4f780a232e35484260fa[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Wed May 27 04:02:28 2026 +0000

    Update subtitle fetching to handle YouTube rate limiting
    
    Replaces the Google Translate API with direct YouTube timedtext fetching, including retry logic for rate limiting issues.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 923ea483-1544-4e17-8c14-544b28cae92a
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/2WSbJ5A
    Replit-Helium-Checkpoint-Created: true

[33mcommit 6812f6c962be56eff373056a053ec308093103bd[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Wed May 27 03:42:37 2026 +0000

    Add translation fallback for YouTube transcripts to display in requested language
    
    Implement a Google Translate fallback in the /api/srt endpoint for cases where the requested language transcript is not directly available, enhancing transcript availability and user experience.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 7d06e290-d62d-4802-bb31-d4aa8d4acf60
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/2WSbJ5A
    Replit-Helium-Checkpoint-Created: true

[33mcommit 3df65980de75c7f99c7a493eae2b1fc20f0c4f00[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Wed May 27 03:08:54 2026 +0000

    Add ability to fetch YouTube transcripts and save job history
    
    Integrates YouTube transcript fetching via `/api/srt`, adds a new "Jobs" tab for saving and managing transcription sessions using `localStorage`, and reroutes Text-to-Speech requests through `/api/tts`.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 2a7cadde-fa1c-4261-bfac-c740e5100871
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/qhtGro1
    Replit-Helium-Checkpoint-Created: true

[33mcommit 2743e60c8236592ee4992f1f458e70ed2379a8ff[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Wed May 27 02:24:07 2026 +0000

    Add ability to play multiple synchronized audio and video tracks
    
    Implement support for multiple SRT subtitle tracks with per-column visibility and playback ordering, fix synchronization issues between video and TTS playback, restore per-word highlighting, and introduce a Google TTS fallback for unsupported languages.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 7d66aa7d-69fd-47d4-9d09-b71ed61b2b0e
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/Uid79y7
    Replit-Helium-Checkpoint-Created: true

[33mcommit eb42dc1422b8a6e5289f70417723cdd649b3923f[m
Author: mostuf25561 <53576944-mostuf25561@users.noreply.replit.com>
Date:   Wed May 27 01:31:58 2026 +0000

    Improve video playback and text-to-speech functionality
    
    Refactor YouTube player component, add TTS speed controls, implement event logging, and conditionally render video iframes to fix simultaneous playback and TTS issues.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 54471d9a-886c-41d6-adb3-6ba29fef4360
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 54838f9a-cb0b-4ea5-8a3b-c2d63d6f4921
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/9cebe03f-1cc8-4d78-900d-4e7c50b18859/54471d9a-886c-41d6-adb3-6ba29fef4360/BEQYGnF
    Replit-Helium-Checkpoint-Created: true

[33mcommit a31ad6aa433ed99899df32bb1e5ae20ef6a8440e[m
Author: mostuf25561 <53576944-mostuf25561@users.noreply.replit.com>
Date:   Wed May 27 01:18:18 2026 +0000

    Improve YouTube transcript parsing and URL handling
    
    Fixes a bug in the timestamp parser to correctly handle single-digit minutes and makes the YouTube URL an editable field that automatically extracts the video ID, syncing with search parameters.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 54471d9a-886c-41d6-adb3-6ba29fef4360
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 03617d43-e59b-4ff3-8d7d-9dc23ede8e48
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/9cebe03f-1cc8-4d78-900d-4e7c50b18859/54471d9a-886c-41d6-adb3-6ba29fef4360/PTjAL6s
    Replit-Helium-Checkpoint-Created: true

[33mcommit 78fdd7a7876d3020d5a134e9138262164ef0e7df[m
Author: mostuf25561 <116721049+mostuf25561@users.noreply.github.com>
Date:   Wed May 27 01:07:55 2026 +0000

    bypass git push from oauth app with no workflow scope permission

[33mcommit d74b326f057f85f92855de6bcda41e84fde8b07f[m
Author: mostuf25561 <53576944-mostuf25561@users.noreply.replit.com>
Date:   Wed May 27 00:46:00 2026 +0000

    Add robust testing for debug mode and improve UI popups
    
    Introduces comprehensive E2E tests for debug mode functionality, including setup for local, Docker, and GitHub Actions environments. Refactors AI conversation UI to use singular, overlay popups for settings, logs, and health panels, improving user experience and clarity. Adds a prompt chip bar to the AI conversation view for easier prompt management.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 54471d9a-886c-41d6-adb3-6ba29fef4360
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: d991a2c3-8c4f-4874-8287-debf0b810823
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/9cebe03f-1cc8-4d78-900d-4e7c50b18859/54471d9a-886c-41d6-adb3-6ba29fef4360/Y24ByIN
    Replit-Helium-Checkpoint-Created: true

[33mcommit bd723bc10bdb14a8add3a7f0f81e0c8784c55193[m
Author: mostuf25561 <53576944-mostuf25561@users.noreply.replit.com>
Date:   Wed May 27 00:09:43 2026 +0000

    Add debug information to the AI conversation interface
    
    Integrate a new debug mode for the AI conversation component, displaying the key suffix used for assistant messages and controlling visibility via URL hash.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 54471d9a-886c-41d6-adb3-6ba29fef4360
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 3a729d15-c543-401f-a75c-5eb48d38305b
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/9cebe03f-1cc8-4d78-900d-4e7c50b18859/54471d9a-886c-41d6-adb3-6ba29fef4360/jqAt2SJ
    Replit-Helium-Checkpoint-Created: true

[33mcommit e3937ff0bc4520f8fafe506eb9a0612eba4d7f36[m
Author: mostuf25561 <53576944-mostuf25561@users.noreply.replit.com>
Date:   Tue May 26 23:27:03 2026 +0000

    Add a debug mode to show the AI model and key used for responses
    
    Implement a debug mode that displays the last four characters of the AI model's API key used for each response, along with a toggle button in the UI. This change also modifies the health check model to use a free tier and ensures the server logs the key suffix for debugging.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 54471d9a-886c-41d6-adb3-6ba29fef4360
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: e5ed1bb6-73a6-4d5e-8cae-3f937a9eb81b
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/9cebe03f-1cc8-4d78-900d-4e7c50b18859/54471d9a-886c-41d6-adb3-6ba29fef4360/jqAt2SJ
    Replit-Helium-Checkpoint-Created: true

[33mcommit 4e1d1a825f1d95d759f4c511afcb0e9b9732fc9b[m
Author: mostuf25561 <53576944-mostuf25561@users.noreply.replit.com>
Date:   Tue May 26 23:16:46 2026 +0000

    Allow pinging AI key with unsaved input before saving
    
    Update the AI health ping function to use the currently typed API key from the input field, or fall back to the saved key, allowing users to test keys before saving them.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 54471d9a-886c-41d6-adb3-6ba29fef4360
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: ee8f8455-75eb-445a-b603-58c89a6d13f7
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/9cebe03f-1cc8-4d78-900d-4e7c50b18859/54471d9a-886c-41d6-adb3-6ba29fef4360/4hYt7ft
    Replit-Helium-Checkpoint-Created: true

[33mcommit 354e616da18e1b40ed24dc4fe4ef631c6af625e4[m
Author: mostuf25561 <53576944-mostuf25561@users.noreply.replit.com>
Date:   Tue May 26 23:07:14 2026 +0000

    Prevent microphone permission loop and inform users when access is denied
    
    Implement microphone permission error handling to detect 'not-allowed' errors, set a 'micDenied' state, and display a banner to the user. Prevent the start listening function and auto-restart effect from running when the microphone is denied.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 54471d9a-886c-41d6-adb3-6ba29fef4360
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 4ce66f96-dea9-4121-a496-f2b5026b5602
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/9cebe03f-1cc8-4d78-900d-4e7c50b18859/54471d9a-886c-41d6-adb3-6ba29fef4360/4hYt7ft
    Replit-Helium-Checkpoint-Created: true

[33mcommit 19faebece9a77ccca2cce109bd90fcea852864be[m
Author: mostuf25561 <53576944-mostuf25561@users.noreply.replit.com>
Date:   Tue May 26 02:36:13 2026 +0000

    Improve mobile responsiveness and add TTS toggle while fixing STT loop
    
    Update the AI conversation interface to be responsive on mobile, add a toggle for text-to-speech in the top bar, and resolve an infinite looping issue with speech-to-text on mobile devices.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 54471d9a-886c-41d6-adb3-6ba29fef4360
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: c044306f-d44e-4ab6-acc4-ff942f8adf4d
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/9cebe03f-1cc8-4d78-900d-4e7c50b18859/54471d9a-886c-41d6-adb3-6ba29fef4360/NiF0Cag
    Replit-Helium-Checkpoint-Created: true

[33mcommit a8305d955f0445546e78511624db721491cd215b[m
Author: mostuf25561 <53576944-mostuf25561@users.noreply.replit.com>
Date:   Tue May 26 02:29:25 2026 +0000

    Update server dependencies and development script
    
    Updates server dependencies (cors, express) and the dev script in package.json.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 54471d9a-886c-41d6-adb3-6ba29fef4360
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 4da329cc-0bec-462f-8861-82d1373422fb
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/9cebe03f-1cc8-4d78-900d-4e7c50b18859/54471d9a-886c-41d6-adb3-6ba29fef4360/XG0L7DD
    Replit-Helium-Checkpoint-Created: true

[33mcommit 40205108f9f570e9d81c494943abee581e028617[m
Author: mostuf25563 <40647342-mostuf25563@users.noreply.replit.com>
Date:   Tue May 26 01:19:06 2026 +0000

    Enhance conversation features with voice selection, translation, and playback controls
    
    Introduce voice selection per language, enable translation of AI responses with caching, add playback highlighting and scrolling, and stop STT during playback.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 304367ca-2b0c-4e0d-b11d-190d052bd167
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 438da212-ef63-411a-a3c6-55e07c636202
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/3ca40dcc-cb12-44a4-a5f0-cd0e6669bf93/304367ca-2b0c-4e0d-b11d-190d052bd167/6WQYl2d
    Replit-Helium-Checkpoint-Created: true

[33mcommit 721844d281d3748d164881c373a892ad7cbf877d[m
Author: mostuf25563 <40647342-mostuf25563@users.noreply.replit.com>
Date:   Tue May 26 00:51:34 2026 +0000

    Add language instructions to AI prompts and improve story playback functionality
    
    Update system prompts to include explicit language instructions for AI responses and rewrite the story playback function to use the browser's native speech synthesis queue for more reliable TTS.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 304367ca-2b0c-4e0d-b11d-190d052bd167
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 98437c67-f8b0-4731-baf9-2063b1776424
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/3ca40dcc-cb12-44a4-a5f0-cd0e6669bf93/304367ca-2b0c-4e0d-b11d-190d052bd167/rUtskos
    Replit-Helium-Checkpoint-Created: true

[33mcommit 3c1214ea1fe080d39dd0932342cc217c8c2e1f44[m
Author: mostuf25563 <40647342-mostuf25563@users.noreply.replit.com>
Date:   Tue May 26 00:41:13 2026 +0000

    Add dynamic language selection and playback controls to the AI conversation
    
    This commit introduces dynamic language selection for speech-to-text and text-to-speech, along with playback controls (play, pause, stop) and per-language TTS speed adjustment. The `ChatMessage` interface in `openRouterService.ts` has been updated to include `lang_code`. New CSS classes for styling the language bar, playback buttons, and TTS rate sliders have been added to `aiConversation.css`. The `freeSpeak` function in `freeSpeak.tsx` now accepts and applies a speech rate.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 304367ca-2b0c-4e0d-b11d-190d052bd167
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 9f161c46-ad06-4d7c-8d88-eab734751fcb
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/3ca40dcc-cb12-44a4-a5f0-cd0e6669bf93/304367ca-2b0c-4e0d-b11d-190d052bd167/rUtskos
    Replit-Helium-Checkpoint-Created: true

[33mcommit abe81b2988435e0ca0f71cfe926d4b5748193a00[m
Author: mostuf25563 <40647342-mostuf25563@users.noreply.replit.com>
Date:   Tue May 26 00:22:13 2026 +0000

    Add vocabulary level control for language learners
    
    Introduce a vocabulary level setting that allows users to control the complexity and repetition of words used by the AI, along with a new preset for language learning.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 304367ca-2b0c-4e0d-b11d-190d052bd167
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: adc56492-8225-48c8-a9e1-fac3d00f7057
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/3ca40dcc-cb12-44a4-a5f0-cd0e6669bf93/304367ca-2b0c-4e0d-b11d-190d052bd167/vH5PkTL
    Replit-Helium-Checkpoint-Created: true

[33mcommit 46c9789fcc2dad8a7ec9736cc455d94b1450db64[m
Author: mostuf25563 <40647342-mostuf25563@users.noreply.replit.com>
Date:   Tue May 26 00:14:13 2026 +0000

    Add language selection and message deletion to chat interface
    
    Add separate input/output language selectors and implement a 3-second hold-to-delete feature for messages in the ZeroChrome chat interface.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 304367ca-2b0c-4e0d-b11d-190d052bd167
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: bab147fd-aefe-43ff-bf56-0dd75399793e
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/3ca40dcc-cb12-44a4-a5f0-cd0e6669bf93/304367ca-2b0c-4e0d-b11d-190d052bd167/4Pnrqrz
    Replit-Helium-Checkpoint-Created: true

[33mcommit 6793a7330742ba7f53fb222aaf6e6b28ff98a428[m
Author: mostuf25563 <40647342-mostuf25563@users.noreply.replit.com>
Date:   Tue May 26 00:04:50 2026 +0000

    Add two distinct interface variations for the AI chat component
    
    Introduce two new AI chat interface variations: 'LightConsumer' and 'ZeroChrome', to explore contrasting design paradigms.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 304367ca-2b0c-4e0d-b11d-190d052bd167
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: c7e1e113-8d02-4127-a758-614b7d3779c6
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/3ca40dcc-cb12-44a4-a5f0-cd0e6669bf93/304367ca-2b0c-4e0d-b11d-190d052bd167/4Pnrqrz
    Replit-Helium-Checkpoint-Created: true

[33mcommit f9bd9ff5b5f9ffc0f23e1178e1577882c5dc8690[m
Author: mostuf25563 <40647342-mostuf25563@users.noreply.replit.com>
Date:   Tue May 26 00:01:40 2026 +0000

    Create three component variations optimizing for different usability dimensions
    
    Adds three new React component files (AccessibilityFirst, AffordanceFirst, HierarchyFirst) and updates the mockup-components.ts to register them, enabling distinct usability-focused variations of an AI chat interface.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 304367ca-2b0c-4e0d-b11d-190d052bd167
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 59788bfd-0a8a-44d0-bf55-4ac6155aa183
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/3ca40dcc-cb12-44a4-a5f0-cd0e6669bf93/304367ca-2b0c-4e0d-b11d-190d052bd167/4Pnrqrz
    Replit-Helium-Checkpoint-Created: true

[33mcommit 4ec1dad129913399d32ef69dba81fb9b3ee1f629[m
Author: mostuf25563 <40647342-mostuf25563@users.noreply.replit.com>
Date:   Mon May 25 23:56:49 2026 +0000

    Update the AI chat interface with a new user-friendly design
    
    Introduce a redesigned AI chat interface with improved layout and component organization.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 304367ca-2b0c-4e0d-b11d-190d052bd167
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: fb111293-8a9a-400f-83f1-cd1e7c4daf22
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/3ca40dcc-cb12-44a4-a5f0-cd0e6669bf93/304367ca-2b0c-4e0d-b11d-190d052bd167/4Pnrqrz
    Replit-Helium-Checkpoint-Created: true

[33mcommit 564759d61f5822b7a31df0f09dfcf6e168413491[m
Author: mostuf25563 <40647342-mostuf25563@users.noreply.replit.com>
Date:   Mon May 25 23:44:19 2026 +0000

    Add API key warning, mode toggle, and improve logs display
    
    Adds an API key warning banner, replaces mode buttons with a toggle, renames the STT button to "Logs", extends maxWords to 50, and updates TTS logs to include language information.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 304367ca-2b0c-4e0d-b11d-190d052bd167
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 5e3ce886-810e-4326-ac3e-b1acf934852b
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/3ca40dcc-cb12-44a4-a5f0-cd0e6669bf93/304367ca-2b0c-4e0d-b11d-190d052bd167/ipKpHzC
    Replit-Helium-Checkpoint-Created: true

[33mcommit f89187377b7c64d06d82112afd6f39d948e48c20[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Sun May 24 02:55:20 2026 +0000

    Improve service status detection by checking port usage
    
    Update `manage.sh` to detect running services based on port usage when PID files are absent, providing more accurate native status reporting.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 86dd2927-31f1-4ec4-a4fe-5485095f5fb5
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/0FYDFpF
    Replit-Helium-Checkpoint-Created: true

[33mcommit 4eb15ddcb7ef0a1003c67b98e0cf66192cc1d1c2[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Sun May 24 02:44:43 2026 +0000

    Add script to restart server if port is already in use
    
    Move port conflict resolution and server restart logic from server/index.js to a new executable script, server/start.sh.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 27b4b784-56bf-4ea3-aebe-687bcbe93702
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/0FYDFpF
    Replit-Helium-Checkpoint-Created: true

[33mcommit 2f62d4daa051675007dedd6d3c5c55e7c8264db8[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Sun May 24 02:41:41 2026 +0000

    Add self-healing process to automatically restart server if port is in use
    
    Introduce a port-squatter cleanup mechanism in `server/index.js` to automatically detect and terminate processes occupying the server's port, enabling graceful restarts and improving server stability.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: ce08b40f-2964-4722-9ed5-6fcd96f4ce07
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/0FYDFpF
    Replit-Helium-Checkpoint-Created: true

[33mcommit a68d7d17e7ab647ec2746fbb4268a2e84cd07567[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Sun May 24 02:39:35 2026 +0000

    Saved progress at the end of the loop
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: eaebea28-9eae-444b-bbd2-da8567500dfd
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/0FYDFpF
    Replit-Helium-Checkpoint-Created: true

[33mcommit 8b41fd6b62bcb7e27b17686df120235f5c335ffb[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Sun May 24 02:29:59 2026 +0000

    Saved progress at the end of the loop
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 41822ece-8c95-4053-be63-712cb58c67f5
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/OL6msvs
    Replit-Helium-Checkpoint-Created: true

[33mcommit f49771b3ca70df48acea13521ed0b5e343f75879[m
Author: mostuf25563 <125549956+mostuf25563@users.noreply.github.com>
Date:   Mon May 11 08:58:52 2026 +0300

    Redesign Prompt UI with Accordion

[33mcommit b23dbe475a62c1a08172fd52d57df5221393d593[m
Author: mostuf25563 <125549956+mostuf25563@users.noreply.github.com>
Date:   Mon May 11 08:42:58 2026 +0300

    Updated index.js

[33mcommit f5afbe05029eafb333a77772e94b0c9a47041d6c[m
Author: mostuf25563 <125549956+mostuf25563@users.noreply.github.com>
Date:   Mon May 11 07:02:21 2026 +0300

    Update AI chat with model, regenerate, keywords

[33mcommit 4f27282c8fb28314c5dcda19af7af5ed340f6208[m
Author: ofer shaham <121024880+ofer-shaham@users.noreply.github.com>
Date:   Mon May 11 06:40:00 2026 +0300

    Migrate API to Netlify Functions

[33mcommit ba237abdde34a07a5f470bb4758653ee69d71c79[m
Author: mostuf25564 <135760690+mostuf25564@users.noreply.github.com>
Date:   Mon May 11 03:26:46 2026 +0000

    update prompt

[33mcommit 06e756b45ade6d7cc7d7192f8bbc24390ee2f9e3[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Mon May 11 03:22:35 2026 +0000

    Clarify event sources and add text-to-speech logging
    
    Add a source field to log entries to distinguish between STT, TTS, and app events, and update the UI to display these sources as badges. Also, implement logging for TTS events to provide a complete view of the voice interaction pipeline.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 46e9f6f6-8d1d-4773-9fd4-8b6a07016f73
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/MAzMkRr
    Replit-Helium-Checkpoint-Created: true

[33mcommit dad39c399a8e008133ccdd28e741ec1699a14d90[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Mon May 11 03:15:54 2026 +0000

    Update STT button to reflect real-time status and add new styles
    
    Add a state variable `sttStatus` to track the Speech-to-Text status ("idle", "listening", "error") and update the STT debug button's appearance and icon accordingly. Implement new CSS classes and animations for the "listening" (pulsing green) and "error" (red) states, as well as for when the debug panel is open.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 3b1ccb68-2e10-446a-b242-f0d1b973f2e4
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/zzs36IN
    Replit-Helium-Checkpoint-Created: true

[33mcommit fda6a7ad69632476585bcb311ca0be511615b057[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Mon May 11 03:13:22 2026 +0000

    Add a debug panel to view speech recognition events
    
    Integrates a Speech-to-Text debug panel into the UI, capturing and displaying raw SpeechRecognition events, including audio start/end, speech start/end, results, errors, and application-level listening calls. Includes a "Copy to clipboard" functionality for logs and styling for the new panel.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 4f72151d-e6ae-4c05-80f3-86364856106c
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/TeDIooG
    Replit-Helium-Checkpoint-Created: true

[33mcommit 0e1fda42097cc1551bafe626e1ab191b9d7887b2[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Mon May 11 03:08:56 2026 +0000

    Ensure the microphone automatically restarts in auto mode when not busy
    
    Update the microphone auto-restart logic in `AiConversation.tsx` to reliably restart the mic in auto mode when `listening`, `isLoading`, or `isSpeaking` states change, and add a guard for the `transcript` to prevent race conditions with sending messages.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: a3407ad2-d0a5-4a5a-b285-671cfc770bb2
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/TB4LZvR
    Replit-Helium-Checkpoint-Created: true

[33mcommit c25b3c79a7ab9849f6aa71330f121b41aecbb5c6[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Mon May 11 03:05:10 2026 +0000

    Improve AI conversation responsiveness and reliability
    
    Implement retry logic for AI requests, fix UI status contradictions, ensure correct TTS language selection, and hide the footer on the AI conversation screen.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 4d857a70-2589-4747-8a3b-d6fec5eb86b5
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/TB4LZvR
    Replit-Helium-Checkpoint-Created: true

[33mcommit d92bd7ad09a0f5ce5bf5bbc247d7277893d6b247[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Mon May 11 02:47:39 2026 +0000

    Show server age on the health endpoint and update display
    
    Add server start time and formatted age to the /api/health endpoint response and update the frontend health panel to display the server's age.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 4d9cc5ba-dfab-4a80-bfaf-f3b79ee1c164
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/gBqeO4F
    Replit-Helium-Checkpoint-Created: true

[33mcommit 9abc608ebd149cc7503e0144b8c8b2d5164308ff[m
Author: mostuf25564 <40134840-mostuf25564@users.noreply.replit.com>
Date:   Mon May 11 02:25:40 2026 +0000

    Add server health indicators and free model display
    
    Adds new API endpoints for server health checks and verifying the AI key, along with a feature to display free models from OpenRouter. Updates UI components and CSS for these features and improves footer responsiveness on mobile.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: b7acd8f3-6f2e-4544-a61e-893bce160fd2
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: 142b835d-2099-4a1c-ab1d-9a457cce365d
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/8d7d61c7-975a-45db-8c3e-c66f78e5d12b/b7acd8f3-6f2e-4544-a61e-893bce160fd2/96BRoTo
    Replit-Helium-Checkpoint-Created: true

[33mcommit 8c2198fbadf0a85b316908702c0c51c6db1cf2f7[m[33m ([m[1;34mgrafted[m[33m)[m
Author: mostuf25563 <40647342-mostuf25563@users.noreply.replit.com>
Date:   Mon May 11 00:28:20 2026 +0000

    Add free models, word limits, and manual/auto voice modes
    
    Update server to accept maxTokens, add UI controls for word limit and voice mode, and modify model selection to include free-only options.
    
    Replit-Commit-Author: Agent
    Replit-Commit-Session-Id: 1f9e37da-7de8-4fc8-81ef-c97a4a9d6afe
    Replit-Commit-Checkpoint-Type: full_checkpoint
    Replit-Commit-Event-Id: a010cd0a-3ef2-4c27-864c-8fa7c674eb40
    Replit-Commit-Screenshot-Url: https://storage.googleapis.com/screenshot-production-us-central1/3c1c914c-29d5-4477-b61d-b883f9f381ce/1f9e37da-7de8-4fc8-81ef-c97a4a9d6afe/lKyQgGi
    Replit-Helium-Checkpoint-Created: true
