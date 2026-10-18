#!/usr/bin/env python3
"""finalize.py note <task> <folder> <verdict> "<notable>"   -> repo/<task>/<folder>/notes.md + results.csv row
   finalize.py skip <task> <folder> "<reason>"              -> notes.md for an unavailable/skipped model + csv row
   finalize.py grid <task>                                   -> repo/<task>/grid.png + grid.mp4 (all models, 3 columns, labeled)
"""
import csv, json, os, subprocess, sys
BENCH = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BENCH)
from run_one import MODELS, paths
ORDER = ["longcat-2.5-preview", "space-bunny", "mimo-v2.6-flash", "step-5-preview", "muse-spark-1.3"]
NAMES = {"longcat-2.5-preview": "LongCat 2.5 Preview", "space-bunny": "Space Bunny", "mimo-v2.6-flash": "MiMo V2.6 Flash",
         "step-5-preview": "Step 5 Preview", "muse-spark-1.3": "Muse Spark 1.3", "exo": "Exo Free",
         "deepseek-v4.1-flash": "DeepSeek V4.1 Flash", "beam": "Beam", "nemotron-3.5-super-vl": "Nemotron 3.5 Super VL",
         "glm-5.3-flash": "GLM 5.3 Flash"}
EXTRA = ["deepseek-v4.1-flash", "beam", "nemotron-3.5-super-vl", "glm-5.3-flash"]   # added 2026-10-18
ORDER_ALL = ORDER + EXTRA
CSV = os.path.join(BENCH, "repo", "results.csv")
HDR = ["task", "model", "model_id", "variant", "plan_s", "build_s", "total_s", "questions", "fix_used", "verdict", "console_errors"]

def upsert(row):
    rows = []
    if os.path.exists(CSV):
        rows = [r for r in csv.DictReader(open(CSV)) if not (r["task"] == row["task"] and r["model"] == row["model"])]
    rows.append(row)
    rows.sort(key=lambda r: (r["task"], ORDER_ALL.index(r["model"])))
    with open(CSV, "w", newline="") as f:
        w = csv.DictWriter(f, HDR); w.writeheader(); w.writerows(rows)

def note(task, folder, verdict, notable):
    work, meta = paths(task, folder)
    st = json.load(open(os.path.join(meta, "state.json")))
    out = os.path.join(BENCH, "repo", task, folder)
    errs = st.get("console_errors", [])
    q = st.get("questions", [])
    files = sorted(f for f in os.listdir(out) if f not in ("notes.md", "screenshot.png", "recording.mp4", "transcript.json"))
    L = [f"# {NAMES[folder]} — {task}", "",
         f"- **Model ID:** `{st['model_id']}`",
         f"- **Reasoning variant (max available):** `{st['variant']}` (plan and build)",
         f"- **Session:** `{st.get('session')}`",
         f"- **Plan time:** {st.get('plan_s')} s" + (" (includes answering the model's question)" if q else ""),
         f"- **Build time:** {st.get('build_s')} s" + (" — TIMED OUT at 40 min" if st.get("build_timeout") else ""),
         f"- **Total time:** {st.get('total_s')} s",
         f"- **Rate-limit retries:** {st.get('rate_limit_retries', 0)}",
         f"- **Files generated:** {', '.join(files) if files else '(none)'}", "",
         "## Questions asked", ""]
    if q:
        for i, x in enumerate(q, 1):
            L += [f"{i}. Model asked (excerpt of its reply):", "", "```", x["question_excerpt"].strip()[:1500], "```", "",
                  f"   Answer given (same session, plan agent): \"{x['answer']}\"", ""]
    else:
        L += ["None.", ""]
    L += ["## Fixes", ""]
    L += [f"One crash fix message sent (build agent, same session): \"{st['fix']['message']}\"" if st.get("fix") else "None.", ""]
    L += [f"## Verdict: **{verdict}**", "", notable, "",
          "## Console errors (headless Chromium, SwiftShader WebGL, 1280x720, ~10 s)", ""]
    L += ([f"- `{e[:400]}`" for e in errs] if errs else ["None."]) + [""]
    open(os.path.join(out, "notes.md"), "w").write("\n".join(L))
    upsert({"task": task, "model": folder, "model_id": st["model_id"], "variant": st["variant"],
            "plan_s": st.get("plan_s"), "build_s": st.get("build_s"), "total_s": st.get("total_s"),
            "questions": len(q), "fix_used": "yes" if st.get("fix") else "no", "verdict": verdict,
            "console_errors": len(errs)})

