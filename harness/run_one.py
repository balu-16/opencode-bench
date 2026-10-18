#!/workspace/projects/b8b4b3d3-4531-4ae4-bf38-8c9e70645b29/work/ochome/venv/bin/python
"""OpenCode benchmark runner (reusable across tasks).

Usage (launch long phases with nohup ... & and poll logs):
  run_one.py plan    <task> <folder>     # fresh dir, PLAN agent, prompt from repo/<task>/prompt.md
  run_one.py answer  <task> <folder> "<text>"   # neutral answer to a model question (plan agent, same session)
  run_one.py build   <task> <folder>     # "Build it." with BUILD agent, same session
  run_one.py fix     <task> <folder> "<error>"  # single crash fix message (build agent)
  run_one.py capture <task> <folder>     # Playwright screenshot + 8s video + console errors, export transcript, copy to repo
State: runs/<task>/<folder>/_bench/state.json ; logs in the same _bench dir (outside the model's work dir).
Model registry below: folder -> (model id, max variant or None)
"""
import json, os, subprocess, sys, time, shutil, glob, http.server, threading, socketserver, functools

BENCH = os.path.dirname(os.path.abspath(__file__))
P = os.path.dirname(BENCH)
OCHOME = os.path.join(P, "work", "ochome")          # persistent (sandbox resets wipe ~ and /tmp); see bootstrap.sh
for k, v in {"XDG_CONFIG_HOME": "config", "XDG_DATA_HOME": "data", "XDG_CACHE_HOME": "cache", "XDG_STATE_HOME": "state",
             "PLAYWRIGHT_BROWSERS_PATH": "ms-playwright"}.items():
    os.environ[k] = os.path.join(OCHOME, v)
OC = os.path.join(OCHOME, "bin", "opencode")
OCDB = os.path.join(OCHOME, "data", "opencode", "opencode.db")
MODELS = {
    "longcat-2.5-preview": ("opencode/longcat-2.5-preview-free", "high"),
    "space-bunny":         ("opencode/space-bunny-free", "max"),
    "mimo-v2.6-flash":     ("opencode/mimo-v2.6-flash-free", None),   # no variants -> default
    "step-5-preview":      ("opencode/step-5-preview-free", "high"),
    "muse-spark-1.3":      ("opencode/muse-spark-1.3-contributor-free", "xhigh"),
    "exo":                 ("opencode/exo-free", "high"),   # added 2026-10-14 as 6th model (only variant = high)
    # extra models added 2026-10-18 (max reasoning variant from models.json), run on opencode 1.19.0
    "deepseek-v4.1-flash":   ("opencode/deepseek-v4.1-flash-free", "max"),
    "beam":                  ("opencode/beam-free", "max"),
    "nemotron-3.5-super-vl": ("opencode/nemotron-3.5-super-vl-free", "xhigh"),
    "glm-5.3-flash":         ("opencode/glm-5.3-flash-free", "max"),
}
TIMEOUT = 2400  # 40 min per phase
MAX_ATTEMPTS = int(os.environ.get("OCB_MAX_ATTEMPTS", 2))  # provider-error policy (task 2+): current attempt + one retry (env override when a retry is sent by hand)

def paths(task, folder):
    # model's fresh empty dir lives OUTSIDE the bench tree so the model cannot see spec/other runs
    work = os.path.join(P, "work", "ocb", task, folder)   # real (persistent) location; the model sees it as jail_dir()
    meta = os.path.join(BENCH, "runs", task, folder, "_bench")   # our logs/state
    return work, meta

def jail_dir(task, folder):
    return os.path.join("/tmp/ocb", task, folder)

JAIL_SH = os.path.join(BENCH, "jail.sh")

def load_state(meta):
    p = os.path.join(meta, "state.json")
    return json.load(open(p)) if os.path.exists(p) else {}

def save_state(meta, st):
    json.dump(st, open(os.path.join(meta, "state.json"), "w"), indent=2)

def log(meta, msg):
    line = time.strftime("%Y-%m-%d %H:%M:%S") + " " + msg
    print(line, flush=True)
    open(os.path.join(meta, "events.log"), "a").write(line + "\n")

