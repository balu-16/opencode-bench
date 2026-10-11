# OpenCode free-model benchmark

Five free models served through [OpenCode](https://opencode.ai) (Zen, `opencode/*-free`), five coding tasks, one strict protocol. Every output is published as-is — working, half-working or broken.

## Models

| Model | OpenCode model ID | Reasoning variant used (max available) |
|---|---|---|
| LongCat 2.5 Preview | `opencode/longcat-2.5-preview-free` | `high` |
| Space Bunny | `opencode/space-bunny-free` | `max` |
| MiMo V2.6 Flash | `opencode/mimo-v2.6-flash-free` | `default` (model exposes no variants) |
| Step 5 Preview | `opencode/step-5-preview-free` | `high` |
| Muse Spark 1.3 | `opencode/muse-spark-1.3-contributor-free` | `xhigh` |

Variants come from `opencode models --verbose` (OpenCode 1.19.0). No API key was needed for any of these free models.

## Method

- **Same prompt, byte for byte.** Each task folder has `prompt.md`: a shared prefix + one space + the task text. That exact file content is the first message of every session.
- **One fresh session per model per task**, in a fresh empty directory.
- **Two phases, same session:**
  1. `opencode run --agent plan -m <id> --variant <max> --format json --auto "<prompt>"` (the model plans; plan agent cannot edit files)
  2. `opencode run -s <session> --agent build -m <id> --variant <max> --format json --auto "Build it."`
- **No other messages**, except:
  - if the plan ends with explicit questions, one neutral reply in the same session (plan agent): **"No preference. Use your own judgment."** (identical for every model, logged in `notes.md`). A plain "shall I proceed?" is not treated as a question — "Build it." answers it.
  - if the page crashes on load, exactly one message: `The page crashes on load with this error: <error>. Fix it.` (logged).
- **Never** edited model code, re-rolled a model, or cherry-picked. A rate-limit retry re-sends the identical request and is logged.
- **Max reasoning variant** for both phases. Models run strictly one after another, ~60 s apart. Each phase is wall-clock timed (plan time includes answering a question if one was asked). A phase is killed at 40 min and recorded as a timeout.
- `--auto` auto-approves tool permissions that aren't explicitly denied, so non-interactive runs never stall; the plan agent still cannot edit.
- **Isolation:** each opencode process runs in a private mount namespace (`sudo unshare -m`, see `harness/jail.sh`) where `/workspace` and `/tmp` are empty; only the opencode install and the model's own work dir (`/tmp/ocb/<task>/<model>`) are visible. Global config sets `permission.external_directory = deny`. Models can use the network (CDN checks) and a system Chromium to self-test, same for all.
- **Evaluation:** the generated `index.html` is served over local HTTP and opened in headless Chromium 154 (Playwright, SwiftShader software WebGL, 1280x720). We take a screenshot ~10 s after load and an 8 s video (last 8 s of the ~10 s session), and log console errors, page errors, failed requests and HTTP errors. The verdict (works / partially works / broken) is judged from the screenshot, video and console. Software rendering is slow, so frame rates in the videos are lower than on a GPU.

## Layout

```
task-N-name/
  prompt.md                 exact prompt sent
  grid.png  grid.mp4        all 5 models side by side, labeled
  <model>/
    index.html (+ any other files the model created)
    screenshot.png  recording.mp4  transcript.json (opencode export)  notes.md
results.csv                 one row per task x model
harness/                    runner scripts used
```

## Results

See `results.csv` and the per-task table below (updated as tasks complete).

<!-- RESULTS_TABLE -->

| Task | Model | Variant | Plan (s) | Build (s) | Total (s) | Questions | Fix used | Verdict | Console errors |
|---|---|---|---|---|---|---|---|---|---|
| task-1-voxel-zen-garden | [LongCat 2.5 Preview](task-1-voxel-zen-garden/longcat-2.5-preview/notes.md) | high | 39.9 | 842.6 | 882.5 | 0 | no | **works** | 0 |
| task-1-voxel-zen-garden | [Space Bunny](task-1-voxel-zen-garden/space-bunny/notes.md) | max | 97.9 | 3862.6 | 3960.5 | 1 | no | **works** | 0 |
| task-1-voxel-zen-garden | [MiMo V2.6 Flash](task-1-voxel-zen-garden/mimo-v2.6-flash/notes.md) | default | 143.7 | 2685.9 | 2829.6 | 0 | no | **works** | 0 |
| task-1-voxel-zen-garden | [Step 5 Preview](task-1-voxel-zen-garden/step-5-preview/notes.md) | high | 165.6 | 3657.4 | 3823.0 | 1 | no | **broken (no output)** | 1 |
| task-1-voxel-zen-garden | [Muse Spark 1.3](task-1-voxel-zen-garden/muse-spark-1.3/notes.md) | xhigh | 31.5 | 111.5 | 143.0 | 1 | no | **works** | 0 |
| task-2-asteroid-run | [LongCat 2.5 Preview](task-2-asteroid-run/longcat-2.5-preview/notes.md) | high | 129.4 | 845.1 | 974.5 | 1 | no | **partially works** | 0 |
| task-2-asteroid-run | [Space Bunny](task-2-asteroid-run/space-bunny/notes.md) | max | 69.4 | 1540.0 | 1609.4 | 1 | no | **works** | 0 |
| task-2-asteroid-run | [MiMo V2.6 Flash](task-2-asteroid-run/mimo-v2.6-flash/notes.md) | default | 82.6 | 3122.0 | 3204.6 | 0 | no | **broken (no output)** | 1 |
| task-2-asteroid-run | [Step 5 Preview](task-2-asteroid-run/step-5-preview/notes.md) | high | 61.1 | 2500.1 | 2561.2 | 0 | no | **broken** | 1 |
| task-2-asteroid-run | [Muse Spark 1.3](task-2-asteroid-run/muse-spark-1.3/notes.md) | xhigh | 2917.0 | 0 | 2917.0 | 0 | no | **broken (no output)** | 1 |

<!-- /RESULTS_TABLE -->


## Task 2 (asteroid-run) notes

**Extra evaluation for a game task.** The 8-second capture is too short to tell whether an autopilot actually plays, so for task 2 every page that loaded also got an evaluation-only probe in the same headless setup. The probe watches the page idle for 30–90 s, reads the HUD score, and sends a few seconds of keyboard input. Probe screenshots are not published. They only inform the verdict, and each `notes.md` says what the probe showed.

**Questions.** LongCat (2 questions) and Space Bunny (4 questions) ended their plans with explicit questions and got the standard neutral reply. MiMo and Step ended with stated defaults plus "proceed / want me to proceed?", which, as in task 1, is answered by `Build it.` with no extra message.

**Incidents (task 2):**
- **Sandbox resets** interrupted three phases: LongCat's build (after 507 s), MiMo's build (after 714 s) and Step's build (after 100 s). LongCat and MiMo were resumed with the identical `Build it.` in the same session. For Step, the identical `Build it.` was re-sent in the same session right after the reset. Build time includes the interrupted part. Muse's plan was also hit by a reset; see below.
- **Free-endpoint rate limits (429).** From about 09:36 UTC the free OpenCode endpoint kept answering MiMo and Muse with `Rate limit exceeded`, and OpenCode waited in its retry loop without producing anything. Policy for provider failures was the current attempt plus **one** identical retry, then the model is recorded as **broken (no output)**:
  - **MiMo:** build attempt cut off by a reset (714 s) → resumed attempt rate-limited for the full 40-min cap (2400 s) → one final retry (identical `Build it.`, same session, deferred until after Step and Muse to give the limit time to clear) was rate-limited again within seconds and was then killed by a sandbox reset with no output. MiMo was not relaunched and is recorded as **broken (no output)**. Build time 714 + 2400 + ~8 s; the 8 s is estimated from file timestamps up to the last recorded activity, and the time the process spent idle in the 429 wait before the reset is not counted.
  - **Muse:** the plan was rate-limited from its first request. Attempt 1 was killed by a sandbox reset after 517 s with zero output. The identical prompt was sent once more in a fresh session, because nothing had been produced, and that attempt was rate-limited until the 40-min cap. `Build it.` was never sent.
- **Step timeout.** Step hit one `[504]`, then wrote code, but was still self-testing when the 40-min build cap hit. It never produced `index.html` (it wrote `asteroids.html` plus test scripts, all published as-is), so it is **broken**.
- **Pause slips.** Muse's plan started ~12 s after Step's capture and MiMo's final retry ~20 s after Muse's timeout, instead of ~60 s. Both runs are kept; the slips are disclosed here.
- **Harness fixes during task 2:** the provider-retry cap went from 4 tries to 2. 504/"upstream idle timeout" is now detected like 429. Phase time is now the sum of all tries. A favicon-only 404 is no longer counted as a console error (this changed LongCat's count from 1 to 0). The timeout `pkill` was fixed: its pattern started with `--dir`, so it was parsed as an option, and one hung process had to be killed by hand.

## Harness incidents (disclosed for transparency)

Task 1 hit four harness bugs before the protocol was stable. The affected attempts were voided **because the harness was at fault, not because of the model's output**, and the model was then run once more under the fixed harness:

1. **LongCat, attempt 0** — the work dir sat inside the benchmark folder; the model listed its parent and read the spec/progress files during planning. Voided before build.
2. **LongCat, attempt 1** — OpenCode takes the project directory from `$PWD`, not the process cwd, so the session ran rooted in the benchmark folder. Killed during build before any file was written. Fixed with `--dir` + `PWD`.
3. **Space Bunny, attempt 0** — the model ran `find` over the project folder and saw file names (reads were denied). Killed during planning. Fixed with the mount-namespace jail above.

4. **Step 5 Preview, attempt 0** — a scheduling bug in the queue script let Step's plan request start while MiMo's build was still running (strictly-sequential rule broken for ~1 min). Step's attempt was voided without using its output and re-run in a fresh session once MiMo had finished; MiMo's run was kept (no rate limit was hit during the overlap).

**Sandbox resets.** The machine running the benchmark restarted roughly every 50 minutes, killing whatever was running. That interrupted three task-1 builds: Space Bunny (after ~29 min), MiMo (after ~9 min) and Step (after ~5 min). In each case the work directory and session survived, and the identical `Build it.` message was re-sent **in the same session** (a logged retry, like a rate-limit retry, not a re-roll). The model carried on from whatever was already on disk and in its session history. Build time = time until the reset + time of the resumed run, so these build times include some repeated thinking. Each model's `notes.md` gives the split.

**Step 5 Preview provider failures (task 1).** Step's build request was sent 5 times in the same session: two sends were killed by sandbox resets (after 326 s and 70 s) and three failed because the free provider endpoint kept returning `[504] Upstream idle timeout exceeded` (once `[429] Endpoint is unavailable`) until OpenCode gave up. Retries were then stopped. Step never wrote a file, so it is recorded as **broken (no output)**; its build time (3657.4 s) is the sum of all five sends, its "console error" is just "no index.html", and its grid panel is black.

The official LongCat task-1 run (attempt 2) happened after fix 2 but before the jail; its tool calls were audited and it never touched anything outside its own dir and temp scratch. All later runs use the jail. Transcripts have sandbox proxy credentials redacted (`[REDACTED_SANDBOX_PROXY]`); nothing else is changed.
