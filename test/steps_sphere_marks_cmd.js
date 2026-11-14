// The steps view's globe marks (0, ∞, 1, i, −1, −i) over the picture, with Inside regions as with Everywhere (#1577).
// The default page at rest on plane z, on the Sphere, at 1440 x 900: every mark the globe draws at full ink (it faces
// the camera, n·v past 0.3) must show on the final frame. A page wrapper of the 2D context's fillText and strokeText
// records where the left pane writes each mark (its box in device px, the glyph and its halo) and can leave the marks
// out; the frame is drawn with the marks and again without them, and in each full-ink mark's box at least GLYPH_MIN
// pixels must differ by more than DIFF levels (held_frames' compare). Everywhere is the reference, where nothing is
// drawn over the marks; Inside regions draws the colour globe kept inside the regions in a pass of its own, which must
// not cover them. On the default page the "i" faces the camera inside a region, so it is required among the full-ink
// marks: a frame with no such mark fails.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
// (GLYPH_MIN: the least number of a mark's pixels its glyph and halo change, at dpr 1 (an "i" at GLOBE_MARK_PX changes
// about 60); DIFF: the levels of 255 by which a pixel must change to count; FULL_INK: the mark's alpha that counts as full
// ink (smoothstep(0.05, 0.3, n·v) at 1))
const GLYPH_MIN = 15, DIFF = 32, FULL_INK = 0.99;
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const QUIET_UNTIL = "window.__cmwSteps && __cmwSteps().ready.ready && !__cmwSteps().anim && !__cmwSteps().play && !(window.__cmwSphere && __cmwSphere().running) && GLR.pendingLinks === 0";
const quiet = () => settled({ max: 60000, until: QUIET_UNTIL });
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// the page's wrapper: __mk.seen[mark] = { x0, x1, y0, y1, a } for each mark the left pane wrote in the last frames;
// __mk.on false leaves the marks out
const WRAP = `(() => {
  if (window.__mk) return 1;
  const M = new Set(['0', '∞', '1', 'i', '−1', '−i']), P = CanvasRenderingContext2D.prototype;
  window.__mk = { on: true, seen: {} };
  for (const fn of ['fillText', 'strokeText']) {
    const f = P[fn];
    P[fn] = function (t, x, y, ...rest) {
      if (this.canvas.id === 'canvasL' && M.has(t)) {
        const m = this.getTransform(), w = this.measureText(t).width, px = parseFloat((/([\\d.]+)px/.exec(this.font) || [0, 16])[1]);
        const X = m.a * x + m.c * y + m.e, Y = m.b * x + m.d * y + m.f, hw = (w / 2 + 3) * m.a, hh = (px / 2 + 3) * m.d;
        __mk.seen[t] = { x0: Math.floor(X - hw), x1: Math.ceil(X + hw), y0: Math.floor(Y - hh), y1: Math.ceil(Y + hh), a: this.globalAlpha };
        if (!__mk.on) return undefined;
      }
      return f.call(this, t, x, y, ...rest);
    };
  }
  return 1;
})()`;
// the frame drawn again (the thread set where it is), once it settles
const redraw = async () => {
  await ev('__cmwSteps({ x: __cmwSteps().x }), 1');
  await ev('await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), 1');
  await quiet();
};
// in each recorded mark's box, the pixels of the kept frames a and b more than DIFF apart
const changed = (a, b) => ev(`(() => {
  const A = window.__heldPx[${JSON.stringify(a)}], B = window.__heldPx[${JSON.stringify(b)}], W = document.getElementById('canvasL').width, out = {};
  for (const [t, q] of Object.entries(__mk.seen)) {
    let n = 0;
    for (let y = Math.max(0, q.y0); y < q.y1; y++) for (let x = Math.max(0, q.x0); x < Math.min(W, q.x1); x++) {
      const i = 4 * (y * W + x);
      if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > ${DIFF}) n++;
    }
    out[t] = { n, a: +q.a.toFixed(3), box: [q.x0, q.y0, q.x1, q.y1] };
  }
  return out;
})()`);

await view(1440, 900, false, false);
await go(`http://localhost:${PORT}/test.html?ns=svmk${Date.now()}&view=steps`);
await settled({ max: 60000, until: "typeof __cmwSteps === 'function' && !!window.GLR && !!document.getElementById('canvasL')" });
await ev(`__cmwSet('morphPaths', false); 1`);
await ev(WRAP);
for (const scope of ['all', 'in']) {
  await ev(`__cmwSteps({ go: 0, now: true, surf: 'sphere', scope: '${scope}' }); 1`);
  await quiet();
  await ev('__mk.on = true, __mk.seen = {}, 1');
  await redraw();
  ok(`${scope}: the frame with the marks settles`, await grab(`${scope}-marks`), null);
  await ev('__mk.on = false, 1');
  await redraw();
  ok(`${scope}: the frame without the marks settles`, await grab(`${scope}-none`), null);
  await ev('__mk.on = true, 1');
  const c = await changed(`${scope}-marks`, `${scope}-none`), st = await ev('__cmwSteps()');
  R[scope] = { marks: c, x: st.x, scope: st.scope, surf: st.surf };
  ok(`${scope}: on plane z, on the Sphere`, st.x === 0 && st.surf === 'sphere' && st.scope === scope, R[scope]);
  ok(`${scope}: the "i" faces the camera at full ink`, !!c.i && c.i.a >= FULL_INK, R[scope]);
  for (const [t, q] of Object.entries(c)) {
    if (q.a < FULL_INK) continue;
    ok(`${scope}: the mark "${t}" shows on the frame (at least ${GLYPH_MIN} of its pixels change)`, q.n >= GLYPH_MIN, q);
  }
}
await redraw();
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };
