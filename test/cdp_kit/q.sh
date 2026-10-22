#!/bin/zsh
# usage: q.sh <file.js | -> ; runs body in the CDP daemon and prints the JSON result
D="${0:A:h}"
n=$(( $(ls "$D/q" | grep -E '^[0-9]+\.js$' | sed 's/\.js//' | sort -n | tail -1 || echo 0) + 1 ))
if [[ "$1" == "-" ]]; then cat > "$D/q/$n.tmp"; else cp "$1" "$D/q/$n.tmp"; fi
mv "$D/q/$n.tmp" "$D/q/$n.js"
for i in {1..3000}; do [[ -f "$D/q/$n.out" ]] && { cat "$D/q/$n.out"; exit 0; }; [[ -f "$D/q/FATAL" ]] && { cat "$D/q/FATAL"; exit 1; }; sleep 0.1; done
echo TIMEOUT; exit 1