def oc_run(task, folder, agent, message, session=None, tag="phase"):
    work, meta = paths(task, folder)
    mid, var = MODELS[folder]
    jd = jail_dir(task, folder)
    cmd = ["sudo", "-E", "unshare", "-m", "--propagation", "private", "sh", JAIL_SH, work, jd,
           OC, "run", "--dir", jd, "--agent", agent, "-m", mid, "--format", "json", "--auto"]
    if var: cmd += ["--variant", var]
    if session: cmd += ["-s", session]
    cmd += [message]
    logf = os.path.join(meta, f"{tag}.jsonl")
    errf = os.path.join(meta, f"{tag}.stderr")
    attempt = 0; total_dt = 0.0
    while True:
        attempt += 1
        log(meta, f"START {tag} attempt {attempt} agent={agent} model={mid} variant={var or 'default'} session={session}")
        t0 = time.time()
        with open(logf, "a") as lo, open(errf, "a") as le:
            try:
                rc = subprocess.run(cmd, cwd=work, env=dict(os.environ, PWD=work), stdout=lo, stderr=le, timeout=TIMEOUT).returncode
                timed_out = False
            except subprocess.TimeoutExpired:
                rc, timed_out = -9, True
                subprocess.run(["sudo", "pkill", "-9", "-f", "--", f"--dir {jd}"])   # "--" so pkill does not parse the pattern as an option
        dt = time.time() - t0; total_dt += dt
        for g in glob.glob(os.path.join(OCHOME, "config", "chromium*")) + glob.glob(os.path.join(OCHOME, "cache", "chromium*")):
            shutil.rmtree(g, ignore_errors=True)   # model's self-test Chromium profiles: not part of the output
        log(meta, f"END {tag} attempt {attempt} rc={rc} timeout={timed_out} secs={dt:.1f}")
        # rate limit detection -> retry same request (logged, not a re-roll)
        txt = open(logf).read()[-20000:] + open(errf).read()[-5000:]
        rl = (("rate limit" in txt.lower()) or (" 429" in txt) or ('"statusCode":429' in txt)
              or ("[504]" in txt) or ("upstream idle timeout" in txt.lower())
              or ("unexpected server error" in txt.lower()) or ("endpoint is unavailable" in txt.lower())
              or ('"statusCode":503' in txt)) and not timed_out   # 2026-10-18: Zen UnknownError counts as provider error
        produced = '"type":"text"' in txt or '"type":"tool_use"' in txt
        # task-2 policy: provider failure (429/504) -> the current attempt plus ONE more identical retry, then stop.
        if rl and attempt < MAX_ATTEMPTS and rc != 0:
            log(meta, f"PROVIDER-ERROR (429/504) detected on {tag}; retrying same request after 90s (logged retry, not a re-roll)")
            time.sleep(90); continue
        if rl and rc != 0: log(meta, f"PROVIDER-ERROR on {tag} after {attempt} attempts; giving up (broken, no output)")
        return rc, round(total_dt, 1), timed_out, attempt   # dt = sum of all attempts (retry wait excluded)

def session_from(logf):
    # last sessionID in the log: after a provider-error retry of a fresh plan, the retry's (new) session is the live one
    sid = None
    for line in open(logf):
        try:
            j = json.loads(line)
            if j.get("sessionID"): sid = j["sessionID"]
        except Exception: pass
    return sid

def last_text(logf):
    out = []
    for line in open(logf):
        try:
            j = json.loads(line)
            if j.get("type") == "text": out.append(j["part"].get("text", ""))
        except Exception: pass
    return out[-1] if out else ""

def cmd_plan(task, folder):
    work, meta = paths(task, folder)
    if os.path.exists(work) and os.listdir(work):
        sys.exit(f"work dir not empty: {work}")
    os.makedirs(work, exist_ok=True); os.makedirs(meta, exist_ok=True)
    prompt = open(os.path.join(BENCH, "repo", task, "prompt.md")).read()
    st = {"task": task, "folder": folder, "model_id": MODELS[folder][0], "variant": MODELS[folder][1] or "default",
          "questions": [], "fix": None, "rate_limit_retries": 0}
    rc, dt, to, att = oc_run(task, folder, "plan", prompt, tag="plan")
    st.update(plan_s=round(dt, 1), plan_rc=rc, plan_timeout=to, plan_attempts=att,
              session=session_from(os.path.join(meta, "plan.jsonl")))
    st["rate_limit_retries"] += att - 1
    save_state(meta, st)
    open(os.path.join(meta, "plan_reply.md"), "w").write(last_text(os.path.join(meta, "plan.jsonl")))
    import sqlite3
    db = sqlite3.connect("file:" + OCDB + "?mode=ro", uri=True)
    r = db.execute("select directory from session where id=?", (st["session"],)).fetchone()
    st["session_directory"] = r[0] if r else None; save_state(meta, st)
    log(meta, f"PLAN DONE session={st['session']} session_dir={st['session_directory']}")
    if st["session_directory"] != jail_dir(task, folder): log(meta, "WARNING: session directory != work dir (isolation broken)")

