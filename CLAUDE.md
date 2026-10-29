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
  - creates task-specific worker agents, choosing each one's model and thinking level to suit the task (e.g. Opus
    at high effort for cross-cutting or numerical work, Sonnet for well-scoped UI, test or docs tasks);
  - gives each worker its issue with the context it needs;
  - has workers review each other's PRs, and answers their questions;
  - keeps the board current.

  When something breaks, it diagnoses only as far as needed to brief a worker, and the worker writes the fix.
- **Workers** each own one issue or task at a time:
  - they claim it on GitHub, work on their own branch and open the PR;
  - they report to their orchestrator, and ask it when a decision is not theirs;
  - they don't merge into shared branches.
- **Alexander's orchestrator owns the waves**:
  - it merges ready PRs from both teams into the integration branch, resolving only the generated tables and
    trivial overlaps (anything else goes back to the PR's worker);
  - it runs the wave's gate, merges it into `main` and deploys the release.
- **Pietro's orchestrator** runs his workers the same way. It talks to Alexander's orchestrator on the wave board
  and in PR comments.
- **Product decisions belong to Alexander**, asked on the issue. Pietro decides his own areas (sound, Italian, the
  Windows GPU runner).

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
- Only Alexander's orchestrator does these: merge into the integration branch or `main`, push tags, or run the Pages
  deploy.
- While a wave's gate runs, work on the next issues from the integration head. After the wave merges, merge the
  integration branch into your branch.
- **Freezes** are announced on the board. During the switch to ES modules (#20 phase 4), no `src/` PR merges.
  Afterwards, bring a branch over with the notes in that PR.

## 5. Talking to each other
- About a PR: comment on the PR.
- Coordination (claims, waves, freezes): comment on the wave board.
- Product decisions belong to Alexander. Ask on the issue.
