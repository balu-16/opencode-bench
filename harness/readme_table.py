#!/usr/bin/env python3
"""Rewrite the results table in repo/README.md (between <!-- RESULTS_TABLE --> and <!-- /RESULTS_TABLE -->) from repo/results.csv."""
import csv, os, re
B = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(B, "repo")
from finalize import NAMES
rows = list(csv.DictReader(open(os.path.join(R, "results.csv"))))
L = ["<!-- RESULTS_TABLE -->", "", "| Task | Model | Variant | Plan (s) | Build (s) | Total (s) | Questions | Fix used | Verdict | Console errors |",
     "|---|---|---|---|---|---|---|---|---|---|"]
for r in rows:
    L.append(f"| {r['task']} | [{NAMES[r['model']]}]({r['task']}/{r['model']}/notes.md) | {r['variant']} | {r['plan_s']} | {r['build_s']} | {r['total_s']} | {r['questions']} | {r['fix_used']} | **{r['verdict']}** | {r['console_errors']} |")
L += ["", "<!-- /RESULTS_TABLE -->"]
p = os.path.join(R, "README.md"); t = open(p).read()
if "<!-- /RESULTS_TABLE -->" in t:
    t = re.sub(r"<!-- RESULTS_TABLE -->.*?<!-- /RESULTS_TABLE -->", "\n".join(L), t, flags=re.S)
else:
    t = t.replace("<!-- RESULTS_TABLE -->", "\n".join(L))
open(p, "w").write(t); print("\n".join(L))
