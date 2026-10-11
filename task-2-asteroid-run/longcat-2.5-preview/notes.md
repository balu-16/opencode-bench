# LongCat 2.5 Preview — task-2-asteroid-run

- **Model ID:** `opencode/longcat-2.5-preview-free`
- **Reasoning variant (max available):** `high` (plan and build)
- **Session:** `ses_ed5e59e82ffeuGKCJVwkvNbUBz`
- **Plan time:** 129.4 s (includes answering the model's question)
- **Build time:** 845.1 s
- **Total time:** 974.5 s
- **Rate-limit retries:** 0
- **Files generated:** index.html

## Questions asked

1. Model asked (excerpt of its reply):

```
with thrust, 3 lives with invulnerability blink on respawn.
3. **Asteroids** — icosahedrons with hashed vertex displacement (rocky look, flat shading). 3 sizes; shot splits L→M→S→destroyed. 20/50/100 pts.
4. **Bullets** — object pool, 150 ms fire rate, additive glow material.
5. **Particles** — pooled `THREE.Points` systems: orange/red explosion bursts + engine exhaust trails.
6. **Audio (Web Audio, no files)** — laser = square-wave pitch sweep; explosions = noise burst through lowpass; engine hum = thrust-linked sawtooth; SFX for score/wave/game-over; subtle procedural bass-loop music. Context auto-resumes on first gesture (browser autoplay policy handled gracefully).
7. **Autopilot AI** — targets nearest asteroid, steers heading toward it, fires when aligned within ~8°, steers back to center near boundary.
8. **HUD** — DOM overlay: score, lives (icons), wave number, autopilot badge, center messages (title / wave / game over), controls hint.
9. **Waves** — wave N spawns 3+N large asteroids; clearing a wave advances with sound + banner.

**Controls:** ←/→ or A/D rotate · ↑/W thrust · Space fire.

**Verification:** after writing, I'll do a syntax sanity check (e.g., node-based parse of the extracted JS or a headless check if available).

Two quick decisions before I build:
1. **Visual style:** neon-retro (classic arcade look, works great with primitives) — OK, or do you prefer realistic/muted?
2. **Camera:** chase cam behind the ship (more 3D feel) — OK, or fixed angled view?
```

   Answer given (same session, plan agent): "No preference. Use your own judgment."

## Fixes

None.

## Verdict: **partially works**

Boots straight into an autopilot attract demo (title 'ASTEROID BELT / PRESS ANY KEY', chase cam behind a primitive-built ship, lit low-poly rocky asteroids, starfield + nebula) and the published capture shows the AI at 20 points. But the autopilot does not really play: in an evaluation-only 90 s idle probe (same headless setup, unpublished) the score stayed 0, the ship drifted to the arena edge and sat under a '!! TURN BACK !!' warning from ~30 s to 90 s. Player input works (thrust/turn/fire, 'AUTOPILOT' badge returns after 3 s idle). Minor: the controls legend reads '← → RUST' (typo for rotate). Build was interrupted once by a sandbox reset at 507 s and resumed in the same session with the identical 'Build it.' (build time = 507 + 338.1 s). The only console line was Chromium's 404 for /favicon.ico (not counted).

## Console errors (headless Chromium, SwiftShader WebGL, 1280x720, ~10 s)

None.
