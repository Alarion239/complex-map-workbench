// The Stack's two kinds of connector (19-stack-links.js, #1996): the Stack key's switch between straight strands,
// (1 − s)z + s·F(z), and the glide's own curved paths. On the plan's maps with the disc on w₁ selected on z, at the
// Stack's opening camera (Tilt):
//  - the key ends with the switch, Straight checked on a state that has none; a press on Glide paths draws the curved
//    connectors, and changes neither the floor (its picture, the lit patches) nor the levels' maps; the tubes' ends are
//    the same in both kinds;
//  - curved, a connector is the steps view's glide: at heights 1/4, 1/2 and 3/4 a point of a tube lies where the glide
//    from z to w₁ puts it (M1: the points above the cut, which keep the glide's principal branch; M2 and M3: all);
//  - M1 z², |w − 1| < 0.5, curved: the −1 tube rises whole (no slice has a step between two of its points ten times its
//    median step), with no label; on the steps' own cuts (the test hook's branch: false) the cut tears it, and the tear is
//    labelled "torn here by the glide’s cut, not a split". Straight, the narrowing keeps its label. M2 and M3, curved:
//    no slice is torn (M2's inner piece is stretched far, not torn);
//  - the choice is saved with the steps view's place (S.sv.links) and a reload opens on it; the switch takes the arrow keys
//    (→ and ←) and the mouse, and keeps the focus on the radio checked; it shows its name, Connectors; on a phone (390 × 844) its radios are 44 px
//    targets inside the switch's box;
//  - curved, seen straight down, the frame is Look down's (the lines to the target bend only as the tubes stand up);
//  - timing (reported, not gated): a Tilt turn on M3 draws the tubes in about the same time a frame in both kinds (the
//    curved connectors' samples are kept, not made again a frame).
// Its frames go to shots/ (links-<map>-straight.png and -curved.png) for the screenshot review.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LOAD_MS = 40000, READY_MS = 60000;
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const until = (expr, max = READY_MS) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const DEG = Math.PI / 180;
const TEAR = 'torn here by the glide’s cut, not a split', NARROW = 'narrows here: F′(−1) = −2, not a join';
const MAPS = {
  M1: { steps: [{ type: 'pown', params: { n: 2 }, on: true }], c: [1, 0], r: 0.5 },
  M2: { steps: [{ type: 'joukowski', params: {}, on: true }], c: [0.6, 0.5], r: 0.35 },
  M3: { steps: [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }], c: [1.1, 0], r: 0.25 },
};
const hooked = () => ev('typeof __cmwStackLinks === "function"');
const open = async (m, { ns = `links-${Date.now()}`, fresh = true, stack = true, phone = false } = {}) => {
  const M = MAPS[m];
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'd', kind: 'disc', c: M.c, r: M.r, stage: 1 }], steps: M.steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 110 } };
  await view(phone ? 390 : 1440, phone ? 844 : 900, false, phone);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  if (fresh) await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')", LOAD_MS);
  await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
  await ev(`__cmwSelect('d'); 1`);
  // (Look down draws on the flat plane; a reload opens on the saved Stack, where it does not)
  if (fresh) {
    await until(`__cmwShapes().selected === 'd' && typeof __cmwLookDown === 'function' && !!__cmwLookDown()`);
    if (!stack) { await frames(); return ns; }
    await ev(`__cmwSteps({ surf: 'stack' }); 1`);
  }
  await until(`__cmwSteps().surf === 'stack' && !!__cmwStack().drawn && !!__cmwStack().drawn.tubes`, 20000);
  await frames();
  return ns;
};
const drawn = async () => (await ev('__cmwStack()')).drawn;
// the switch in the key: its two segments' values, the checked one, and a press on one
const sw = () => ev(`(() => { const e = document.querySelector('#plotL .ld-key .ld-links'); return e ? { vals: [...e.querySelectorAll('[data-v]')].map((b) => b.dataset.v), on: (e.querySelector('.on') || { dataset: {} }).dataset.v || null, label: e.getAttribute('aria-label') } : null; })()`);
const press = async (v) => { await ev(`(document.querySelector('#plotL .ld-key .ld-links [data-v="${v}"]').click(), 1)`); await until(`__cmwStack().drawn && __cmwStack().drawn.links === '${v}' && !!__cmwStack().drawn.tubes`, 10000); await frames(); };
// a hash of the floor's canvas (the floor's picture and its lit patches)
const floorHash = () => ev(`(() => { const c = document.getElementById('canvasL'), d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i += 4) h = Math.imul(h ^ (d[i] | d[i + 1] << 8 | d[i + 2] << 16), 16777619); return h >>> 0; })()`);
const links = (o) => ev(`__cmwStackLinks(${o ? JSON.stringify(o) : ''})`);
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
// a slice's worst step between two of its points over its median step, the most over every loop of every piece at height j
const worstStep = (data, j) => {
  let worst = 0;
  for (const P of data.pieces) for (const lev of P.loops) {
    const q = lev[j], g = q.map((p, i) => dist(p, q[(i + 1) % q.length])), med = g.slice().sort((a, b) => a - b)[g.length >> 1];
    worst = Math.max(worst, Math.max(...g) / med);
  }
  return worst;
};

