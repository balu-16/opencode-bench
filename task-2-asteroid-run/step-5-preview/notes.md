# Step 5 Preview — task-2-asteroid-run

- **Model ID:** `opencode/step-5-preview-free`
- **Reasoning variant (max available):** `high` (plan and build)
- **Session:** `ses_ed5825391ffej1dcDfGBvR24Nm`
- **Plan time:** 61.1 s
- **Build time:** 2500.1 s — TIMED OUT at 40 min
- **Total time:** 2561.2 s
- **Rate-limit retries:** 0
- **Files generated:** asteroids.html, diag.js, diag2.js, diag3.js, diag4.js, test.js, test2.js, test3.js, test4.js, test_local.html, three.module.js

## Questions asked

None.

## Fixes

None.

## Verdict: **broken**

No index.html was delivered. Build ran out the 40-min phase timeout (killed at 2400 s, still self-testing) after an earlier attempt was cut off at 100 s by a sandbox reset and the identical 'Build it.' was re-sent in the same session. One provider [504] upstream idle timeout early in the build, which opencode retried by itself. It wrote the game to asteroids.html (imports a downloaded ./three.module.js) plus diag*/test* scripts, and at one point cd'd into a non-existent /opt/code/catalog-service. Opening asteroids.html (evaluation-only, unpublished) shows an 'ASTEROIDS SURVIVOR / Twitch Arena Protocol' screen with a fake Twitch chat that waits behind a LAUNCH button: no attract mode, score 0 after 40 s at ~9 fps. All files it made are kept in this folder as-is.

## Console errors (headless Chromium, SwiftShader WebGL, 1280x720, ~10 s)

- `no index.html in work dir`
