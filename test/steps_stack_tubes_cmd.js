// The Stack's tubes (19-stack-tubes.js): from the target disc on the glass, a tube per piece of its preimage down to the
// piece's lit patch on the floor, along the straight strands z → F(z). Read from the page (__cmwStack().drawn.tubes), on
// the plan's maps with the disc on w₁ selected on z, at the Stack's opening camera (Tilt):
//  - M1 z², |w − 1| < 0.5: 2 tubes; the −1 tube narrows a third of the way up, labelled
//    "narrows here: F′(−1) = −2, not a join"; the critical point 0 has a dotted strand to its value 0 (dotted: the
//    key's dashed red is the join radius);
//  - M2 Joukowski, |w − 0.6 − 0.5i| < 0.35: 2 tubes, no narrowing, the critical points ±1's strands;
//  - M3 z³ − 1.2z + 0.3, |w − 1.1| < 0.25: 3 tubes, no narrowing, the critical points ±√0.4's strands;
//  - each tube's floor end is on its patch's edge (|F(z) − c| = r) and its glass end on the disc's rim, at F of its floor
//    end; both ends are where the floor's and the glass's maps put them; each piece has its own colour;
//  - the join ring on the glass is dashed in the cut's red (the overlay is red on it);
//  - the tubes' strands, as painted (their colour at their alpha over the plane), keep a 3:1 contrast with the plane in
//    the light and the dark theme;
//  - the key is titled Stack and names the tubes and the critical strands; straight down it does not;
//  - on a phone (360 × 640) the Stack's Tilt draws the tubes, and M1's label lies inside the plane;
//  - on a phone with the key open the box fits the room the key leaves: at 360 × 640 (the key under the floor) and at
//    740 × 360 (the key at the plane's top left) it covers none of M1's floor marks, its lit patches and its critical
//    point, nor the narrowing's label; straight down, with the key open, the floor is still Look down's plane;
//  - straight down the tubes are not drawn;
//  - timing (reported, not gated): a phone's Tilt turn on M3, the CPU slowed 4×, draws the tubes in at most 4 ms a
//    frame (median) and 8 ms (90th percentile).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LOAD_MS = 40000, READY_MS = 60000;
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const until = (expr, max = READY_MS) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const DEG = Math.PI / 180;
const MAPS = {
  M1: { steps: [{ type: 'pown', params: { n: 2 }, on: true }], c: [1, 0], r: 0.5, pieces: 2, crit: 1, label: 'narrows here: F′(−1) = −2, not a join', s: 1 / 3 },
  M2: { steps: [{ type: 'joukowski', params: {}, on: true }], c: [0.6, 0.5], r: 0.35, pieces: 2, crit: 2 },
  M3: { steps: [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }], c: [1.1, 0], r: 0.25, pieces: 3, crit: 2 },
};
const hooked = () => ev('typeof __cmwStack === "function"');
const open = async (m, { w = 1440, h = 900, phone = false, theme = null } = {}) => {
  const ns = `tubes-${Date.now()}`, M = MAPS[m];
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'd', kind: 'disc', c: M.c, r: M.r, stage: 1 }], steps: M.steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: phone ? 60 : 110 } };
  await view(w, h, false, phone);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')", LOAD_MS);
  await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
  if (theme) { await ev(`document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)}), 1`); await frames(); }
  await ev(`__cmwSelect('d'); 1`);
  await until(`__cmwShapes().selected === 'd' && typeof __cmwLookDown === 'function' && !!__cmwLookDown()`);
  await ev(`__cmwSteps({ surf: 'stack' }); 1`);
  if (await hooked()) await until(`__cmwSteps().surf === 'stack' && !!__cmwStack().drawn && !!__cmwStack().drawn.tubes`, 20000);
  await frames();
};
const drawn = async () => ((await hooked()) ? (await ev('__cmwStack()')).drawn : null);
// F(z) on the page, and a plane point's place in the pane's css px through a level's map m
const F = (re, im) => ev(`__cmwPlaneMenu().stage(1, ${re}, ${im})`);
const flat = async (re, im) => { const [x, y] = await ev(`__cmwPlaneMenu().w2s('L', ${re}, ${im})`), o = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left, r.top]; })()`); return [x - o[0], y - o[1]]; };
const through = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const near = (p, q, tol = 0.75) => !!p && !!q && Math.hypot(p[0] - q[0], p[1] - q[1]) <= tol;
// the WCAG contrast of two #rrggbb colours
// #rrggbb colour a at alpha over #rrggbb colour b
const over = (a, alpha, b) => '#' + [1, 3, 5].map((i) => Math.round(alpha * parseInt(a.slice(i, i + 2), 16) + (1 - alpha) * parseInt(b.slice(i, i + 2), 16)).toString(16).padStart(2, '0')).join('');
const lum = (hx) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

ok('the page has the Stack', await (async () => { await open('M1'); return hooked(); })(), null);
for (const m of ['M1', 'M2', 'M3']) {
  if (m !== 'M1') await open(m);
  const M = MAPS[m], d = await drawn(), T = d && d.tubes;
  info[m] = T && { pieces: T.pieces.length, inks: T.pieces.map((p) => p.ink), labels: T.labels, strands: T.strands.length, fade: T.fade };
  ok(`${m}: a tube per piece (${M.pieces})`, !!T && T.pieces.length === M.pieces, info[m]);
  if (!T) continue;
  ok(`${m}: each piece has its own colour, the violet first`, new Set(T.pieces.map((p) => p.ink)).size === T.pieces.length && T.pieces[0].ink === 5, T.pieces.map((p) => p.ink));
  // the ends: on the floor on the patch's edge, on the glass on the rim at F of the floor end, both where the levels put them
  let onEdge = 0, onRim = 0, atF = 0, floorPx = 0, glassPx = 0, n = 0;
  for (const P of T.pieces) for (const L of P.loops) for (let i = 0; i < L.floor.length; i++) {
    const z = L.floor[i], w = L.glass[i], fz = await F(...z.p);
    n++;
    if (Math.abs(Math.hypot(fz[0] - M.c[0], fz[1] - M.c[1]) - M.r) < 1e-3) onEdge++;
    if (Math.abs(Math.hypot(w.p[0] - M.c[0], w.p[1] - M.c[1]) - M.r) < 1e-3) onRim++;
    if (Math.hypot(fz[0] - w.p[0], fz[1] - w.p[1]) < 1e-9) atF++;
    if (near(through(d.floor, await flat(...z.p)), z.px)) floorPx++;
    if (near(through(d.glass, await flat(...w.p)), w.px)) glassPx++;
  }
  ok(`${m}: every tube's floor end lies on its lit patch's edge (|F(z) − c| = r)`, n > 0 && onEdge === n, { n, onEdge });
  ok(`${m}: every tube's glass end lies on the disc's rim, at F of its floor end`, n > 0 && onRim === n && atF === n, { n, onRim, atF });
  ok(`${m}: the ends are drawn where the floor's and the glass's maps put them`, n > 0 && floorPx === n && glassPx === n, { n, floorPx, glassPx });
  ok(`${m}: a dotted strand from each critical point to its value (${M.crit})`, T.strands.length === M.crit && !!T.dots && T.dots[0] === 0, { strands: T.strands, dots: T.dots });
  if (M.label) ok(`${m}: the narrowing is labelled "${M.label}", a third of the way up`, T.labels.length === 1 && T.labels[0].text.replace(/\u00a0/g, ' ') === M.label && Math.abs(T.labels[0].s - M.s) < 1e-4, T.labels);
  else ok(`${m}: no narrowing`, T.labels.length === 0, T.labels);
  // the join ring, dashed in the cut's red, on the glass: red-dominant ink at a majority of points round it
  const red = await ev(`(() => {
    const d = __cmwStack().drawn, G = d.glass, c = [${M.c}], o = document.getElementById('overlayL'), dpr = o.width / o.getBoundingClientRect().width, r0 = o.getBoundingClientRect();
    const jr = ${m === 'M1' ? 1 : m === 'M2' ? 0.64 : 0.294};
    let hits = 0;
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, p = __cmwPlaneMenu().w2s('L', c[0] + jr * Math.cos(a), c[1] + jr * Math.sin(a)), x = p[0] - r0.left, y = p[1] - r0.top;
      const q = [G[0] * x + G[2] * y + G[4], G[1] * x + G[3] * y + G[5]], px = o.getContext('2d').getImageData(Math.round(q[0] * dpr) - 3, Math.round(q[1] * dpr) - 3, 7, 7).data;
      for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 128 && px[i] > px[i + 1] + 60 && px[i] > px[i + 2] + 60) { hits++; break; }
    }
    return hits;
  })()`);
  ok(`${m}: the join ring on the glass is drawn in the cut's red`, red >= 6, red);
}
// the tubes straight down: not drawn, so the frame is Look down's
await open('M1');
if (await hooked()) {
  await ev(`__cmwCam('L', { yaw: 0, pitch: ${90 * DEG} }); 1`);
  await until(`(() => { const d = __cmwStack().drawn; return !!d && d.camera.pitch >= ${90 * DEG} - 1e-9; })()`, 10000);
}
const top = await drawn();
ok('straight down the tubes are not drawn', !!top && top.tubes === null, top && top.tubes);
const keyText = () => ev(`(() => { const k = document.querySelector('#plotL .ld-key'); return k && !k.hidden ? [k.querySelector('.ld-ttl'), ...k.querySelectorAll('.ld-it')].map((e) => e.textContent).join('; ') : null; })()`);
const keyTop = await keyText();
ok('straight down the key names no tubes', !!keyTop && keyTop.startsWith('Stack;') && !keyTop.includes('tube of a piece'), keyTop);
if (await hooked()) {
  await ev(`__cmwCam('L', { yaw: ${-30 * DEG}, pitch: ${35 * DEG} }); 1`);
  await until(`(() => { const d = __cmwStack().drawn; return !!d && !!d.tubes; })()`, 10000);
}
const keyTilt = await keyText();
info.key = { top: keyTop, tilt: keyTilt };
ok('tilted, the key is titled Stack and names the tubes and the critical strands', keyTilt === 'Stack; target; to the target; critical point; critical value; join radius; tube of a piece; critical point to its value', keyTilt);
// the themes: the tubes' colours against the plane
for (const theme of ['light', 'dark']) {
  await open('M1', { theme });
  const d = await drawn(), T = d && d.tubes;
  const cs = T && d.plane ? T.pieces.map((p) => contrast(over(p.colour, T.ruleA, d.plane), d.plane)) : [];
  info[theme] = { colours: T && T.pieces.map((p) => p.colour), plane: d && d.plane, cs };
  ok(`${theme}: the plane is the ${theme} theme's`, !!d && !!d.plane && (theme === 'dark' ? lum(d.plane) < 0.2 : lum(d.plane) > 0.8), d && d.plane);
  ok(`${theme}: the tubes' strands, as painted, keep a 3:1 contrast with the plane`, cs.length === 2 && cs.every((x) => x >= 3), info[theme]);
}
// a phone's Tilt
await open('M1', { w: 360, h: 640, phone: true });
const ph = await drawn(), pT = ph && ph.tubes;
const paneW = await ev(`document.getElementById('overlayL').getBoundingClientRect().width`), paneH = await ev(`document.getElementById('overlayL').getBoundingClientRect().height`);
info.phone = { tubes: pT && pT.pieces.length, labels: pT && pT.labels, pane: [paneW, paneH] };
ok('phone: the Stack\'s Tilt draws the tubes', !!pT && pT.pieces.length === 2, info.phone);
ok('phone: the narrowing\'s label lies inside the plane', !!pT && pT.labels.length === 1 && !!pT.labels[0].box && pT.labels[0].box[0] >= 0 && pT.labels[0].box[2] <= paneW && pT.labels[0].box[1] >= 0 && pT.labels[0].box[3] <= paneH, info.phone);

