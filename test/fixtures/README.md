# Fixtures

## classic_d49396c2_save.json and classic_d49396c2_link.txt

These are a saved state and a link written by the classic build at commit d49396c2, the parent of the saves change
(#436, commit 764274d6). The steps view must open both on the same picture; test/steps_classic_fixture_cmd.js checks it.

- `classic_d49396c2_save.json`: that build's own settled save (its localStorage text, sorted keys) of a state with three
  steps, a formula area, a selected step (2), a solo right pane and a right-pane camera. The build drops `homRange` and
  `figMorph` on its own save, since those came later.
- `classic_d49396c2_link.txt`: the same state as a link, `1.` followed by base64url of deflate-raw `{v:1, s}`. It is
  encoded with that build's codec, which is identical to the current `encodeLink` and `b64u` in `src/params.js`. It is not
  copied from the build's Copy-link button: the build exposes no hook to that path.

How they were made: the build was checked out at d49396c2 in a scratch worktree and built; a page was seeded with the
state in localStorage before the app's script ran, and the build's settled save was read back.
