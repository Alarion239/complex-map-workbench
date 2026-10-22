#!/bin/bash
# The P5 forced-forward gate (P5 review): every quality scene drawn with exact images off (the forward path: SphereMesh
# or today's GPU draw), scored like the exact run and gated against it with the SPEC targets enforced, on every metric
# (iou, hole, spill, parity_acc, opacity_min, color_off, hole_leak), not on IoU alone.
#   test/regress/quality/run_forced_forward.sh [--no-build] [--only id1,id2]
# Needs the exact run first (test/regress/quality/run.sh: quality/out/latest). Output: quality/out/forced-forward.
# Exit status: 0 pass, 1 fail, 2 setup problem.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
BUILD=1; ARGS=()
for a in "$@"; do case "$a" in --no-build) BUILD=0 ;; *) ARGS+=("$a") ;; esac; done
if [ "$BUILD" = 1 ]; then (cd "$ROOT" && python3 build.py) || { echo "build failed" >&2; exit 2; }; fi
[ -f "$HERE/out/latest/metrics.json" ] || { echo "run test/regress/quality/run.sh first (the exact run is the reference)" >&2; exit 2; }
OUT="$HERE/out/forced-forward"
node "$HERE/run_quality.js" --override '{"exactImages":false}' --out "$OUT" ${ARGS[@]+"${ARGS[@]}"}
[ $? -ge 2 ] && exit 2
python3 "$ROOT/test/regress/compare_quality.py" --current "$OUT" --baseline "$HERE/out/latest/metrics.json" --all --enforce-targets --json "$OUT/compare.json"
