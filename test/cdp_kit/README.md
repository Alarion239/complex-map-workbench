# Headless Chrome harness (real WebGL2 via ANGLE Metal; on Windows ANGLE Direct3D 11; on Linux SwiftShader)

On Windows (or anywhere without zsh) use `node test/<you>_cdp/q.js /path/to/cmd.js` in place of `q.sh`; `CHROME_BIN`
overrides the browser's path, `CMW_ANGLE` its ANGLE back end, `CMW_CHROME_ARGS` adds flags (ci/README.md) and `CMW_DPR`
sets the device pixel ratio `view()` emulates (1 by default; 2 as on the Mac's screen). CI runs
every suite this way, each in a fresh copy on its own port: `node ci/browser.js` (ci/README.md, Browser suites).

The in-app Browser pane currently has no WebGL2, so GPU views must be tested here.

1. Copy this folder to your own directory: `cp -R test/cdp_kit test/<you>_cdp` (never share a folder: the queue is per folder).
2. Start the daemon in the background: `node test/<you>_cdp/cdpd.js` (Bash run_in_background). Wait for `test/<you>_cdp/q/READY`.
3. Run a command file: `test/<you>_cdp/q.sh /path/to/cmd.js` prints the JSON result. The file is the BODY of an async
   function with these helpers in scope: `ev(expr)` (evaluate in the page, returns the value; a promise the expression returns is awaited, and a rejection or a promise still pending after the timeout answers `{ __exc }`), `nav(url)` (navigates and waits for the load event, for the app's page its start-up and quiet, and through the reload of a `#cmw=` link),
   `view(w, h, dark, mobile)`, `shot(name, clip?)` (PNG saved to `<folder>/shots/<name>.png`, view it with Read),
   `key(k, mods)` (mods: 1 Alt, 2 Ctrl, 4 Meta, 8 Shift), `type(text)`, `click(x, y)`, `move(x, y)`, `drag(x0, y0, x1, y1, n, dt, rel)` (rel `{ x, y, moves }`: the release point and how many of the n moves are sent),
   `clickSel(css)`, `choose(css, value)` (the steps view's Speed or Order button set through its menu), `load(ns, state, extra, view, { limitMs, stallMs, origin })` (writes a saved state for ?ns=<ns>, opens the app and waits until it has built the saved chain; throws after `limitMs`, 60 s, naming the page's state when it is not ready, and opens a stalled document again after `stallMs`, 15 s; `origin` names another server for the pages),
   `loadView(view, ns, state, { lang })` (the same, with the app's first load in 'classic' or 'steps' whatever the pin is; with no
   view, in the pinned view), `seed(ns, state)` (only the saved state, written from the helper page), `isSteps()` (whether the page
   shows the steps view),
   `logs()` (console + exceptions
   since the last call; the daemon's own `cdp` entries name the navigations and crashes it saw), `forgetCause()` (forgets the last one, for a check that a failure with none says so; a call the page went under fails with `[method: the event that came first]` appended), `send(method, params)` (raw CDP), `sleep(ms)`.
   Instead of a fixed sleep (#504): `go(url)` navigates and waits for the page's load event (a change of the hash
   alone fires none: `go` then waits its 15 s and logs it, so use `nav` or `ev` for that; a document whose body stops arriving
   is opened again after 5 s, at most twice); `settled({ until, floor,
   max, panes })` waits until two animation frames find the page loaded, neither pane's GPU frame pending or
   compiling (unless `panes: false`), no finite animation running and `until` (an expression) true, at most `max` ms
   (8000), and answers `{ ok, ms, busy }`.
   A frame held with `__cmwSteps({ x })` (a scrub not let go) keeps `__cmwSteps().moving` true on every surface, plane, Sphere
   and Landscape alike: never wait on `!__cmwSteps().moving` after a held `x`. The wait for a held frame is
   `__cmwSteps().ready.ready` (the frame's programs linked and warm) as `settled`'s `until`, with its pane checks left on.
   A glide run to its end (`go`) does end with `moving` false.
   window.__qa (qa_inject.js) has helpers: lamps(), state(), toasts(), frames(ms), txt(sel), vis(sel).
   Every page opens in the steps view (pin_view.js, #443): add `&view=classic` to the URL for the classic view (or run with `CMW_VIEW=classic`).
4. Always open the app as http://localhost:8793/test.html?ns=<your-name> (namespaced storage).
5. Stop the daemon at the end: `touch test/<you>_cdp/q/QUIT`.
