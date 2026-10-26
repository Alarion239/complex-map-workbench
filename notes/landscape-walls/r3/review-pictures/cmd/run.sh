#!/bin/zsh
# usage: run.sh cmd.js : cmd/common.js + the command through the queue
D="${0:A:h}"
n=$(( $(ls "$D/q" | grep -E '^[0-9]+\.js$' | sed 's/\.js//' | sort -n | tail -1 || echo 0) + 1 ))
cat "$D/cmd/common.js" "$1" > "$D/q/$n.tmp"; mv "$D/q/$n.tmp" "$D/q/$n.js"
until [[ -f "$D/q/$n.out" || -f "$D/q/FATAL" ]]; do sleep 1; done
cat "$D/q/$n.out" 2>/dev/null || cat "$D/q/FATAL"
