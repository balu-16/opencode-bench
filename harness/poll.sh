#!/bin/bash
# poll.sh <task> <model> <phase> [sleep_s]: optional sleep, then snapshot of phase log, last tool calls, work dir
B=/workspace/projects/b8b4b3d3-4531-4ae4-bf38-8c9e70645b29/bench
[ -n "$4" ] && sleep $4
cat $B/runs/$1/$2.$3.out 2>/dev/null | tail -8
python3 $B/show_tools.py $B/runs/$1/$2/_bench/$3.jsonl 2>/dev/null | tail -3 | cut -c1-220
ls -la $B/../work/ocb/$1/$2 2>/dev/null | tail -n +4