// a phone's key, unfolded: the floor's marks (the lit patches, the critical point's cross) and the label against it
const unfold = async () => {
  if (await ev(`(() => { const k = document.querySelector('#plotL .ld-key'); return !!k && k.classList.contains('folded'); })()`)) await ev(`document.querySelector('#plotL .ld-key .ld-ttl').click(), 1`);
  await frames(); await until('true'); await frames();
};
// the key's box and the marks' boxes [x0, y0, x1, y1] in the pane's css px, and which of the marks it covers
const covered = async () => {
  const key = await ev(`(() => { const o = document.getElementById('overlayL').getBoundingClientRect(), k = document.querySelector('#plotL .ld-key'), r = k.getBoundingClientRect(); return k.classList.contains('folded') ? null : [r.left - o.left, r.top - o.top, r.right - o.left, r.bottom - o.top]; })()`);
  const T = (await drawn()).tubes, box = (ps) => [Math.min(...ps.map((p) => p[0])), Math.min(...ps.map((p) => p[1])), Math.max(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[1]))];
  const marks = T ? [...T.pieces.map((P, i) => ({ mark: `patch ${i}`, box: box(P.loops.flatMap((L) => L.floor.map((q) => q.px))) })), ...T.strands.map((s, i) => ({ mark: `critical point ${i}`, box: [s.from[0] - 5, s.from[1] - 5, s.from[0] + 5, s.from[1] + 5] })), ...T.labels.map((l, i) => ({ mark: `label ${i}`, box: l.box }))] : [];
  const meets = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  return { key, marks: marks.length, under: key ? marks.filter((m) => meets(m.box, key)) : null };
};
for (const [w, h] of [[360, 640], [740, 360]]) {
  await open('M1', { w, h, phone: true });
  await unfold();
  const c = await covered();
  info[`key ${w}`] = c;
  ok(`phone ${w} × ${h}: the open key covers none of M1's floor marks (its lit patches, its critical point) nor the narrowing's label`, !!c.key && c.marks === 4 && c.under.length === 0, c);
}
// straight down the box fits the whole pane whatever the key: the Stack's floor is Look down's plane (on the Plane, the
// key open)
await open('M1', { w: 360, h: 640, phone: true });
await ev(`__cmwSteps({ surf: 'plane' }); 1`);
await until(`__cmwSteps().surf === 'plane' && !!__cmwLookDown()`, 20000);
await unfold();
const phTop = (await hooked()) ? await ev(`__cmwStack({ same: { yaw: 0, pitch: ${90 * DEG} } })`) : null;
info.phoneTop = phTop;
ok('phone: straight down, with the key open, the Stack\'s floor is pixel-equal to Look down\'s plane', !!phTop && phTop.px > 0 && phTop.main === 0, phTop);