def cmd_answer(task, folder, text):
    work, meta = paths(task, folder); st = load_state(meta)
    q = open(os.path.join(meta, "plan_reply.md")).read()
    n = len(st["questions"]) + 1
    rc, dt, to, att = oc_run(task, folder, "plan", text, session=st["session"], tag=f"answer{n}")
    st["questions"].append({"question_excerpt": q[-1500:], "answer": text, "secs": round(dt, 1)})
    st["plan_s"] = round(st["plan_s"] + dt, 1)   # answering is part of plan phase
    st["rate_limit_retries"] += att - 1
    save_state(meta, st)
    open(os.path.join(meta, "plan_reply.md"), "w").write(last_text(os.path.join(meta, f"answer{n}.jsonl")))
    log(meta, "ANSWER DONE")

def cmd_build(task, folder):
    work, meta = paths(task, folder); st = load_state(meta)
    rc, dt, to, att = oc_run(task, folder, "build", "Build it.", session=st["session"], tag="build")
    st.update(build_s=round(dt, 1), build_rc=rc, build_timeout=to, build_attempts=att)
    st["rate_limit_retries"] += att - 1
    st["total_s"] = round(st["plan_s"] + st["build_s"], 1)
    save_state(meta, st)
    open(os.path.join(meta, "build_reply.md"), "w").write(last_text(os.path.join(meta, "build.jsonl")))
    log(meta, f"BUILD DONE files={os.listdir(work)}")

def cmd_build_resume(task, folder, prior_secs, why):
    """Build phase was killed by an external event (sandbox reset), not by the model. Re-send the identical
    "Build it." in the SAME session (a logged retry, not a re-roll). build_s = interrupted attempt(s) + this attempt."""
    work, meta = paths(task, folder); st = load_state(meta)
    st.setdefault("build_interruptions", []).append({"secs_until_last_event": float(prior_secs), "reason": why})
    save_state(meta, st)
    log(meta, f"BUILD INTERRUPTED externally ({why}); prior attempt ~{prior_secs}s; re-sending identical 'Build it.' in same session")
    rc, dt, to, att = oc_run(task, folder, "build", "Build it.", session=st["session"], tag="build")
    prior = sum(x["secs_until_last_event"] for x in st["build_interruptions"])
    st.update(build_s=round(prior + dt, 1), build_rc=rc, build_timeout=to, build_attempts=att + len(st["build_interruptions"]))
    st["rate_limit_retries"] += att - 1
    st["total_s"] = round(st["plan_s"] + st["build_s"], 1)
    save_state(meta, st)
    open(os.path.join(meta, "build_reply.md"), "w").write(last_text(os.path.join(meta, "build.jsonl")))
    log(meta, f"BUILD DONE (resumed) files={os.listdir(work)}")

def cmd_fix(task, folder, err):
    work, meta = paths(task, folder); st = load_state(meta)
    if st.get("fix"): sys.exit("fix already used")
    msg = f"The page crashes on load with this error: {err}. Fix it."
    rc, dt, to, att = oc_run(task, folder, "build", msg, session=st["session"], tag="fix")
    st["fix"] = {"message": msg, "secs": round(dt, 1), "rc": rc}
    st["rate_limit_retries"] += att - 1
    save_state(meta, st)
    log(meta, "FIX DONE")

def proxy_cfg():
    from urllib.parse import urlparse, unquote
    u = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy") or os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
    if not u: return None
    p = urlparse(u)
    cfg = {"server": f"{p.scheme}://{p.hostname}:{p.port}", "bypass": "127.0.0.1,localhost"}
    if p.username: cfg["username"] = unquote(p.username); cfg["password"] = unquote(p.password or "")
    return cfg

