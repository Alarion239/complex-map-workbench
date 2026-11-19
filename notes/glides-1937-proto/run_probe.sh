#!/bin/bash
# run_probe.sh TAG RENDERER(lvp|ss) [ONLY]  — runs the scratch probe in the repo at $REPO (default cwd)
cd "${REPO:-/home/user/complex-map-workbench}"
export CHROME_BIN=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux64/chrome | head -1)
if [ "$2" = lvp ]; then export CMW_ANGLE=vulkan CMW_CHROME_ARGS="--no-sandbox --enable-features=Vulkan --use-vulkan=native --disable-vulkan-surface"; else export CMW_ANGLE=swiftshader CMW_CHROME_ARGS="--no-sandbox"; fi
export GP_OUT=${GP_OUT:-/tmp/claude-0/-home-user-complex-map-workbench/137cd19b-dd6d-5ff8-b719-dc2f2bd4f5ec/scratchpad/frames} GP_TAG=$1 GP_W=1200 GP_H=800 GP_JUDGE=1
[ -n "$3" ] && export GP_ONLY=$3
timeout 7000 node ci/browser.js --only '^zz_glides_probe_cmd' --no-build 2>&1 | grep -E "zz_glides|rror" | head -5
