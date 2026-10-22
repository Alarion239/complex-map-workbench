#!/bin/zsh
# Performance suite in one command: rebuild dist/ if src/ is newer, run the suite, gate against the baseline.
#
#   test/regress/perf/run.sh                      full suite (~9.5 min); exit 0 = pass, 1 = regression, 2 = setup problem
#   test/regress/perf/run.sh --quick              the 10 units the sphere / inverse work can move, 2 reps (~2.8 min)
#   test/regress/perf/run.sh --only 'image\.logUHP'  a subset of units (see: node test/regress/perf/run.js --list)
#   test/regress/perf/run.sh --no-build           use dist/ as it is
#   test/regress/perf/run.sh --swiftshader        also run the opt-in unit swiftshader.ratio (its own SwiftShader
#                                                 browser, ~1.5 min); the baseline is recorded with it
#   test/regress/perf/run.sh --no-confirm         do not re-run failing units (by default every unit with a failing
#                                                 metric runs twice more and its metrics become the median of the 3
#                                                 attempts: a real regression fails again, a noise spike does not)
#   test/regress/perf/run.sh --update-baseline    run the full suite 3 times (PERF_BASELINE_RUNS) on a QUIET machine
#                                                 (aborts when the load average is high), show the merged result
#                                                 against the OLD baseline (for review), then make it the new
#                                                 baseline (~21 min). Deliberate only.
# Other options go to run.js (--reps N, --skip REGEX, --base URL, --serve).
# Results: results/latest.json (confirmed), results/latest-attempt1.json, timestamped copies run-YYYYmmdd-HHMMSS*.json.
set -u
HERE="${0:A:h}"
ROOT="${HERE:h:h:h}"
CMP="$HERE/../compare_perf.py"
build=1; update=0; confirm=1; paired=0
args=()
for a in "$@"; do
  case "$a" in
    --no-build) build=0 ;;
    --update-baseline) update=1 ;;
    --no-confirm) confirm=0 ;;
    --paired) paired=1 ;;
    *) args+=("$a") ;;
  esac
done
if (( build )); then
  newer=$(find "$ROOT/src" -type f -newer "$ROOT/dist/test.html" 2>/dev/null | head -1)
  if [[ ! -f "$ROOT/dist/test.html" || -n "$newer" ]]; then
    echo "[perf] src/ is newer than dist/test.html: python3 build.py"
    (cd "$ROOT" && python3 build.py) || { echo "[perf] build failed"; exit 2; }
  fi
fi
R="$HERE/results"
mkdir -p "$R"
stamp=$(date +%Y%m%d-%H%M%S)

if (( paired )); then
  REF_SRC="${PERF_REF_SRC:-$ROOT/notes/backup-pre-sphere/src}"
  REF_BUILD="${PERF_REF_BUILD:-$ROOT/notes/backup-pre-sphere/build.py}"
  REF_ROOT="$HERE/ref_root"
  rm -rf "$REF_ROOT"; mkdir -p "$REF_ROOT"
  cp -R "$REF_SRC" "$REF_ROOT/src" && cp "$REF_BUILD" "$REF_ROOT/build.py" || { echo "[perf] reference snapshot missing"; exit 2; }
  python3 "$REF_ROOT/build.py" > /dev/null || { echo "[perf] reference build failed"; exit 2; }
  echo "[perf] paired run: reference = $REF_SRC"
  node "$HERE/run.js" --ab "$REF_ROOT/dist" --out "$R/paired-$stamp.json" --ab-out "$R/paired-$stamp-ref.json" "${args[@]}"
  rc=$?
  (( rc == 0 )) || { echo "[perf] the paired run did not complete (exit $rc)"; exit 2; }
  cp "$R/paired-$stamp.json" "$R/paired-latest.json"; cp "$R/paired-$stamp-ref.json" "$R/paired-latest-ref.json"
  echo
  python3 "$CMP" --baseline "$R/paired-$stamp-ref.json" --results "$R/paired-$stamp.json"
  exit $?
fi

if (( update )); then
  if (( ${#args[@]} )); then echo "[perf] --update-baseline takes no other options (a baseline is always a full run)"; exit 2; fi
  runs=()
  n=${PERF_BASELINE_RUNS:-3}
  for i in $(seq 1 $n); do
    echo "[perf] baseline run $i/$n"
    node "$HERE/run.js" --require-quiet --swiftshader --out "$R/baseline-$stamp-$i.json" || { echo "[perf] run $i did not complete (exit 3: machine busy, 4: a unit stalled) - no baseline written"; exit 2; }
    runs+=("$R/baseline-$stamp-$i.json")
  done
  python3 "$HERE/make_baseline.py" "${runs[@]}" -o "$R/baseline-$stamp-merged.json" || exit 2
  if [[ -f "$HERE/baseline.json" ]]; then
    echo; echo "== the new baseline against the OLD one (for review) =="
    python3 "$CMP" --baseline "$HERE/baseline.json" --results "$R/baseline-$stamp-merged.json"
  fi
  cp "$R/baseline-$stamp-merged.json" "$HERE/baseline.json"
  echo "[perf] wrote $HERE/baseline.json"
  exit 0
fi

if [[ ! -f "$HERE/baseline.json" ]]; then echo "[perf] no baseline yet: run $0 --update-baseline"; exit 2; fi
node "$HERE/run.js" --out "$R/latest-attempt1.json" "${args[@]}" || { echo "[perf] the suite did not complete"; exit 2; }
cp "$R/latest-attempt1.json" "$R/run-$stamp.json"
cp "$R/latest-attempt1.json" "$R/latest.json"
python3 "$CMP" --results "$R/latest.json" --failing-units "$R/failing-units.txt" > "$R/compare-attempt1.txt"
rc=$?
if (( rc == 1 && confirm )); then
  units=("${(@f)$(<"$R/failing-units.txt")}")
  if [[ " ${units[*]} " == *" * "* ]]; then
    echo "[perf] a failing metric belongs to no unit: not re-running"
  else
    re="^($(print -r -- ${(j:|:)${units//./\\.}}))\$"
    echo "[perf] $(grep -c '^  FAIL' "$R/compare-attempt1.txt") failing metric(s) in: ${units[*]}"
    echo "[perf] confirming: re-running those units twice"
    node "$HERE/run.js" --out "$R/run-$stamp-confirm1.json" --only "$re" "${args[@]}" || { echo "[perf] confirmation run 1 did not complete"; exit 2; }
    node "$HERE/run.js" --out "$R/run-$stamp-confirm2.json" --only "$re" "${args[@]}" || { echo "[perf] confirmation run 2 did not complete"; exit 2; }
    python3 "$HERE/merge_runs.py" --checks majority "$R/latest-attempt1.json" "$R/run-$stamp-confirm1.json" "$R/run-$stamp-confirm2.json" -o "$R/latest.json" > /dev/null || exit 2
    echo "[perf] first attempt: $(tail -1 "$R/compare-attempt1.txt")"
    echo "[perf] after confirmation (median of 3 attempts for the re-run units):"
  fi
fi
echo
python3 "$CMP" --results "$R/latest.json"