import re
SECRET_RE = re.compile(r"https?://eyJ[A-Za-z0-9_\-\.%]+(:[^@\s\"]*)?@[^\s\"\\]+|eyJhbGci[A-Za-z0-9_\-\.%]+")
def redact_file(path):
    """Remove sandbox proxy credentials (JWT) from transcripts/logs before publishing."""
    t = open(path, errors="replace").read()
    t2 = SECRET_RE.sub("[REDACTED_SANDBOX_PROXY]", t)
    if t2 != t: open(path, "w").write(t2)
    return t2 != t

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def capture(task, folder, outdir):
    from playwright.sync_api import sync_playwright
    work, meta = paths(task, folder)
    srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Q, directory=outdir))
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    vid_dir = os.path.join(meta, "vid"); shutil.rmtree(vid_dir, ignore_errors=True)
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/chromium",
            args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                  "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
            proxy=proxy_cfg(),
            env=dict(os.environ, XDG_CONFIG_HOME="/tmp/pw_cfg", XDG_CACHE_HOME="/tmp/pw_cache"))  # keep chromium profile out of workspace
        ctx = b.new_context(viewport={"width": 1280, "height": 720},
                            record_video_dir=vid_dir, record_video_size={"width": 1280, "height": 720})
        pg = ctx.new_page()
        pg.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        pg.on("requestfailed", lambda r: errors.append(f"requestfailed: {r.url} {r.failure}"))
        pg.on("response", lambda r: errors.append(f"http {r.status}: {r.url}") if r.status >= 400 else None)
        t0 = time.time()
        try:
            pg.goto(f"http://127.0.0.1:{port}/index.html", wait_until="load", timeout=60000)
        except Exception as e:
            errors.append(f"goto: {e}")
        load_s = time.time() - t0
        pg.wait_for_timeout(9500)
        pg.screenshot(path=os.path.join(outdir, "screenshot.png"))
        ctx.close(); b.close()
    srv.shutdown()
    # Chromium's own /favicon.ico request is invisible to page listeners but logs a generic 404 console line.
    # If no page-visible 404 was seen, that generic line can only be the favicon -> drop it.
    G = "console.error: Failed to load resource: the server responded with a status of 404 (File not found)"
    if G in errors and not any(e.startswith("http 404:") and not e.endswith("/favicon.ico") for e in errors):
        errors.remove(G)
    errors = [e for e in errors if not e.endswith("/favicon.ico")]
    webm = glob.glob(os.path.join(vid_dir, "*.webm"))[0]
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", webm],
                               capture_output=True, text=True).stdout.strip() or 10)
    start = max(0.0, dur - 8.0)  # last 8 s (page already loaded)
    mp4 = os.path.join(outdir, "recording.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.2f}", "-i", webm, "-t", "8",
                    "-vf", "scale=1280:720,fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "28",
                    "-preset", "veryfast", "-an", mp4], check=True)
    if os.path.getsize(mp4) > 9.5e6:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", webm, "-ss", f"{start:.2f}", "-t", "8",
                        "-vf", "scale=1280:720,fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "36",
                        "-an", mp4], check=True)
    return errors, round(load_s, 1)

def cmd_capture(task, folder):
    work, meta = paths(task, folder); st = load_state(meta)
    out = os.path.join(BENCH, "repo", task, folder); os.makedirs(out, exist_ok=True)
    # copy generated code (everything the model made, excluding vcs/node_modules)
    for item in (os.listdir(work) if os.path.isdir(work) else []):
        if item in (".git", "node_modules", ".opencode"): continue
        s = os.path.join(work, item); d = os.path.join(out, item)
        if os.path.isdir(s): shutil.copytree(s, d, dirs_exist_ok=True)
        else: shutil.copy2(s, d)
    if not os.path.exists(os.path.join(out, "index.html")):
        st["capture_note"] = "no index.html produced"
        errors, load_s = ["no index.html in work dir"], None
        open(os.path.join(out, "screenshot.png"), "wb").close() if False else None
    else:
        errors, load_s = capture(task, folder, out)
    st["console_errors"] = errors; st["load_s"] = load_s
    if not os.path.exists(os.path.join(out, "transcript.json")) or st.get("reexport", True):
      os.makedirs(work, exist_ok=True)
      with open(os.path.join(out, "transcript.json") + ".tmp", "w") as tf:   # write to a file, not a pipe (pipe truncated at 64 KB)
        tr = subprocess.run([OC, "export", st["session"]], cwd=work, env=dict(os.environ, PWD=work), stdout=tf, stderr=subprocess.DEVNULL)
      st["export_rc"] = tr.returncode
      if tr.returncode == 0 and os.path.getsize(os.path.join(out, "transcript.json") + ".tmp") > 100:
          os.replace(os.path.join(out, "transcript.json") + ".tmp", os.path.join(out, "transcript.json"))
      else:
          os.remove(os.path.join(out, "transcript.json") + ".tmp"); log(meta, "export failed; kept existing transcript.json")
    st["transcript_redacted"] = redact_file(os.path.join(out, "transcript.json"))
    save_state(meta, st)
    log(meta, f"CAPTURE DONE errors={len(errors)}")
    print(json.dumps(errors[:20], indent=1))

if __name__ == "__main__":
    c, task, folder = sys.argv[1], sys.argv[2], sys.argv[3]
    {"plan": lambda: cmd_plan(task, folder), "build": lambda: cmd_build(task, folder),
     "capture": lambda: cmd_capture(task, folder),
     "build_resume": lambda: cmd_build_resume(task, folder, sys.argv[4], sys.argv[5]),
     "answer": lambda: cmd_answer(task, folder, sys.argv[4]),
     "fix": lambda: cmd_fix(task, folder, sys.argv[4])}[c]()
