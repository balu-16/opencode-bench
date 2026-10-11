#!/bin/bash
# Idempotent setup. Everything persistent lives under $P/work/ (sandbox resets wipe /tmp, ~ and apt packages).
# Usage: source bench/bootstrap.sh   (exports env vars; installs whatever is missing)
P=/workspace/projects/b8b4b3d3-4531-4ae4-bf38-8c9e70645b29
export OCHOME=$P/work/ochome
export XDG_CONFIG_HOME=$OCHOME/config XDG_DATA_HOME=$OCHOME/data XDG_CACHE_HOME=$OCHOME/cache XDG_STATE_HOME=$OCHOME/state
export PLAYWRIGHT_BROWSERS_PATH=$OCHOME/ms-playwright
export PATH=$OCHOME/bin:$OCHOME/venv/bin:$PATH
mkdir -p $OCHOME/bin $XDG_CONFIG_HOME/opencode $XDG_DATA_HOME $XDG_CACHE_HOME $XDG_STATE_HOME
if [ ! -x $OCHOME/bin/opencode ]; then
  curl -fsSL https://opencode.ai/install | bash >/dev/null 2>&1
  cp ~/.opencode/bin/opencode $OCHOME/bin/opencode
fi
cat > $XDG_CONFIG_HOME/opencode/opencode.jsonc <<'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "permission": { "external_directory": "deny" }
}
EOF
if [ ! -x $OCHOME/venv/bin/python ]; then python3 -m venv $OCHOME/venv; fi
$OCHOME/venv/bin/python -c "import playwright" 2>/dev/null || $OCHOME/venv/bin/pip install -q playwright
[ -d $PLAYWRIGHT_BROWSERS_PATH/ffmpeg-1011 ] || $OCHOME/venv/bin/python -m playwright install ffmpeg >/dev/null 2>&1
if ! command -v chromium >/dev/null; then
  (sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq chromium) >/tmp/apt.log 2>&1
fi
echo "bootstrap: opencode $($OCHOME/bin/opencode --version 2>/dev/null) | chromium $(command -v chromium) | playwright $($OCHOME/venv/bin/python -c 'import playwright,importlib.metadata as m;print(m.version("playwright"))' 2>/dev/null)"
