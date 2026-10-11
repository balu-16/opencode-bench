#!/bin/bash
# wait.sh <secs> <label>: sleep, then show latest event lines of every running/queued phase
B=/workspace/projects/b8b4b3d3-4531-4ae4-bf38-8c9e70645b29/bench; sleep $1; date +%T
for f in $B/runs/task-1-voxel-zen-garden/*.out; do echo "$(basename $f): $(tail -n1 $f | cut -c1-170)"; done
pgrep -af "opencode run" | grep -o "agent [a-z]* -m [^ ]*" | head -2
