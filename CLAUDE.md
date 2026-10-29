# Working on this repository with Claude

Several Claude agents work here at the same time, in two teams: Alexander's and Pietro's. Everything reaches `main`
through **waves**. Follow this file so that two agents never work on the same issue and every change lands through
the same gate.

**The wave board** is issue #236. It says which wave is in its gate, what goes into
the next one, who has claimed which issue, and when a freeze is on. Read it before you start anything.

## 0. Who does what
Each team has the same hierarchy.
- **One orchestrator**, a Claude session at maximum effort, **coordinates and does no issue work itself**. It:
  - reads the issues, the board and CI;
  - decides what to do next;
  - creates task-specific worker agents, choosing each one's model and thinking level to suit the task. Use the
    cheapest model that does the task well: Sonnet for well-scoped UI, test, docs and issue work, Opus at high
    effort for cross-cutting, numerical or architectural work. Quality comes first: when in doubt, Opus;
  - gives each worker its issue with the context it needs;
  - has workers review each other's PRs, and answers their questions;
  - keeps the board current.

  When something breaks, it diagnoses only as far as needed to brief a worker, and the worker writes the fix.
- **Workers** each own one issue or task at a time:
  - they claim it on GitHub, work on their own branch and open the PR;
  - they report to their orchestrator, and ask it when a decision is not theirs;
  - they don't merge into shared branches.
