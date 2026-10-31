# Phone layout sweeps

Two command files for the CDP daemon (`test/cdp_kit`, see its README) that measure, on a phone, every visible control
for: under 44 px (`small`), covered at its centre by another element (`covered`), outside the viewport (`offs`) and
overlapping another control (`overl`), on the home view, a three-step chain and the Tools, Display, More, Edit, Chain
and Numbers sheets, in en, ru and it.

- `phone_portrait_sweep.js`: 360×740, 390×844, 412×915.
- `phone_landscape_sweep.js`: 740×360 and 915×412 (and 844×390).
- `diff_sweeps.py before.json after.json`: what the second run has that the first lacks.

Run (from a worktree with `dist/` built; `test/au_cdp` is a copy of `test/cdp_kit`):

    node test/au_cdp/q.js tools/sweeps/phone_portrait_sweep.js > before.json
    node test/au_cdp/q.js tools/sweeps/phone_landscape_sweep.js > before_land.json

They read `http://localhost:8793/test.html` (the harness's static server on `dist/`) and save screenshots (`<size>-<lang>-<surface>.png`) through the kit. To add a surface, add a `Phone.open('<sheet>')` step to the loop at the end of the file and measure with `MEASURE`.

Notes from using them:
- The "Hold and slide to read F(z)" hint is shown once per session (`sessionStorage` `cmw-probe-taught`); a run that follows another in the same tab sees the readout narrower. Clear the key, or compare runs from fresh origins.
- `covered` also counts the toolbar behind an open sheet; compare against a previous run rather than reading it alone.
- MathJax does not load in a sandbox without network: copy `dist/test.html` to a page that loads `vendor/js/tex-svg.js` to see typeset TeX.
