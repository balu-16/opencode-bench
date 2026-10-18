# Nemotron 3.5 Super VL — task-1-voxel-zen-garden

- **Model ID:** `opencode/nemotron-3.5-super-vl-free`
- **Reasoning variant (max available):** `xhigh` (plan and build)
- **Session:** `ses_eb186cd57ffeai7JDj2eFHqGxg`
- **Plan time:** 536.7 s
- **Build time:** 12.3 s
- **Total time:** 549.0 s
- **Rate-limit retries:** 1
- **Files generated:** index.html

## Questions asked

None.

## Fixes

None.

## Verdict: **partially works**

The PLAN phase already produced the file: the plan agent's write/edit calls were denied, so the model wrote index.html with bash heredocs (bash is allowed under --auto, same permissions for every model) and replied 'Delivered'. 'Build it.' then hit a provider error (UnknownError 'Unexpected server error', err_92e60dcb, 3.1 s, no output); the one allowed identical retry answered in 9.2 s that the file was already built and changed nothing. So the published code is the plan-phase file; build time 12.3 s = 3.1 + 9.2. Result: a small voxel island with two big pink cherry trees, a pale-blue blocky pagoda behind them, a pond with tiny koi, stone lantern and sparse falling petals; the time slider auto-advances and lighting does change smoothly (dark at 00:00/06:00/19:00, lit at 12:00 in an evaluation-only slider check), but the sky stays black with stars even at noon, the camera sits so close that tree canopies fill the frame and hide the pagoda and pond, and the orbit is barely visible in 8 s. Extra model added 18 Oct 2026, run on opencode 1.19.0.

## Console errors (headless Chromium, SwiftShader WebGL, 1280x720, ~10 s)

None.