def skip(task, folder, reason):
    out = os.path.join(BENCH, "repo", task, folder); os.makedirs(out, exist_ok=True)
    open(os.path.join(out, "notes.md"), "w").write(f"# {NAMES[folder]} — {task}\n\n- **Model ID:** `{MODELS[folder][0]}`\n\n"
                                                 f"## Verdict: **skipped / unavailable**\n\n{reason}\n")
    upsert({"task": task, "model": folder, "model_id": MODELS[folder][0], "variant": MODELS[folder][1] or "default",
            "plan_s": "", "build_s": "", "total_s": "", "questions": "", "fix_used": "", "verdict": "skipped",
            "console_errors": ""})

def grid(task, order=None, name="grid"):
    """Labeled grid of all model panels, 3 columns (5 models -> 3x2, 9 models -> 3x3). Missing output -> black panel."""
    order = order or ORDER_ALL
    d = os.path.join(BENCH, "repo", task)
    font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    n = len(order); cols = 3; rows = -(-n // cols); cells = cols * rows
    pngs, vids = [], []
    for f in order:
        p = os.path.join(d, f, "screenshot.png"); v = os.path.join(d, f, "recording.mp4")
        pngs.append(p if os.path.exists(p) and os.path.getsize(p) > 0 else "xc:black")
        vids.append(v if os.path.exists(v) else None)
    margs = []
    for p, f in zip(pngs, order):
        margs += ["-label", NAMES[f]] + (["-size", "1280x720", "xc:black"] if p == "xc:black" else [p])
    subprocess.run(["montage"] + margs + ["-tile", f"{cols}x{rows}", "-geometry", "640x360+6+6", "-pointsize", "26",
                    "-font", font, "-background", "#111", "-fill", "white", os.path.join(d, name + ".png")], check=True)
    inputs, filt = [], []
    for i, (v, f) in enumerate(zip(vids, order)):
        if v: inputs += ["-i", v]
        else: inputs += ["-f", "lavfi", "-t", "8", "-i", "color=c=black:s=1280x720:r=30"]
        filt.append(f"[{i}:v]scale=640:360,fps=30,setpts=PTS-STARTPTS,drawtext=fontfile={font}:text='{NAMES[f]}':"
                    f"x=12:y=12:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8[v{i}]")
    for i in range(n, cells):
        inputs += ["-f", "lavfi", "-t", "8", "-i", "color=c=0x111111:s=640x360:r=30"]; filt.append(f"[{i}:v]null[v{i}]")
    layout = "|".join(f"{(k % cols) * 640}_{(k // cols) * 360}" for k in range(cells))
    filt.append("".join(f"[v{k}]" for k in range(cells)) + f"xstack=inputs={cells}:layout={layout}[out]")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + inputs + ["-filter_complex", ";".join(filt), "-map", "[out]",
                    "-t", "8", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "28", "-preset", "veryfast",
                    os.path.join(d, name + ".mp4")], check=True)
    print("grid done", os.path.getsize(os.path.join(d, name + ".mp4")))

if __name__ == "__main__":
    c = sys.argv[1]
    if c == "note": note(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
    elif c == "skip": skip(sys.argv[2], sys.argv[3], sys.argv[4])
    elif c == "grid": grid(sys.argv[2])
