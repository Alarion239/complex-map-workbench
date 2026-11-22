// The test hook __cmwSet('srcView', v) moves plane z's camera as a pan or zoom does, meshing window included: clipWin
// (a NEWT op's ladder and the meshes are cut to it) follows the new view by the pan's own rule (sourceViewChanged.apply:
// re-centred on the left pane's box, rounded outward to 1e-4 of its size, when the box moved past 0.3 of the window's
// width or resized past 1.35), so a suite's picture is one a user reaches (#2177). The steps view on plane z with a
// half-plane on it:
// - the camera FAR window widths away: clipWin is the pane's new box, rounded;
// - a pan of SMALL of the width: clipWin kept (the pan's rule; steps_globe_key_cmd relies on it);
// - the camera zoomed in ZOOM times in place: clipWin is the new box;
// - the camera moved FAR away with { keepClip: true }: clipWin kept (the hook's option for a suite that wants the
//   window the scene came with).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views-2 shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const FAR = 10, SMALL = 0.1, ZOOM = 2;
// (Q: the rounding, a share of the box's size, with slack for the floating-point steps)
const Q = 2e-4;
const SRC = { cx: 0, cy: 0, s: 60 };
const shapes = [{ id: 'h1', ci: 0, visible: true, kind: 'halfplane', a: [0, 0], b: [1, 0] }];
await view(1200, 800, false, false);
await loadView('steps', 'svc' + Date.now(), { v3: true, v4: true, v5: true, v6: true, nextId: 50, srcView: SRC, shapes, steps: [{ type: 'pown', params: { n: 2 }, on: true }] });
await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && !!__cmwLook('h1', 'L') && __cmwLook('h1', 'L').stage === 0` });
// the camera set through the hook (o: its option), then clipWin and the left pane's box (css px from the pane's size)
const look = (v, o) => ev(`(() => { ${v ? `__cmwSet('srcView', ${JSON.stringify(v)}${o ? ', ' + JSON.stringify(o) : ''});` : ''}
  const k = __cmwLook('h1', 'L'), w = k.W / k.dpr, h = k.H / k.dpr, hw = w / 2 / k.view.s, hh = h / 2 / k.view.s;
  return { win: k.win, view: k.view, box: { x0: k.view.cx - hw, x1: k.view.cx + hw, y0: k.view.cy - hh, y1: k.view.cy + hh } }; })()`);
// win is box rounded outward: it holds the box, and no side is more than Q of the box's size past it
const follows = (r) => {
  const sz = Math.max(r.box.x1 - r.box.x0, r.box.y1 - r.box.y0), e = Q * sz;
  return r.win.x0 <= r.box.x0 + 1e-12 * sz && r.win.x0 >= r.box.x0 - e && r.win.x1 >= r.box.x1 - 1e-12 * sz && r.win.x1 <= r.box.x1 + e
    && r.win.y0 <= r.box.y0 + 1e-12 * sz && r.win.y0 >= r.box.y0 - e && r.win.y1 >= r.box.y1 - 1e-12 * sz && r.win.y1 <= r.box.y1 + e;
};
const same = (a, b) => ['x0', 'x1', 'y0', 'y1'].every((k) => a[k] === b[k]);
const rest = info.rest = await look(null);
const W = rest.win.x1 - rest.win.x0;
const far = info.far = await look({ cx: SRC.cx + FAR * W, cy: SRC.cy + FAR * W, s: SRC.s });
ok(`the camera ${FAR} window widths away: clipWin follows it (the pane's box, rounded)`, far.view.cx === SRC.cx + FAR * W && follows(far), far);
const W2 = far.win.x1 - far.win.x0;
const small = info.small = await look({ cx: far.view.cx + SMALL * W2, cy: far.view.cy, s: SRC.s });
ok(`a pan of ${SMALL} of the width: clipWin kept`, same(small.win, far.win), small);
const zoom = info.zoom = await look({ cx: small.view.cx, cy: small.view.cy, s: ZOOM * SRC.s });
ok(`zoomed in ${ZOOM} times in place: clipWin follows (the pane's box, rounded)`, follows(zoom), zoom);
const kept = info.kept = await look({ cx: SRC.cx, cy: SRC.cy, s: SRC.s }, { keepClip: true });
ok('the camera moved back with { keepClip: true }: clipWin kept', kept.view.cx === SRC.cx && same(kept.win, zoom.win), kept);
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, fails, info };