// M1's narrowing label: where its plate lies against the marks drawn. Every mark is rebuilt here from the draw's record
// (the tubes' end rings and strands, the critical strand, the critical cross on the floor, the critical value's dot, the
// target's ring, its centre and the join ring on the glass, the lines from the preimages to the target), in the pane's css px,
// and the plate (the label's box) is counted against them, a class at a time.
const PLATE_CLASSES = ['tube', 'strand', 'cross', 'value', 'centre', 'target', 'join', 'line'];
const plateHits = async (join) => ev(`(() => {
  const d = __cmwStack().drawn, T = d.tubes, G = d.glass, Fm = d.floor, o = document.getElementById('overlayL').getBoundingClientRect();
  const thru = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  const w2s = (re, im) => { const p = __cmwPlaneMenu().w2s('L', re, im); return [p[0] - o.left, p[1] - o.top]; };
  const c = [1, 0], r = 0.5, lines = [], dots = [];
  const poly = (kind, pts, closed) => lines.push({ kind, pts: closed ? [...pts, pts[0]] : pts });
  for (const P of T.pieces) for (const L of P.loops) {
    poly('tube', L.floor.map((q) => q.px), true); poly('tube', L.glass.map((q) => q.px), true);
    L.floor.forEach((q, i) => poly('tube', [q.px, L.glass[i].px], false));
  }
  for (const s of T.strands) { poly('strand', [s.from, s.to], false); dots.push({ kind: 'cross', p: s.from, r: 5 }); dots.push({ kind: 'value', p: s.to, r: 5 }); }
  const ring = (kind, rr) => poly(kind, Array.from({ length: 64 }, (_, k) => thru(G, w2s(c[0] + rr * Math.cos(k * Math.PI / 32), c[1] + rr * Math.sin(k * Math.PI / 32)))), true);
  ring('target', r); ring('join', ${join});
  const gc = thru(G, w2s(...c));
  dots.push({ kind: 'centre', p: gc, r: 5 });
  for (const z of [[1, 0], [-1, 0]]) poly('line', [thru(Fm, w2s(...z)), gc], false);
  // a segment meets the box [x0, y0, x1, y1]: either end inside it, or it crosses an edge
  const seg = (a, b, B) => {
    const inside = (p) => p[0] >= B[0] && p[0] <= B[2] && p[1] >= B[1] && p[1] <= B[3];
    if (inside(a) || inside(b)) return true;
    let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const [pp, qq] of [[-dx, a[0] - B[0]], [dx, B[2] - a[0]], [-dy, a[1] - B[1]], [dy, B[3] - a[1]]]) {
      if (pp === 0) { if (qq < 0) return false; } else { const t = qq / pp; if (pp < 0) { if (t > t1) return false; t0 = Math.max(t0, t); } else { if (t < t0) return false; t1 = Math.min(t1, t); } }
    }
    return t0 <= t1;
  };
  const L = T.labels[0], B = L.box, out = {};
  for (const k of ${JSON.stringify(PLATE_CLASSES)}) out[k] = 0;
  for (const l of lines) for (let i = 1; i < l.pts.length; i++) if (seg(l.pts[i - 1], l.pts[i], B)) out[l.kind]++;
  for (const q of dots) if (q.p[0] + q.r >= B[0] && q.p[0] - q.r <= B[2] && q.p[1] + q.r >= B[1] && q.p[1] - q.r <= B[3]) out[q.kind]++;
  return { box: B, dot: L.at, hits: out };
})()`);
const platePlaces = [
  { name: 'Tilt at 1440 × 900', w: 1440, h: 900, phone: false },
  { name: 'Tilt at 360 × 640', w: 360, h: 640, phone: true },
  { name: 'Tilt at 740 × 360', w: 740, h: 360, phone: true },
  { name: 'Tilt at 390 × 844', w: 390, h: 844, phone: true },
  { name: 'Tilt at 360 × 640, key open', w: 360, h: 640, phone: true, unfold: true },
  { name: 'Tilt at 390 × 844, key open', w: 390, h: 844, phone: true, unfold: true },
  { name: '75° pitch at 1440 × 900', w: 1440, h: 900, phone: false, pitch: 75 },
  { name: '85° pitch at 1440 × 900', w: 1440, h: 900, phone: false, pitch: 85 },
  { name: '75° pitch at 360 × 640', w: 360, h: 640, phone: true, pitch: 75 },
];
for (const P of platePlaces) {
  await open('M1', { w: P.w, h: P.h, phone: P.phone });
  if (P.unfold) await unfold();
  if (P.pitch && (await hooked())) {
    await ev(`__cmwCam('L', { yaw: ${-30 * DEG}, pitch: ${P.pitch * DEG} }); 1`);
    await until(`(() => { const d = __cmwStack().drawn; return !!d && !!d.tubes && Math.abs(d.camera.pitch - ${P.pitch * DEG}) < 1e-6; })()`, 10000);
    await frames();
  }
  const d = await drawn(), L = d && d.tubes && d.tubes.labels[0];
  if (!L || !L.box) { ok(`narrowing label, ${P.name}: the label is drawn`, false, d && d.tubes); continue; }
  const paneBox = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.width, r.height]; })()`);
  const h = await plateHits(1);
  info[`plate ${P.name}`] = h;
  ok(`narrowing label, ${P.name}: the plate crosses no tube outline, no critical mark, no target or join ring, no line to the target`, PLATE_CLASSES.every((k) => h.hits[k] === 0), h);
  // (what the draw says of its own choice: that it covers no mark by its own count, and a leader line, when it has one, ends
  // on the plate's edge)
  const edge = (p, B) => p[0] >= B[0] - 1e-6 && p[0] <= B[2] + 1e-6 && p[1] >= B[1] - 1e-6 && p[1] <= B[3] + 1e-6 && (Math.abs(p[0] - B[0]) < 1e-6 || Math.abs(p[0] - B[2]) < 1e-6 || Math.abs(p[1] - B[1]) < 1e-6 || Math.abs(p[1] - B[3]) < 1e-6);
  ok(`narrowing label, ${P.name}: the draw reports that it covers no mark; a leader line ends on the plate's edge`, L.hits === 0 && (!L.leader || edge(L.leader, L.box)), { hits: L.hits, leader: L.leader, box: L.box });
  if (P.unfold) {
    const key = await ev(`(() => { const o = document.getElementById('overlayL').getBoundingClientRect(), k = document.querySelector('#plotL .ld-key'), r = k.getBoundingClientRect(); return k.classList.contains('folded') ? null : [r.left - o.left, r.top - o.top, r.right - o.left, r.bottom - o.top]; })()`);
    ok(`narrowing label, ${P.name}: the plate is clear of the open key`, !!key && !(L.box[0] < key[2] && key[0] < L.box[2] && L.box[1] < key[3] && key[1] < L.box[3]), { box: L.box, key });
  }
  ok(`narrowing label, ${P.name}: the plate lies inside the pane, its words unchanged`, L.text.replace(/\u00a0/g, ' ') === MAPS.M1.label && L.box[0] >= 0 && L.box[1] >= 0 && L.box[2] <= paneBox[0] && L.box[3] <= paneBox[1], { box: L.box, pane: paneBox, text: L.text });
}

