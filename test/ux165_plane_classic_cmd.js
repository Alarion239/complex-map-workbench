// v16.5 wave 1, the "plane" piece, classic view only: a one-finger drag from an unselected disc selects it and pans the plane (the steps view's finger drag scrubs its thread); the names of the two planes and of their panes (UX27 and UX37: X and
// Y with their titles, the canvases' names, the Shapes headings, Plane | Sphere in the heads of both panes, the "X" tag on
// the phone's big plane, and the same names in Russian). The steps view has one plane and no X or Y. The rest of the
// piece is ux165_plane_cmd.js. A command file for a CDP daemon (test/cdp_kit README).
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 300) => { await settled({ floor: ms }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const NS = 'u5pc' + (Date.now() % 1000000);
const laptop = async () => { await view(1366, 768, false, false); };
const phone = async () => { await view(412, 860, false, true); };
const W = (re, im, side = 'L') => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const ST = () => ev(`__cmwCI(${JSON.stringify({ shapes: true })})`);
const tdrag = async (x0, y0, x1, y1, n = 10, dt = 16) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1, radiusX: 4, radiusY: 4, force: 1 }] }); await sleep(30);
  for (let i = 1; i <= n; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n, id: 1, radiusX: 4, radiusY: 4, force: 1 }] }); await sleep(dt); }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle(120);
};
const SD = {
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }],
  steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 },
};

await laptop();
await load(NS + 'k', SD);
await settle(800);
  // UX27: one name per plane
  info.l27 = await ev(`({ l: document.getElementById('leftTitle').textContent, r: document.getElementById('rightTitle').textContent, ax: document.getElementById('overlayL').getAttribute('aria-label'), ay: document.getElementById('overlayR').getAttribute('aria-label'), heads: [...document.querySelectorAll('#shapeList .shapes-sub')].map((e) => e.textContent) })`);
  ok('UX27 X\'s title: "X · z-plane, domain of F"', /^X · z-plane/.test(info.l27.l) && /domain of F/.test(info.l27.l), info.l27);
  ok('UX27 Y\'s title: "Y · w = F(z), image"', /^Y · w = F\(z\)/.test(info.l27.r) && /image/.test(info.l27.r), info.l27);
  ok('UX27 the canvases\' names', /^X, the z-plane/.test(info.l27.ax) && /^Y, the w-plane/.test(info.l27.ay), info.l27);
  ok('UX27 the Shapes headings: In X (z-plane), Targets in Y (w-plane)', info.l27.heads[0] === 'In X (z-plane)' && /^Targets in Y \(w/.test(info.l27.heads[1] || ''), info.l27.heads);
  const tnote = await ev(`(document.querySelector('#shapeList .empty-note') || {}).textContent || ''`);
  ok('UX27 no targets: "Draw one in Y (the w-plane)"', /Draw one in Y \(the w-plane\)/.test(tnote), tnote);
  // UX37: Plane | Sphere in words at 1366 with both panels
  info.l37 = await ev(`[...document.querySelectorAll('#leftTabs > button, #rightTabs > button')].map((b) => { const s = b.querySelector('span'); const r = b.getBoundingClientRect(); return { t: s && getComputedStyle(s).display !== 'none' ? s.textContent : '', h: Math.round(r.height) }; })`);
  ok('UX37 "Plane | Sphere" in words in both pane heads', info.l37.length === 4 && info.l37.every((x) => /^(Plane|Sphere)$/.test(x.t) && x.h >= 28), info.l37);

// D9: the first press on a disc only selects it; a drag from it pans the plane
await phone();
await load(NS + 'dn', { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 'p1', kind: 'point', p: [1.5, -1.2], ci: 2, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 60 }, snap: false, nextId: 60 }, `localStorage.setItem('cmw-probe-learned', '1')`);   // (a finger that has probed once pans)
await settle(900);
{ const o0 = await W(0, 0);
  await tdrag(o0[0], o0[1], o0[0] + 40, o0[1] + 30, 8);
  const o1 = await W(0, 0), d = (await ST()).list.find((s) => s.id === 'd1');
  ok('D9 touch: a drag from an unselected disc selects it and pans the plane (the disc stays)', (await ST()).selected === 'd1' && d.c[0] === 0 && d.c[1] === 0 && Math.abs(o1[0] - o0[0] - 40) < 4, [o0, o1, d]);   // (x only: the context bar that the selection brings makes the plane shorter)
}

// the phone's big plane: its chip is tagged X
await phone();
await load(NS + 'l', Object.assign({}, SD, { srcView: { cx: 0, cy: 0, s: 60 } }), `localStorage.removeItem('cmw-probe-learned'); sessionStorage.removeItem('cmw-probe-taught')`);
await settle(1000);
{ const tag = await ev(`getComputedStyle(document.getElementById('leftReadout'), '::before').content`);
  ok('UX27 phone: the big plane\'s chip is tagged X', tag === '"X"', tag); }

// Russian
await laptop();
await load(NS + 'ru', SD, `localStorage.setItem('cmw-lang', 'ru')`);
await nav(`${U}?ns=${NS}ru&lang=ru`); await settle(1500);
  info.ruTitle = await ev(`document.getElementById('leftTitle').textContent`);
  ok('RU X\'s title starts "X ·"', /^X · /.test(info.ruTitle), info.ruTitle);
  info.ruHeads = await ev(`[...document.querySelectorAll('#shapeList .shapes-sub')].map((e) => e.textContent)`);
  ok('RU Shapes headings', info.ruHeads[0] === 'В X (плоскость z)', info.ruHeads);
await ev(`localStorage.setItem('cmw-lang', 'en'); 1`);
return { pass: fails.length === 0, fails, info };
