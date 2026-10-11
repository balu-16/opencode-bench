#!/bin/bash
# next_plan.sh <task> <folder> <pidfile>: wait until the process whose pid is in <pidfile> (written by chain.sh) has exited,
# pause 60 s, then PLAN phase. (Earlier version took a pid from pgrep -f, which matched the launching shell itself -> ran concurrently.)
B=/workspace/projects/b8b4b3d3-4531-4ae4-bf38-8c9e70645b29/bench; PY=$B/../work/ochome/venv/bin/python
P=$(cat $3); [ -z "$P" ] && { echo "no pid"; exit 1; }
echo "waiting for pid $P ($(tr '\0' ' ' < /proc/$P/cmdline 2>/dev/null | cut -c1-120))"
while kill -0 $P 2>/dev/null; do sleep 10; done
sleep 60
cd $B && $PY run_one.py plan $1 $2