// the narrowing's label holds still against its dot over a 90° turn at Tilt (3° a frame): it moves more than TURN_HOP px
// between two frames at most TURN_HOPS times (a label that went to and fro with every blocked spot hopped 8 times on a desk)
const TURN_HOP = 10, TURN_HOPS = 2;
for (const [name, w, h, phone] of [['phone 360 × 640', 360, 640, true], ['desk 1440 × 900', 1440, 900, false]]) {
  await open('M1', { w, h, phone });
  const rel = [];
  if (await hooked()) for (let k = 0; k <= 30; k++) {
    await ev(`__cmwCam('L', { yaw: ${-30 * DEG} + ${k} * ${3 * DEG}, pitch: ${40 * DEG} }); 1`);
    await frames();
    const d = await drawn(), L = d && d.tubes && d.tubes.labels[0];
    if (L && L.box) rel.push([L.box[0] - L.at[0], L.box[1] - L.at[1]]);
  }
  const hops = rel.slice(1).map((q, i) => Math.hypot(q[0] - rel[i][0], q[1] - rel[i][1])).filter((x) => x > TURN_HOP);
  info['turn ' + name] = { frames: rel.length, hops: hops.map((x) => +x.toFixed(0)) };
  ok(`narrowing label, a 90° turn at Tilt, ${name}: it moves against its dot at most ${TURN_HOPS} times by more than ${TURN_HOP} px`, rel.length === 31 && hops.length <= TURN_HOPS, info['turn ' + name]);
}

