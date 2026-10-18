# Beam — task-2-asteroid-run

- **Model ID:** `opencode/beam-free`
- **Reasoning variant (max available):** `max` (plan and build)
- **Session:** `ses_eb15e72e8ffed79s1mUF6rixYf`
- **Plan time:** 19.6 s
- **Build time:** 865.8 s
- **Total time:** 885.4 s
- **Rate-limit retries:** 0
- **Files generated:** index.html

## Questions asked

None.

## Fixes

None.

## Verdict: **works**

Complete top-down/chase 3D shooter: cyan ship, grey icosahedron asteroids that split, yellow bullet streams, explosion particles, HUD (score/lives/high score/mode), Web Audio SFX, game over + restart (R). Loads straight into an AI-played ATTRACT MODE ('Press any key to play'); a key switches to MANUAL, and 3 s without a new keydown switches to AUTOPILOT (so even held keys hand control back to the AI after 3 s). Evaluation-only score probe (90 s idle): autopilot score 520 at 10 s -> 6440 at 90 s with all 3 lives intact, ~24-59 fps under SwiftShader. During the build the model self-tested with headless Chromium and its own helper files (test.html, local three.module.js copy, logs), then deleted them; only index.html (Three.js 0.160 via jsDelivr importmap) remained. Extra model added 18 Oct 2026, run on opencode 1.19.0.

## Console errors (headless Chromium, SwiftShader WebGL, 1280x720, ~10 s)

None.
