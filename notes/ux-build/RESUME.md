# Wave 1: stopped by the user on 2026-10-26 at 20:06; RESUMED 2026-10-26 23:40, again 10-27 04:28 and 09:28 (task w1xikf5su)

The user: "Please, stop them. We will continue later, when the usage limits reset. Gracefully stop with an ability to continue later."

## State
- Workflow run wf_94c3e9e8-acf (script copy: notes/workflows/cmw-ux-wave1-r2.js; persisted script: <persisted script>).
- Done and cached in the run: design:rail -> notes/ux-build/rail/SPEC.md.
- Stopped mid-build (partial work kept in their folders; each wrote a partial AS-BUILT):
  build:chain (work/xu1-chain), build:phone (work/xu1-phone), build:plane (work/xu1-plane), build:learn (work/xu1-learn), build:rail (work/xu1-rail).
  The four first pieces were already resumed once (cut off at 15:20 by the usage limit, then restarted at 18:30).
- Not started: merge, the three reviews (user, regress, rail), fix and freeze (work/xu1-final-snap).
- Clean-up done: no browser daemon or server left; the Chrome profiles in work/xu1-*/test/*_cdp deleted (screenshots kept).

## To continue
1. In the persisted script, add ${CUT('rail')} to the build:rail prompt (the rail builder was stopped too). The other four
   prompts already carry the cut-off note; it now applies to their second partial run as well.
2. Workflow({scriptPath: <persisted script>, resumeFromRunId: 'wf_94c3e9e8-acf', args: {root: <project root>}}):
   design:rail replays from the cache; the five builders start again on their partial work.
3. Then: v16.5 = merge(base work/xv164-merged-snap, ours notes/v16.4.1-candidate, theirs work/xu1-final-snap) -> smoke -> publish.
4. Wave 2 (D1-D12 + the day-sized items) on top of wave 1 -> v17; it must also solve the user's tour feedback
   (notes/UI_BACKLOG.md item 50, T1-T4).
