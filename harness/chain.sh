#!/bin/bash
# chain.sh <cmd...> : run run_one.py subcommands sequentially; each arg is one quoted subcommand string
B=/workspace/projects/b8b4b3d3-4531-4ae4-bf38-8c9e70645b29/bench; PY=$B/../work/ochome/venv/bin/python; cd $B
echo $$ > $B/.chain.pid
for c in "$@"; do eval "$PY run_one.py $c"; done