// the tubes' cost a frame while a phone's Tilt turns (M3, the CPU slowed 4×, as the perf suite's phone): reported, not
// gated (ci/browser_suites.js TIMING)
await open('M3', { w: 360, h: 640, phone: true });
const ms = [];
if (await hooked()) {
  await send('Emulation.setCPUThrottlingRate', { rate: 4 });
  for (let i = 0; i < 24; i++) {
    await ev(`__cmwCam('L', { yaw: ${-30 * DEG} + ${i} * ${15 * DEG}, pitch: ${(20 + (i % 6) * 8) * DEG} }); 1`);
    await frames();
    const d = await drawn();
    if (d && d.tubes && d.tubes.ms != null) ms.push(d.tubes.ms);
  }
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
}
info.costEach = ms.map((x) => +x.toFixed(1));
ms.sort((a, b) => a - b);
const med = ms.length ? ms[ms.length >> 1] : null, p90 = ms.length ? ms[Math.floor(ms.length * 0.9)] : null;
info.cost = { frames: ms.length, med, p90, worst: ms.length ? ms[ms.length - 1] : null };
ok('timing: a phone\'s Tilt turn draws M3\'s tubes in at most 4 ms a frame (median) and 8 ms (90th percentile)', ms.length === 24 && med <= 4 && p90 <= 8, info.cost);

