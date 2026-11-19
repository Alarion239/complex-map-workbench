# #1937 design A prototype (WIP, not for merging)

Design A of the #1937 glide study: λ-skeletons, one inverse program per plane, the closed-form cubic (CUB) and cos's
zoom path. `REPORT-design-A.md` is the designer's report; the decision page is
https://claude.ai/artifact/RETdeEzf1ayvKSMxAexM5n and Alexander's answers are on #1937 (comment 7002516868).

- The `src/` changes are the prototype as measured. They carry debug flags and are a starting point for the PRs
  (build plan in the report, section 3), not code to merge.
- Probes: copy `zz_glides_probe_cmd.js` (and `zz_glides_links_cmd.js`) into `test/` locally, never commit them there;
  `run_probe.sh TAG lvp|ss case,case` runs one (set REPO and GP_OUT), `strips.py DIR TAG` makes strips and metrics.
  Lavapipe needs `mesa-vulkan-drivers` installed in the container.
