# Headless Chrome harness (real WebGL2 via ANGLE Metal; on Windows ANGLE Direct3D 11; on Linux SwiftShader)

On Windows (or anywhere without zsh) use `node test/<you>_cdp/q.js /path/to/cmd.js` in place of `q.sh`; `CHROME_BIN`
overrides the browser's path, `CMW_ANGLE` its ANGLE back end and `CMW_CHROME_ARGS` adds flags (ci/README.md). CI runs
every suite this way, each in a fresh copy on its own port: `node ci/browser.js` (ci/README.md, Browser suites).

The in-app Browser pane currently has no WebGL2, so GPU views must be tested here.

1. Copy this folder to your own directory: `cp -R test/cdp_kit test/<you>_cdp` (never share a folder: the queue is per folder).
2. Start the daemon in the background: `node test/<you>_cdp/cdpd.js` (Bash run_in_background). Wait for `test/<you>_cdp/q/READY`.
3. Run a command file: `test/<you>_cdp/q.sh /path/to/cmd.js` prints the JSON result. The file is the BODY of an async
   function with these helpers in scope: `ev(expr)` (evaluate in the page, returns the value), `nav(url)`,
   `view(w, h, dark, mobile)`, `shot(name, clip?)` (PNG saved to `<folder>/shots/<name>.png`, view it with Read),
   `key(k, mods)` (mods: 1 Alt, 2 Ctrl, 4 Meta, 8 Shift), `type(text)`, `click(x, y)`, `move(x, y)`, `drag(x0, y0, x1, y1, n, dt)`,
   `clickSel(css)`, `load(ns, state)` (writes a saved state for ?ns=<ns> and opens the app), `loadView(view, ns, state, { lang })` (the same, with the app's first load in 'classic' or 'steps' whatever the pin is), `logs()` (console + exceptions
   since the last call), `send(method, params)` (raw CDP), `sleep(ms)`.
   Instead of a fixed sleep (#504): `go(url)` navigates and waits for the page's load event (a change of the hash
   alone fires none: `go` then waits its 15 s and logs it, so use `nav` or `ev` for that); `settled({ until, floor,
   max, panes })` waits until two animation frames find the page loaded, neither pane's GPU frame pending or
   compiling (unless `panes: false`), no finite animation running and `until` (an expression) true, at most `max` ms
   (8000), and answers `{ ok, ms, busy }`.
   window.__qa (qa_inject.js) has helpers: lamps(), cards(), state(), toasts(), frames(ms), txt(sel), vis(sel).
   Every page opens in the classic view (pin_view.js, #443): add `&view=steps` to the URL for the steps view.
4. Always open the app as http://localhost:8793/test.html?ns=<your-name> (namespaced storage).
5. Stop the daemon at the end: `touch test/<you>_cdp/q/QUIT`.
