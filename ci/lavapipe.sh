#!/usr/bin/env bash
# Mesa's Vulkan drivers (the package mesa-vulkan-drivers) for the browser jobs (gate.yml): its lavapipe is the Vulkan
# driver that Chrome's ANGLE draws WebGL2 with on GitHub's Linux machines. The job keeps the package's files in an
# Actions cache, for when the mirrors cannot be reached.
#   ci/lavapipe.sh --key   prints the step outputs key, the cache key (the runner's image, ImageOS and ImageVersion,
#                          and the package's version in the image's own package lists), and version, that version
#   ci/lavapipe.sh DIR     installs the package; DIR holds the cached .deb files (the job restores them before, and
#                          saves them after an install from a mirror of the version in the key)
# The install takes the first of these that gives the package:
#   1. a download from Ubuntu's mirrors with the image's own package lists (fast: no refresh);
#   2. the files in DIR;
#   3. a download from FALLBACK_MIRROR, a mirror on another domain, with package lists of its own, of the version that
#      the image's lists name (the version in the cache key). Each pocket's package list names only its newest version,
#      so after a Mesa update, until GitHub's image has it, that version is in none of the fallback's lists and this
#      download fails (apt: "Version ... was not found");
#   4. RETRIES more downloads from Ubuntu's mirrors, each after a wait (FIRST_WAIT_S, doubled each time) and a refresh
#      of the image's lists. These take the refreshed lists' version, which after a Mesa update is newer than the one
#      in the cache key: the job then does not save the files (gate.yml compares the step outputs version).
# A download is installed with dpkg, and DIR then holds exactly the files fetched. Each apt call that uses the network
# is stopped at its time limit, and an attempt whose refresh was stopped downloads nothing: with no mirror answering and
# no cache, the step ends within 2 minutes, and within 3 when every refresh answers and every download hangs. Each
# part's time goes to the log, and to $GITHUB_OUTPUT go source=image|mirror|fallback|cache (image: the image had the
# package; mirror: Ubuntu's mirrors) and version, the version installed (dpkg-query). Exits 1 with an error annotation
# that names the cause when, at the end, the package is not installed (dpkg -s) or lavapipe's ICD file is missing:
# Chrome would have no Vulkan driver, and so no WebGL2.
set -u
PKG=mesa-vulkan-drivers
# (test/t_lavapipe.js puts the folders below and the release file under a folder of its own, CMW_LAVAPIPE_ROOT)
ROOT=${CMW_LAVAPIPE_ROOT:-}
# apt's download folder for this package alone, so that after a download it holds exactly the files fetched; its
# partial/ belongs to _apt, as apt's sandbox expects
ARCHIVES=$ROOT/var/cache/apt/cmw-lavapipe
# the fallback mirror's sources file and package lists, apart from the runner's own
FALLBACK_STATE=$ROOT/var/lib/apt/cmw-lavapipe-fallback
# The fallback: kernel.org's mirror of Ubuntu's archive, whose host is not under ubuntu.com, so that a failure of
# *.ubuntu.com's DNS, which takes all of Ubuntu's own mirrors at once, leaves it. Ubuntu's list of archive mirrors
# (Launchpad) has it once, as "Kernel.org", official and up to date, at mirrors.us.kernel.org for http, ftp and rsync;
# this name, kernel.org's front for its mirrors, is not on the list, and serves the archive over HTTPS. Neither list
# nor host is what keeps the files intact: apt checks the mirror's InRelease against Ubuntu's archive keyring, as for
# Ubuntu's own mirrors, so the mirror cannot alter a file.
FALLBACK_MIRROR=https://mirrors.edge.kernel.org/ubuntu
FALLBACK_NAME=${FALLBACK_MIRROR#https://} # (for the log)
UBUNTU_KEYRING=/usr/share/keyrings/ubuntu-archive-keyring.gpg
RETRIES=2
FIRST_WAIT_S=10
DOWNLOAD_LIMIT_S=15 # a download (about 18 MB: seconds when a mirror answers)
LIST_LIMIT_S=25     # a refresh of the package lists
KILL_GRACE_S=5      # from the limit to SIGKILL, for an apt call that SIGTERM does not stop
# (apt does not retry by itself: the attempts below do, and an apt that retries a file the mirrors cannot serve logs a
# warning per try)
APT=(-qq -o Acquire::Retries=0 -o "Dir::Cache::Archives=$ARCHIVES")
# the fallback mirror's apt options: its own sources file and lists, and no package cache file (the runner's own one
# stays as its sources made it)
FALLBACK_APT=(-o "Dir::Etc::sourcelist=$FALLBACK_STATE/fallback.sources" -o Dir::Etc::sourceparts=- -o "Dir::State::Lists=$FALLBACK_STATE/lists" -o Dir::Cache::pkgcache= -o Dir::Cache::srcpkgcache=)

version=$(apt-cache policy "$PKG" | awk '/Candidate:/ { print $2 }')
if [ "${1:-}" = --key ]; then
  # (a cache key may not hold a comma: anything but letters, digits and . _ + ~ - becomes _)
  echo "key=$(printf '%s' "lavapipe-${ImageOS:-unknown}-${ImageVersion:-unknown}-$version" | tr -c 'A-Za-z0-9._+~-' '_')"
  echo "version=$version"
  exit 0
fi
DEBS=${1:?usage: ci/lavapipe.sh --key | ci/lavapipe.sh DIR}

# (microseconds; whole seconds on a bash older than 5, which has no EPOCHREALTIME)
us() { local t=${EPOCHREALTIME:-$(date +%s).000000}; echo "${t/[.,]/}"; }
seconds() { local d=$(($(us) - $1)); printf '%d.%d s' $((d / 1000000)) $((d / 100000 % 10)); }
# stopped STATUS: whether a call under timeout was stopped at its limit (124; 137 after SIGKILL)
stopped() { [ "$1" = 124 ] || [ "$1" = 137 ]; }
# timed LABEL COMMAND...: runs COMMAND and logs LABEL with its outcome and time; returns COMMAND's status
timed() {
  local label=$1 t status outcome=ok
  shift
  t=$(us)
  "$@"
  status=$?
  if stopped "$status"; then outcome="no answer, stopped at its time limit (exit $status)"; elif [ "$status" != 0 ]; then outcome="failed (exit $status)"; fi
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
# apt_net FROM LIMIT ARGS...: apt-get ARGS with FROM's lists (mirror: the image's; fallback: the fallback mirror's),
# stopped at LIMIT seconds; counts the calls, those stopped (hung) and those apt ended with an error (failed)
calls=0
hung=0
failed=0
apt_net() {
  local from=$1 limit=$2 status
  shift 2
  [ "$from" = fallback ] && set -- "${FALLBACK_APT[@]}" "$@"
  calls=$((calls + 1))
  sudo timeout -k "$KILL_GRACE_S" "$limit" apt-get "${APT[@]}" "$@"
  status=$?
  if stopped "$status"; then hung=$((hung + 1)); elif [ "$status" != 0 ]; then failed=$((failed + 1)); fi
  return "$status"
}
# download FROM SPEC: the files the image lacks for SPEC, from FROM's mirror into ARCHIVES, then into DEBS (in place of
# what DEBS held); counts the downloads that apt ended without an error but with no files (empty)
empty=0
download() {
  sudo find "$ARCHIVES" -maxdepth 1 -name '*.deb' -delete
  apt_net "$1" "$DOWNLOAD_LIMIT_S" install -y --download-only "$2" || return
  compgen -G "$ARCHIVES/*.deb" >/dev/null || { echo "apt downloaded no files"; empty=$((empty + 1)); return 1; }
  find "$DEBS" -maxdepth 1 -name '*.deb' -delete
  cp "$ARCHIVES"/*.deb "$DEBS"/
}
install_debs() { sudo dpkg -i "$DEBS"/*.deb; }
# the fallback mirror's sources: the image's release with its updates and security pockets, main only (a package in
# main depends only on packages in main), the Packages lists alone, signed by Ubuntu's archive key
fallback_sources() {
  local codename
  codename=$(sed -n 's/^VERSION_CODENAME=//p' "$ROOT/etc/os-release")
  printf '%s\n' 'Types: deb' "URIs: $FALLBACK_MIRROR" "Suites: $codename $codename-updates $codename-security" 'Components: main' \
    "Architectures: $(dpkg --print-architecture)" 'Targets: Packages' "Signed-By: $UBUNTU_KEYRING"
}
# attempt FROM REFRESH: one more attempt at the package, from FROM (mirror: Ubuntu's mirrors, with the image's lists and
# their candidate, refreshed or not; fallback: the fallback mirror, with its lists and the image's version, which they
# lack after a Mesa update until the image has it). With REFRESH (yes), FROM's lists are refreshed first, and when that
# is stopped at its limit nothing is downloaded. Returns 1 when nothing was downloaded; otherwise installs the files and
# sets source, or cause when dpkg cannot install them.
attempts=0
attempt() {
  local from=$1 refresh=$2 where="Ubuntu's mirrors" spec=$PKG status
  attempts=$((attempts + 1))
  if [ "$from" = fallback ]; then where="the fallback mirror ($FALLBACK_NAME)" spec="$PKG=$version"; fi
  if [ "$refresh" = yes ]; then
    timed "attempt $attempts: refresh of the package lists of $where" apt_net "$from" "$LIST_LIMIT_S" update
    status=$?
    if stopped "$status"; then echo "attempt $attempts: no download after a refresh that got no answer"; return 1; fi
  fi
  timed "attempt $attempts: download of $spec from $where" download "$from" "$spec" || return 1
  if timed "install of the downloaded files" install_debs; then source=$from; else cause="dpkg could not install the files downloaded from $where (its errors above)"; fi
}
# why no mirror gave the package: the time limits when every apt call was stopped at its limit; otherwise how many
# calls apt ended with an error (its errors are in the log), how many were stopped, how many downloads ended without an
# error but with no files, and how many refreshes ended without an error (this runs only when no download gave files,
# so every download is in one of the first three counts, and the calls left are refreshes)
no_download() {
  local mirrors="Ubuntu's mirrors and $FALLBACK_NAME" limits="$DOWNLOAD_LIMIT_S s for a download and $LIST_LIMIT_S s for a refresh of the lists"
  local refreshed=$((calls - failed - hung - empty)) what=() text='' part
  if ((hung == calls)); then
    echo "no mirror answered in any of $attempts attempts ($mirrors): each of the $calls apt calls was stopped at its time limit, $limits"
    return
  fi
  ((failed == 0)) || what+=("$failed ended with an error (apt's errors above)")
  ((hung == 0)) || what+=("$hung got no answer within the time limit ($limits)")
  ((empty == 0)) || what+=("$empty ended without an error but downloaded no files")
  if ((refreshed == 1)); then what+=("1, a refresh of the lists, ended without an error"); elif ((refreshed > 1)); then what+=("$refreshed, refreshes of the lists, ended without an error"); fi
  for part in "${what[@]}"; do text+="${text:+; }$part"; done
  echo "apt could not download it in $attempts attempts from $mirrors: of the $calls apt calls, $text"
}

t0=$(us)
mkdir -p "$DEBS"
cached=$(find "$DEBS" -maxdepth 1 -name '*.deb' | wc -l | tr -d ' ')
source=
cause=
if [ -z "$(problem)" ]; then
  echo "$PKG: the image has it"
  source=image
else
  sudo install -d -m 755 "$ARCHIVES" "$FALLBACK_STATE/lists"
  sudo install -d -o _apt -m 700 "$ARCHIVES/partial" "$FALLBACK_STATE/lists/partial"
  fallback_sources | sudo tee "$FALLBACK_STATE/fallback.sources" >/dev/null
  cache_note=", and the Actions cache had no copy for this image (${ImageOS:-?} ${ImageVersion:-?})"
  if ! attempt mirror no; then
    if ((cached > 0)); then
      if timed "install of the $cached cached files" install_debs; then source=cache; else cache_note=", and the cached files did not install (dpkg's errors above)"; fi
    fi
    if [ -z "$source" ] && ! attempt fallback yes; then
      for ((r = 0; r < RETRIES; r++)); do
        wait_s=$((FIRST_WAIT_S << r))
        echo "waiting $wait_s s before attempt $((attempts + 1))"
        sleep "$wait_s"
        attempt mirror yes && break
      done
    fi
  fi
  [ -n "$source$cause" ] || cause="$(no_download)$cache_note"
fi
echo "Mesa step: $(seconds "$t0")"
installed=$(dpkg-query -W -f '${Version}' "$PKG" 2>/dev/null)
printf '%s\n' "source=$source" "version=$installed" >>"${GITHUB_OUTPUT:-/dev/null}"
p=$(problem)
if [ -n "$p" ]; then
  echo "::error title=Mesa (lavapipe)::$p${cause:+: $cause}. Without lavapipe, Chrome has no Vulkan driver and no WebGL2, and the browser suites cannot run."
  exit 1
fi
echo "$PKG $installed (source: $source); lavapipe's ICD: $(icd)"
case $source in
  mirror | fallback) [ "$installed" = "$version" ] || echo "$installed is not $version, the version in the image's lists and in the cache key: the job does not save these files to the cache" ;;
esac
