#!/usr/bin/env bash
# The newest Gate run of a pull request on a commit, other than the one running now (gate.yml, the job ready: a PR's
# own run on this commit, or the run of the PR above it in a stack):
#   ci/gate_run_of.sh SHA PR
# Prints "<run id> <status> <conclusion>", or "none", or "error (the look-up failed)". Exits 0 when that run passed or is
# still going (the caller mirrors it: nothing runs again and the Gate job carries its verdict), 1 otherwise.
set -u
sha=$1; pr=$2
other=$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/gate.yml/runs?head_sha=$sha&per_page=100" \
  --jq "[.workflow_runs[] | select(.id != $GITHUB_RUN_ID and ((.pull_requests // []) | any(.number == $pr)))] | sort_by(.created_at) | last | if . == null then \"none\" else \"\\(.id) \\(.status) \\(.conclusion // \"\")\" end") || other="error (the look-up failed)"
echo "$other"
case "$other" in
  *" completed success"|*" queued "|*" in_progress "|*" waiting "|*" requested "|*" pending ") exit 0 ;;
  *) exit 1 ;;
esac
