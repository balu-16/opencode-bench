# LongCat 2.5 Preview — task-1-voxel-zen-garden

- **Model ID:** `opencode/longcat-2.5-preview-free`
- **Reasoning variant (max available):** `high` (plan and build)
- **Session:** `ses_ed6cf8048ffedlPbsko165FON5`
- **Plan time:** 39.9 s
- **Build time:** 842.6 s
- **Total time:** 882.5 s
- **Rate-limit retries:** 0
- **Files generated:** index.html

## Questions asked

None.

## Fixes

None.

## Verdict: **works**

Full scene renders on load: 5-tier red/black pagoda with gold finial, 4 voxel cherry trees, stone-rimmed koi pond with arched bridge and koi, stone lantern, raked-sand patch, falling petals, time slider + clock panel (starts 10:00, auto-advances), slow auto-orbit. Zero console errors. Model self-tested with headless Chromium screenshots during build (day/night/pond close-ups). In our 8 s capture the time only advances ~10:04→10:09, so the night lighting is not shown in the clip. Harness note: this run (attempt 2) used the isolated /tmp work dir but predates the mount-namespace jail; its tool calls were audited and never touched anything outside its own dir/scratch. Two earlier LongCat attempts were voided for harness bugs (see README).

## Console errors (headless Chromium, SwiftShader WebGL, 1280x720, ~10 s)

None.
