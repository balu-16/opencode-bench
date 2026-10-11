#!/usr/bin/env python3
"""Upload bench/repo/** to GitHub balu-16/opencode-bench via GitHub REST contents PUT (same as apicall contents_put; raw HTTP to avoid 128 KB argv limit) (one commit per file).
Run in a shell with credentials [{"provider":"github"}].  Usage: push.py [path-prefix ...]
Skips files whose content already matches (git blob sha). Keeps a local cache of remote shas in push_state.json.
"""
import base64, hashlib, json, os, subprocess, sys, tempfile
BENCH = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(BENCH, "repo")
OWNER, NAME = "balu-16", "opencode-bench"
STATE = os.path.join(BENCH, "push_state.json")

def gh(method, path, body=None):
    """Raw GitHub REST call; the sandbox identity gateway injects the user's GitHub credential."""
    import urllib.request, urllib.error
    req = urllib.request.Request("https://api.github.com" + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Accept": "application/vnd.github+json", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

def blob_sha(data):
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()

def remote_sha(path):
    code, j = gh("GET", f"/repos/{OWNER}/{NAME}/contents/{path}")
    return j.get("sha") if code == 200 and isinstance(j, dict) else None

def main(prefixes):
    st = json.load(open(STATE)) if os.path.exists(STATE) else {}
    files = []
    for root, _, fs in os.walk(REPO):
        for f in fs:
            p = os.path.relpath(os.path.join(root, f), REPO)
            if not prefixes or any(p.startswith(x) for x in prefixes): files.append(p)
    files.sort()
    ok = fail = skip = 0
    for p in files:
        data = open(os.path.join(REPO, p), "rb").read()
        if len(data) > 45e6: print("TOO BIG, skipped:", p); fail += 1; continue
        local = blob_sha(data)
        rs = st.get(p) or remote_sha(p)
        if rs == local: skip += 1; st[p] = rs; continue
        params = dict(message=f"Add/update {p}", content=base64.b64encode(data).decode())
        if rs: params["sha"] = rs
        code, j = gh("PUT", f"/repos/{OWNER}/{NAME}/contents/{p}", params)
        new = (j.get("content") or {}).get("sha") if isinstance(j, dict) else None
        if new: st[p] = new; ok += 1; print("put", p)
        else: fail += 1; print("FAIL", p, str(j)[:300])
        json.dump(st, open(STATE, "w"), indent=1)
    print(f"uploaded={ok} unchanged={skip} failed={fail}")

if __name__ == "__main__":
    main(sys.argv[1:])