await open('M1');
ok('the page has the connectors\' hook', await hooked(), null);
for (const m of ['M1', 'M2', 'M3']) {
  if (m !== 'M1') await open(m);
  if (!(await hooked())) break;
  const r = info[m] = {};
  const s0 = r.switch = await sw();
  ok(`${m}: the key ends with the switch, Glide paths and Straight, Straight checked`, !!s0 && s0.vals.join() === 'curved,straight' && s0.on === 'straight' && s0.label === 'Connectors', s0);
  const d0 = await drawn(), h0 = await floorHash();
  await shot(`links-${m}-straight`);
  ok(`${m}: straight on opening`, d0.links === 'straight' && d0.tubes.mode === 'straight', { links: d0.links, mode: d0.tubes.mode });
  await press('curved');
  const d1 = await drawn(), h1 = await floorHash();
  await shot(`links-${m}-curved`);
  ok(`${m}: a press on Glide paths draws the curved connectors`, d1.links === 'curved' && d1.tubes.mode === 'curved' && (await sw()).on === 'curved', { links: d1.links, mode: d1.tubes.mode });
  ok(`${m}: the floor's picture and its lit patches do not change`, h0 === h1, { h0, h1 });
  ok(`${m}: the floor's and the glass's maps do not change`, JSON.stringify(d0.floor) === JSON.stringify(d1.floor) && JSON.stringify(d0.glass) === JSON.stringify(d1.glass), { f0: d0.floor, f1: d1.floor });
  const ends = (d) => JSON.stringify(d.tubes.pieces.map((P) => P.loops.map((L) => [L.floor, L.glass])));
  ok(`${m}: the tubes' ends are the same in both kinds`, ends(d0) === ends(d1), null);
  // (curved: the glide's own path, checked against the steps view's glide map at the same place)
  const L = await links(), n = L.n;
  let tried = 0, on = 0, worstOff = 0;
  for (const P of L.data.pieces) for (const lev of P.loops) for (let i = 0; i < lev[0].length; i += 8) {
    const z = lev[0][i];
    if (m === 'M1' && !(z[1] > 1e-6)) continue;
    for (const j of [n / 4, n / 2, (3 * n) / 4]) {
      const g = (await links({ glide: [j / n, z[0], z[1]] })).glide, e = dist(g, lev[j][i]);
      tried++; worstOff = Math.max(worstOff, e);
      if (e < 1e-9 * (1 + Math.hypot(...g))) on++;
    }
  }
  r.glide = { tried, on, worstOff };
  ok(`${m}: curved, a tube's points lie on the steps view's glide at heights 1/4, 1/2 and 3/4`, tried > 0 && on === tried, r.glide);
  // (a slice stretched far, M2's inner piece, is no tear)
  if (m !== 'M1') ok(`${m}: curved, no slice is torn and no tear is labelled`, L.data.tears.length === 0 && !d1.tubes.labels.some((x) => x.kind === 'tear'), { tears: L.data.tears, labels: d1.tubes.labels });
  if (m === 'M1') {
    const wc = r.worstCurved = Math.max(...[...Array(n - 1)].map((_, j) => worstStep(L.data, j + 1)));
    ok('M1: curved, the −1 tube rises whole: no slice has a step 10 times its median', wc < 10, wc);
    ok('M1: curved, no tear and no label', L.data.tears.length === 0 && d1.tubes.labels.length === 0, { tears: L.data.tears, labels: d1.tubes.labels });
    // (on the steps' own cuts: the principal z^(1 + t) tears the −1 piece, and the tear is labelled)
    const T = await links({ branch: false });
    await frames(); await frames();
    const dt = await drawn();
    r.torn = { tears: T.data.tears, labels: dt.tubes.labels.map((x) => x.text), worst: worstStep(T.data, n / 2) };
    ok('M1: on the steps\' own cuts, the −1 piece is torn, widest half way up', worstStep(T.data, n / 2) > 10 && T.data.tears.length === 1 && Math.abs(T.data.tears[0].s - 0.5) < 0.05, r.torn);
    ok(`M1: the tear is labelled "${TEAR}"`, dt.tubes.labels.length === 1 && dt.tubes.labels[0].text === TEAR && dt.tubes.labels[0].kind === 'tear', r.torn);
    await links({ branch: true });
    await press('straight');
    const ds = await drawn();
    ok(`M1: straight, the narrowing keeps its label "${NARROW}"`, ds.tubes.labels.length === 1 && ds.tubes.labels[0].text === NARROW, ds.tubes.labels);
  }
}
// saved with the steps view's place, and a reload opens on it; the switch takes the arrow keys
if (await hooked()) {
  const ns = await open('M2');
  await press('curved');
  await until(`(() => { const s = JSON.parse(localStorage.getItem('complex-map-workbench-v1:${ns}') || '{}'); return !!s.sv && s.sv.links === 'curved'; })()`, 5000).catch(() => null);
  const saved = await ev(`(() => { const s = JSON.parse(localStorage.getItem('complex-map-workbench-v1:${ns}') || '{}'); return s.sv ? s.sv.links : null; })()`);
  ok('the choice is saved with the steps view\'s place (S.sv.links)', saved === 'curved', saved);
  await open('M2', { ns, fresh: false });
  const back = await drawn(), sb = await sw();
  ok('a reload opens on the saved choice', back.links === 'curved' && !!sb && sb.on === 'curved', { links: back.links, sw: sb });
  await ev(`(document.querySelector('#plotL .ld-key .ld-links [data-v="curved"]').focus(), 1)`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await until(`__cmwStack().drawn && __cmwStack().drawn.links === 'straight'`, 5000).catch(() => null);
  await frames();
  const focus = await ev(`(() => { const a = document.activeElement; return a ? { v: a.dataset ? a.dataset.v || null : null, inSwitch: !!a.closest('.ld-links'), tag: a.tagName } : null; })()`);
  ok('the switch takes the arrow keys, and the focus stays on the radio checked', (await drawn()).links === 'straight' && !!focus && focus.inSwitch && focus.v === 'straight', { links: (await drawn()).links, focus });
  // (a second key, ←, back to Glide paths; then a mouse click on Straight)
  const focusNow = () => ev(`(() => { const a = document.activeElement; return a ? { v: a.dataset ? a.dataset.v || null : null, inSwitch: !!a.closest('.ld-links') } : null; })()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  await until(`__cmwStack().drawn && __cmwStack().drawn.links === 'curved'`, 5000).catch(() => null);
  await frames();
  const f2 = await focusNow(), l2 = (await drawn()).links;
  ok('a second arrow key switches back, and the focus stays on the radio checked', l2 === 'curved' && !!f2 && f2.inSwitch && f2.v === 'curved', { links: l2, focus: f2 });
  // (the click is on the radio not checked, whatever the keys left, so that it changes the kind)
  const other = l2 === 'curved' ? 'straight' : 'curved';
  await clickSel(`#plotL .ld-key .ld-links [data-v="${other}"]`);
  await until(`__cmwStack().drawn && __cmwStack().drawn.links === '${other}'`, 5000).catch(() => null);
  await frames();
  const f3 = await focusNow(), l3 = (await drawn()).links;
  ok('a mouse click switches, and the focus stays on the radio clicked', l3 === other && !!f3 && f3.inSwitch && f3.v === other, { links: l3, focus: f3, other });
  const lead = await ev(`(() => { const r = document.querySelector('#plotL .ld-key .ld-links-row'); const l = r && r.querySelector('.ld-links-l'); return l ? l.textContent : null; })()`);
  ok('the switch has its visible name, Connectors', lead === 'Connectors', lead);
}
// a phone: the switch's radios are 44 px targets in the unfolded key
if (await hooked()) {
  await open('M1', { phone: true });
  await ev(`(() => { const t = document.querySelector('#plotL .ld-key .ld-ttl'); if (t && document.querySelector('#plotL .ld-key.folded')) t.click(); return 1; })()`);
  await frames();
  const hs = info.phoneTargets = await ev(`[...document.querySelectorAll('#plotL .ld-key .ld-links > button')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })`);
  ok('phone: the switch\'s radios are at least 44 px tall', hs.length === 2 && hs.every(([, hh]) => hh >= 44), hs);
  const inBox = info.phoneBoxes = await ev(`(() => { const g = document.querySelector('#plotL .ld-key .ld-links'), G = g.getBoundingClientRect(); return { seg: [G.top, G.bottom].map(Math.round), radios: [...g.querySelectorAll(':scope > button')].map((b) => { const r = b.getBoundingClientRect(); return { box: [r.left, r.top, r.right, r.bottom].map(Math.round), inside: r.left >= G.left - 0.5 && r.right <= G.right + 0.5 && r.top >= G.top - 0.5 && r.bottom <= G.bottom + 0.5 }; }) }; })()`);
  ok('phone: each radio lies inside the switch\'s box', inBox.radios.length === 2 && inBox.radios.every((r) => r.inside), inBox);
  await shot('links-phone');
}

// curved, seen straight down, the Stack's frame is still Look down's (its lines to the target straight): the frame
// __cmwStack({ same }) draws at pitch 90° against Look down's on the flat plane, device px that differ
if (await hooked()) {
  await open('M1', { stack: false });
  await links({ links: 'curved' });
  await frames(); await frames();
  const top = info.top = await ev(`__cmwStack({ same: { yaw: 0, pitch: ${90 * DEG} } })`);
  ok('curved, straight down the Stack\'s frame is pixel-equal to Look down\'s', !!top && top.px > 0 && top.main === 0 && top.over === 0, top);
}

// the tubes' cost a frame while the Tilt turns on M3, in both kinds, the CPU slowed 4×: reported, not gated
// (ci/browser_suites.js TIMING)
if (await hooked()) {
  await open('M3');
  const cost = {};
  await send('Emulation.setCPUThrottlingRate', { rate: 4 });
  for (const kind of ['straight', 'curved', 'straight', 'curved']) {
    await press(kind);
    const ms = cost[kind] = cost[kind] || [];
    for (let i = 0; i < 12; i++) {
      await ev(`__cmwCam('L', { yaw: ${-30 * DEG} + ${i} * ${15 * DEG}, pitch: ${(20 + (i % 6) * 8) * DEG} }); 1`);
      await frames();
      const d = await drawn();
      if (d && d.tubes && d.tubes.ms != null) ms.push(d.tubes.ms);
    }
  }
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  info.cost = { straight: med(cost.straight), curved: med(cost.curved), frames: [cost.straight.length, cost.curved.length] };
  ok('timing: a Tilt turn on M3 draws the curved tubes within 1.25× the straight ones\' time a frame (median) + 0.5 ms', cost.straight.length === 24 && cost.curved.length === 24 && info.cost.curved <= 1.25 * info.cost.straight + 0.5, info.cost);
}

return { pass: fails.length === 0, passed: pass, fails, info };
