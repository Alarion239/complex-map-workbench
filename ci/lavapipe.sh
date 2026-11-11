#!/usr/bin/env bash
# Mesa's Vulkan drivers (the package mesa-vulkan-drivers) for the browser jobs (gate.yml): its lavapipe is the Vulkan
# driver that Chrome's ANGLE draws WebGL2 with on GitHub's Linux machines. The job keeps the package's files in an
# Actions cache, for when Ubuntu's mirrors cannot be reached.
#   ci/lavapipe.sh --key   prints the cache key: the runner's image (ImageOS, ImageVersion) and the package's version
#                          in the image's own package lists
#   ci/lavapipe.sh DIR     installs the package; DIR holds the cached .deb files (the job restores them before, and
#                          saves them after an install from the mirrors)
# The install downloads the files the image lacks from the mirrors with the image's own package lists (fast: no
# refresh), and installs them with dpkg; DIR then holds exactly those files. When that first download fails, the files
# in DIR are installed. When DIR has none, or they do not install, the download is tried again after refreshing the
# lists, ATTEMPTS times in all, waiting longer before each. Each part's time goes to the log, and
# source=image|mirror|cache to $GITHUB_OUTPUT (image: the image had the package). Exits 1 with an error annotation that
# names the cause when, at the end, the package is not installed (dpkg -s) or lavapipe's ICD file is missing: Chrome
# would have no Vulkan driver, and so no WebGL2.
set -u
PKG=mesa-vulkan-drivers
# (apt's download folder for this package alone, so that after a download it holds exactly the files fetched; its
# partial/ belongs to _apt, as apt's sandbox expects. test/t_lavapipe.js gives another in CMW_LAVAPIPE_ARCHIVES)
ARCHIVES=${CMW_LAVAPIPE_ARCHIVES:-/var/cache/apt/cmw-lavapipe}
ATTEMPTS=4
FIRST_WAIT_S=10   # before the second attempt; doubled before each later one (10, 20, 40 s)
NET_LIMIT_S=45    # an apt call that uses the network (a refresh, a download of about 18 MB: seconds when the mirrors answer)
# (apt does not retry by itself: the attempts below do, with the lists refreshed, and an apt that retries a file the
# mirrors cannot serve logs a warning per try)
APT=(-qq -o Acquire::Retries=0 -o "Dir::Cache::Archives=$ARCHIVES")

if [ "${1:-}" = --key ]; then
  version=$(apt-cache policy "$PKG" | awk '/Candidate:/ { print $2 }')
  # (a cache key may not hold a comma: anything but letters, digits and . _ + ~ - becomes _)
  printf '%s' "lavapipe-${ImageOS:-unknown}-${ImageVersion:-unknown}-$version" | tr -c 'A-Za-z0-9._+~-' '_'
  echo
  exit 0
fi
DEBS=${1:?usage: ci/lavapipe.sh --key | ci/lavapipe.sh DIR}

# (microseconds; whole seconds on a bash older than 5, which has no EPOCHREALTIME)
us() { local t=${EPOCHREALTIME:-$(date +%s).000000}; echo "${t/[.,]/}"; }
seconds() { local d=$(($(us) - $1)); printf '%d.%d s' $((d / 1000000)) $((d / 100000 % 10)); }
# timed LABEL COMMAND...: runs COMMAND and logs LABEL with its outcome and time; returns COMMAND's status
timed() {
  local label=$1 t status outcome=ok
  shift
  t=$(us)
  "$@"
  status=$?
  [ "$status" = 0 ] || outcome="failed (exit $status)"
  echo "$label: $outcome, $(seconds "$t")"
  return "$status"
}
# lavapipe's ICD file (the JSON that points the Vulkan loader at the driver), as the package lists it
icd() { dpkg -L "$PKG" 2>/dev/null | grep -m1 '/lvp_icd[^/]*\.json$'; }
# what keeps Chrome from lavapipe, or nothing
problem() {
  local f
  if ! dpkg -s "$PKG" 2>/dev/null | grep -qx 'Status: install ok installed'; then echo "$PKG is not installed"; return; fi
  f=$(icd)
  [ -n "$f" ] && [ -f "$f" ] || echo "$PKG is installed, but lavapipe's ICD file (${f:-none listed}) is missing"
}
refresh() { sudo timeout -k 5 "$NET_LIMIT_S" apt-get "${APT[@]}" update; }
# the files the image lacks, from the mirrors into ARCHIVES, then into DEBS (in place of what DEBS held)
download() {
  sudo find "$ARCHIVES" -maxdepth 1 -name '*.deb' -delete
  sudo timeout -k 5 "$NET_LIMIT_S" apt-get "${APT[@]}" install -y --download-only "$PKG" || return
  compgen -G "$ARCHIVES/*.deb" >/dev/null || { echo "apt downloaded no files"; return 1; }
  find "$DEBS" -maxdepth 1 -name '*.deb' -delete
  cp "$ARCHIVES"/*.deb "$DEBS"/
}
install_debs() { sudo dpkg -i "$DEBS"/*.deb; }

t0=$(us)
mkdir -p "$DEBS"
cached=$(find "$DEBS" -maxdepth 1 -name '*.deb' | wc -l | tr -d ' ')
source=
cause=
if [ -z "$(problem)" ]; then
  echo "$PKG: the image has it"
  source=image
else
  sudo install -d -m 755 "$ARCHIVES"
  sudo install -d -o _apt -m 700 "$ARCHIVES/partial"
  cache_note=", and the Actions cache had no copy for this image (${ImageOS:-?} ${ImageVersion:-?})"
  for ((i = 1; i <= ATTEMPTS; i++)); do
    if ((i > 1)); then
      wait_s=$((FIRST_WAIT_S << (i - 2)))
      echo "waiting $wait_s s before attempt $i"
      sleep "$wait_s"
      # (a refresh that fails is no verdict: the download says whether the mirrors answer)
      timed "attempt $i: refresh of the package lists" refresh
    fi
    if timed "attempt $i: download from the mirrors" download; then
      if timed "install of the downloaded files" install_debs; then source=mirror; else cause="dpkg could not install the files downloaded from the mirrors (its errors above)"; fi
      break
    fi
    if ((i == 1 && cached > 0)); then
      if timed "install of the $cached cached files" install_debs; then source=cache; break; fi
      cache_note=", and the cached files did not install (dpkg's errors above)"
    fi
  done
  [ -n "$source$cause" ] || cause="apt could not download it from Ubuntu's mirrors in $ATTEMPTS attempts (apt's errors above)$cache_note"
fi
echo "Mesa step: $(seconds "$t0")"
echo "source=$source" >>"${GITHUB_OUTPUT:-/dev/null}"
p=$(problem)
if [ -n "$p" ]; then
  echo "::error title=Mesa (lavapipe)::$p${cause:+: $cause}. Without lavapipe, Chrome has no Vulkan driver and no WebGL2, and the browser suites cannot run."
  exit 1
fi
echo "$PKG $(dpkg-query -W -f '${Version}' "$PKG") from the $source; lavapipe's ICD: $(icd)"
