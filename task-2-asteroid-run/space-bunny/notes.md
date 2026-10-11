# Space Bunny — task-2-asteroid-run

- **Model ID:** `opencode/space-bunny-free`
- **Reasoning variant (max available):** `max` (plan and build)
- **Session:** `ses_ed5d161ddffenpXlpga4huqB45`
- **Plan time:** 69.4 s (includes answering the model's question)
- **Build time:** 1540.0 s
- **Total time:** 1609.4 s
- **Rate-limit retries:** 0
- **Files generated:** index.html

## Questions asked

1. Model asked (excerpt of its reply):

```
t scoring on predicted future positions, arrive-style steering, threat-avoidance impulse, target selection by score/urgency, lead-intercept aim solve, fire only when aligned and no imminent unavoidable impact, plus slight jitter/wander so it doesn't look robotic. Same code path drives attract mode and the idle takeover.

## 7. HUD
DOM overlay: score, `HI` score, wave, lives as SVG ship pips, state banner, autopilot badge, mute button, and a controls legend that fades out after first play.

## 8. Verification
- `node --check` on the extracted script, plus a headless smoke test (Playwright/Puppeteer if available in the sandbox) loading the file over `http://` to confirm: no console errors, AI is playing at t=0 (score changes without input), asteroids spawn and split, and the idle takeover flips the badge at ~3s.

## Questions before I build
1. **Control feel** — Asteroids-style (`W/↑` thrust, `A/D` or `←/→` turn, `Space` fire, ship rotates to heading) or planar/straight-up ship that just slides left/right/up/down? I default to **Asteroids-style**.
2. **Look** — neon vector wireframe (Tron, glowy, low-poly) or lit rocky asteroids with lighting? I default to **neon wireframe + glowing edges**.
3. **Extras** — include wave/difficulty ramp, high-score persistence, and an invulnerability shield (my default), or keep it strictly to the listed features?
4. **Mobile/touch** — include drag-to-steer, or desktop-keyboard only? I default to **desktop + pointer-drag fallback, no touch UI**.
```

   Answer given (same session, plan agent): "No preference. Use your own judgment."

## Fixes

None.

## Verdict: **works**

'VOID RUNNER': neon-wireframe asteroids over a dense starfield, boots into an AI demo. In the 8 s recording the score is still 0 and the ship is tiny, but an evaluation-only 30 s probe (same headless setup, not published) showed the autopilot at 1,710 points by 15 s and 4,960 / wave 3 by 30 s, with shockwave explosions and colour-coded split asteroids; pressing keys shows 'YOU HAVE CONTROL' and the AI badge returns after 3 s without new key events (a held key does not count as activity). The model spent most of its 25.7-min build self-testing in headless Chromium and reports fixing five bugs it found (including a boot crash).

## Console errors (headless Chromium, SwiftShader WebGL, 1280x720, ~10 s)

None.
