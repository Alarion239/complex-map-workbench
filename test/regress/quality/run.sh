#!/bin/bash
# Image-quality suite in one command: build dist/, render every scene in headless Chrome, gate against the baseline.
#
#   test/regress/quality/run.sh                    build, run all scenes, compare with quality/baseline.json
#   test/regress/quality/run.sh --no-build         use dist/ as it is
#   test/regress/quality/run.sh --only logH,joukowski   a subset (only those runs are gated)
#   test/regress/quality/run.sh --update-baseline  run, show the comparison with the old baseline, then make this run
#                                                  the new baseline (baseline.json + golden PNGs). Deliberate only.
# Needs: node, python3, Google Chrome, the static server for dist/ at http://localhost:8793 (or --base-url URL).
# Exit status: 0 pass, 1 fail, 2 setup problem.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
BUILD=1; UPDATE=0; PARTIAL=0; ARGS=()
for a in "$@"; do
  case "$a" in
    --no-build) BUILD=0 ;;
    --update-baseline) UPDATE=1 ;;
    --only) PARTIAL=1; ARGS+=("$a") ;;
    *) ARGS+=("$a") ;;
  esac
done
if [ "$BUILD" = 1 ]; then (cd "$ROOT" && python3 build.py) || { echo "build failed" >&2; exit 2; }; fi
OUT="$HERE/out/latest"
node "$HERE/run_quality.js" --out "$OUT" ${ARGS[@]+"${ARGS[@]}"}
RC=$?
[ "$RC" -ge 2 ] && exit 2
[ -f "$OUT/metrics.json" ] || exit 2
CMP=(--current "$OUT" --json "$OUT/compare.json")
[ "$PARTIAL" = 1 ] && CMP+=(--only-present)
if [ "$UPDATE" = 1 ]; then
  if [ -f "$HERE/baseline.json" ]; then
    echo; echo "== this run against the OLD baseline (for review) =="
    python3 "$HERE/../compare_quality.py" "${CMP[@]}"
  fi
  echo; node "$HERE/run_quality.js" --accept "$OUT"; exit $?
fi
if [ ! -f "$HERE/baseline.json" ]; then echo "no baseline yet: run $0 --update-baseline" >&2; exit 2; fi
echo
python3 "$HERE/../compare_quality.py" "${CMP[@]}"
