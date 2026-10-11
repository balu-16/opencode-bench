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
| task-1-voxel-zen-garden | [Muse Spark 1.3](task-1-voxel-zen-garden/muse-spark-1.3/notes.md) | xhigh | 31.5 | 111.5 | 143.0 | 1 | no | **works** | 0 |

_Step 5 Preview (task 1) is still pending: its build was interrupted by sandbox resets and provider 504 errors (see below); its row, files and the task-1 grid will be added when it completes._

<!-- /RESULTS_TABLE -->

## Harness incidents (disclosed for transparency)

Task 1 hit four harness bugs before the protocol was stable. The affected attempts were voided **because the harness was at fault, not because of the model's output**, and the model was then run once more under the fixed harness:

1. **LongCat, attempt 0** — the work dir sat inside the benchmark folder; the model listed its parent and read the spec/progress files during planning. Voided before build.
2. **LongCat, attempt 1** — OpenCode takes the project directory from `$PWD`, not the process cwd, so the session ran rooted in the benchmark folder. Killed during build before any file was written. Fixed with `--dir` + `PWD`.
3. **Space Bunny, attempt 0** — the model ran `find` over the project folder and saw file names (reads were denied). Killed during planning. Fixed with the mount-namespace jail above.

4. **Step 5 Preview, attempt 0** — a scheduling bug in the queue script let Step's plan request start while MiMo's build was still running (strictly-sequential rule broken for ~1 min). Step's attempt was voided without using its output and re-run in a fresh session once MiMo had finished; MiMo's run was kept (no rate limit was hit during the overlap).

**Sandbox resets.** The machine running the benchmark restarted roughly every 50 minutes, killing whatever was running. That interrupted three task-1 builds: Space Bunny (after ~29 min), MiMo (after ~9 min) and Step (after ~5 min). In each case the work directory and session survived, and the identical `Build it.` message was re-sent **in the same session** (a logged retry, like a rate-limit retry, not a re-roll). The model carried on from whatever was already on disk and in its session history. Build time = time until the reset + time of the resumed run, so these build times include some repeated thinking. Each model's `notes.md` gives the split.

The official LongCat task-1 run (attempt 2) happened after fix 2 but before the jail; its tool calls were audited and it never touched anything outside its own dir and temp scratch. All later runs use the jail. Transcripts have sandbox proxy credentials redacted (`[REDACTED_SANDBOX_PROXY]`); nothing else is changed.