// the narrowing's label costs a frame while a phone's Tilt turns (M1, the CPU slowed 4×): reported, like the tubes' own
await open('M1', { w: 360, h: 640, phone: true });
const lms = [];
if (await hooked()) {
  await send('Emulation.setCPUThrottlingRate', { rate: 4 });
  for (let i = 0; i < 24; i++) {
    await ev(`__cmwCam('L', { yaw: ${-30 * DEG} + ${i} * ${15 * DEG}, pitch: ${(20 + (i % 6) * 8) * DEG} }); 1`);
    await frames();
    const d = await drawn();
    if (d && d.tubes && d.tubes.labelMs != null && d.tubes.labels.length) lms.push(d.tubes.labelMs);
  }
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
}
lms.sort((a, b) => a - b);
const lmed = lms.length ? lms[lms.length >> 1] : null, lp90 = lms.length ? lms[Math.floor(lms.length * 0.9)] : null;
info.labelCost = { frames: lms.length, med: lmed, p90: lp90, worst: lms.length ? lms[lms.length - 1] : null };
ok('timing: a phone\'s Tilt turn places M1\'s label in at most 4 ms a frame (median) and 8 ms (90th percentile)', lms.length === 24 && lmed <= 4 && lp90 <= 8, info.labelCost);

return { pass: fails.length === 0, passed: pass, fails, info };