- **The issue agent** (a worker of Alexander's team, Sonnet) keeps the issue list:
  - it files issues for what anyone notices but should not do now (any agent may ask it, or file the issue
    directly);
  - it deduplicates, links related issues and researches them, including on the web, for example for
    performance;
  - it proposes the next waves to the orchestrator: which issues go together, in what order, how big each is, and
    which model suits each.

  The orchestrator decides whom to hire for each.
- **Alexander's orchestrator owns the waves and the runs**, on Alexander's account (Alarion239), which has the most
  usage and the permissions on runs:
  - it merges ready PRs from both teams into the integration branch, resolving only the generated tables and
    trivial overlaps (anything else goes back to the PR's worker);
  - it opens each wave PR into `main` and runs its full gate, with any re-runs;
  - it dispatches the GPU-gate runs (Alexander approves them);
  - it merges into `main` and deploys the release.

  Pietro's team pushes PRs into the integration branch, where they run their own tier, and asks on the board for
  anything that needs a full gate or a GPU run.
- **Pietro's orchestrator** runs his workers the same way. It talks to Alexander's orchestrator on the wave board
  and in PR comments.
- **Product decisions belong to Alexander**, asked on the issue. Pietro decides his own areas (sound, Italian, the
  Windows GPU runner).
- **The Mac GPU runner (`mac-gpu`)** is Alexander's: report a problem with it in an issue labelled `mac-runner`, which
  Alexander's local agent on the Mac picks up.

## 1. Claim an issue before you start
- Take an open issue that nobody has claimed:
  - no claim comment on it;
  - no open PR that names it (`Fixes #N` or `Part of #N`);
  - not assigned to a person. #60 and #169 are Pietro's; #62 and the real-phone checks are Alexander's.
- Claim it with one comment on the issue: `Claimed by <team> (<agent>): <one-line plan>`. The team is "Alexander's
  team" or "Pietro's agent". If you stop, say so in a comment.
- A new idea gets an issue first, then a claim.
- A claim with no activity for a day can be taken over, after asking on the issue.

## 2. Branch and pull request
- Branch from the integration branch `claude/funny-darwin-l5uis3`, not from `main`. One issue per branch and per PR.
- Open the PR as a **draft into `claude/funny-darwin-l5uis3`**. Its body says `Fixes #N` (or `Part of #N`), what
  changed and what you ran.
- Keep the branch current by merging the integration branch into it. Use merge commits. Never rebase or force-push a
  branch someone else may have.
- Translations: edit only `tools/ru_extra.json` and `tools/it_table.json`, then regenerate:
  - `python3 tools/make_ru_table.py --strict`
  - `python3 tools/make_it_table.py`

  On a conflict, merge the two JSON files key by key and regenerate. Never hand-merge `src/i18n_*.js`.
- New browser suites go into `ci/browser_shards.js`. Any not listed there run in its catch-all shard. New GLSL test
  chains go at the end of their list, so no other chain changes part.

## 3. Check it yourself, then mark it ready
- Run what your change touches, as `CONTRIBUTING.md` and `ci/README.md` describe:
  - `node ci/unit.js`;
  - the lint ratchet: `npx eslint -f json . > es.json; npm run -s typecheck > tsc.txt; node ci/lint_ratchet.js check es.json tsc.txt`. It must not go up;
  - `ruff check`;
  - your area's browser suites (`node ci/browser.js --only …`);
  - for shader changes, the GLSL pages paired with the integration head (`node ci/glsl.js --filter … --ref …`).
- When it is ready for a wave, mark the PR **Ready for review**. It keeps its base, the integration branch. That is
  the signal for Alexander's orchestrator.
- The hosted CI runners are shared, and a queue of runs delays everyone's gate:
  - push when the work is ready, not every commit;
  - don't re-run whole gates;
  - runs on the GPU machines (`gpu-gate.yml`) wait for Alexander's approval.

## 4. Waves
- Alexander's orchestrator merges the ready PRs of both teams into the integration branch. Then one wave PR goes into
  `main` and its full gate runs.
- What breaks goes back to a worker: the PR's own worker when it is that PR's code (Pietro's orchestrator for his),
  or a new worker the orchestrator creates for it. The fix comes back as a PR, and the wave merges when the gate is
  green.
- Each merged wave is a release, deployed to the live page by hand: `v17.0-beta.N` is wave N, then `v17.0` and
  `v17.x`.
- Only Alexander's orchestrator merges into the integration branch or `main` and runs the Pages deploy. The tag for each
  release is pushed by Alexander: the orchestrator's session cannot push tags.
- While a wave's gate runs, work on the next issues from the integration head. After the wave merges, merge the
  integration branch into your branch.
- **Freezes** are announced on the board. During the switch to ES modules (#20 phase 4), no `src/` PR merges.
  Afterwards, bring a branch over with the notes in that PR.

## 5. Talking to each other
- About a PR: comment on the PR.
- Coordination (claims, waves, freezes): comment on the wave board.
- Product decisions belong to Alexander. Ask on the issue.

## 6. Usage limits: hand the work over, don't strand it
Any agent can run out of usage in the middle of a task. As soon as you see a usage warning, or before you stop:
1. **Push what you have** to your branch, unfinished work included. A draft PR may hold WIP commits. If there is no
   PR yet, open a draft so the work can be seen.
2. **Mark the PR as handed off:** add the label `handoff`. If you can't add labels, start the PR's title with
   `[handoff] `.
3. **Write a handoff comment on the PR:**
   - what is done;
   - what is left, as a checklist;
   - how to check it (the commands and suites);
   - anything you could not push.
4. **Release the claim:** on the issue, comment `Released: <team> (<agent>) is out of usage; handoff notes on #<PR>`.
5. Tell your orchestrator. If it blocks a wave, say so on the board too.

Taking a handed-off PR over:
- Any agent of either team may take over a `handoff` PR. Comment `Taking over from <agent>` on the PR and on the issue,
  remove the label or the title prefix, and go on from the handoff checklist.
- Continue on the same branch with merge commits. Never rebase or force-push someone else's branch.
- If you can't push to that branch, branch from its head and open a new PR that says it supersedes the old one. Link
  both, and the old one is closed when the new one merges.
- An agent coming back from a limit checks for a takeover before it resumes.

An orchestrator that runs low:
- It pushes its integration work. Nothing is left merged only in its own checkout.
- It brings the board's "Now" section up to date: the wave, what is in it, what runs, what is pending.
- It comments on the board `Orchestrator out of usage until <time>`.
- The other team's orchestrator, or a fresh session started from the board, can then carry on. A fresh session
  for Alexander's team reads this file, the board and the open PRs first.
