// The plane's names and a finger drag, classic view only: a one-finger drag from an unselected disc selects it and pans the
// plane (in the steps view a finger drag scrubs its thread), and the names of X and Y: titles, canvas names, Shapes headings,
// Plane | Sphere in both heads, the phone chip's X tag, and the same in Russian (the steps view has one plane and no X or Y).
// The classic readout (UX10, UX105): two lines on a laptop and on a phone, in X expanded, under the construction chip, and the key's three marks in STIX
// (the steps view's readout is one row of pairs: ux165_plane_cmd.js).
// The rest of the piece is ux165_plane_cmd.js. A command file for a CDP daemon (test/cdp_kit README).
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 300) => { await settled({ floor: ms }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const NS = 'u5pc' + (Date.now() % 1000000);
const laptop = async () => { await view(1366, 768, false, false); };
const tool = async (id) => { const r = await clickSel(`#tools .tool[data-tool="${id}"], #constructTools .tool[data-tool="${id}"]`); await settle(120); return r; };
const rln = () => ev(`[...document.querySelectorAll('#leftReadout > .rln')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
const tStart = (x, y) => send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
const tMove = (pts) => send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
const tEnd = () => send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
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

// UX10: the readout under the pointer, two lines
await laptop();
await load(NS + 'r', SD);
await settle(800);
{ const p = await W(0.5, -0.8);
  await move(p[0], p[1]); await settle(200);
  info.l10 = await rln();
  ok('UX10 laptop: one readout with z and w = F(z)', info.l10.length === 2 && /^z = 0\.5/.test(info.l10[0]) && /^w = F\(z\) = /.test(info.l10[1]), info.l10);
  // (no line cut with an ellipsis: the text, measured to the sub-pixel, fits its line; at 1366 |z| and arg still show)
  const cut = await ev(`[...document.querySelectorAll('#leftReadout > .rln')].map((k) => { const rg = document.createRange(); rg.selectNodeContents(k); return +(rg.getBoundingClientRect().width - k.getBoundingClientRect().width).toFixed(2); })`);
  ok('UX10 laptop: no readout line is cut', cut.length === 2 && cut.every((d) => d <= 0.01), cut);
  ok('UX10 laptop: |z| and arg fit beside z at 1366', /\|z\| /.test(info.l10[0]) && /arg /.test(info.l10[0]), info.l10);
  // X expanded: F(z) is still read
  await clickSel('#leftSolo'); await settle(500);
  const p2 = await W(0.5, -0.8);
  await move(p2[0], p2[1]); await settle(200);
  const solo = await rln();
  ok('UX10 with X expanded, F(z) is read in X', solo.length === 2 && /^w = F\(z\)/.test(solo[1]), solo);
  await clickSel('#leftSolo'); await settle(400);
}

// UX10 on the phone: the scale chip teaches the hold-and-slide once, and the probe reads two lines
await phone();
await load(NS + 'q', Object.assign({}, SD, { srcView: { cx: 0, cy: 0, s: 60 } }), `localStorage.removeItem('cmw-probe-learned'); sessionStorage.removeItem('cmw-probe-taught')`);
await settle(1000);
{ const p = await W(0.5, -0.8);
  await tStart(p[0], p[1]); await sleep(800); await tMove([[p[0] + 14, p[1] + 4]]); await sleep(80); await tMove([[p[0] + 24, p[1] + 8]]); await sleep(200);
  const probe = await rln();
  const wid = await ev(`(() => { const c = document.getElementById('leftReadout'); return [...c.children].every((k) => { const rg = document.createRange(); rg.selectNodeContents(k); return rg.getBoundingClientRect().width <= k.getBoundingClientRect().width + 0.01; }); })()`);
  await tEnd(); await settle(300);
  ok('UX10 phone: z = … and w = F(z) = …, no doubled z, not cut', probe.length === 2 && /^z = /.test(probe[0]) && /^w = F\(z\) = /.test(probe[1]) && wid, [probe, wid]);
}
await view(915, 412, false, true);
await load(NS + 'q2', Object.assign({}, SD, { srcView: { cx: 0, cy: 0, s: 60 } }));
await settle(1000);
{ const q = await W(0.5, -0.8);
  await tStart(q[0], q[1]); await sleep(800); await tMove([[q[0] + 14, q[1] + 4]]); await sleep(80); await tMove([[q[0] + 24, q[1] + 8]]); await sleep(200);
  const land = await ev(`(() => { const c = document.getElementById('leftReadout'), r = c.getBoundingClientRect(), p = c.parentElement.getBoundingClientRect(); return { lines: [...c.querySelectorAll('.rln')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()), whole: [...c.children].every((k) => k.scrollWidth <= k.clientWidth + 1), inside: r.left >= p.left - 1 && r.right <= p.right + 1 && r.top >= p.top - 1 && r.bottom <= p.bottom + 1 }; })()`);
  await tEnd(); await settle(300);
  ok('UX10 phone landscape: z = … and w = F(z) = …, whole, inside the plane', land.lines.length === 2 && /^w = F\(z\) = /.test(land.lines[1]) && land.whole && land.inside, land);
}

// UX10 + UX48: X's two-line readout never runs under the construction chip, and UX105: the key's three marks are in STIX
await laptop();
await load(NS + 'lay', { shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }, { id: 'l1', kind: 'line', a: [-2, 1.5], b: [2, 1.5], ci: 1, visible: true }, { id: 'p1', kind: 'point', p: [1.5, -1], ci: 2, visible: true }], steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, snap: false, nextId: 60 });
await settle(700);
await tool('perp');
{ const u = await W(0, 1.5);
  await click(u[0] + 40, u[1]); await settle(120);
  const p = await W(-1, -1.2);
  await move(p[0], p[1]); await settle(200);
  const g = await ev(`(() => { const r = document.getElementById('leftReadout'), c = document.getElementById('draftChipL'); const a = r.getBoundingClientRect(), b = c.getBoundingClientRect(); return { lines: r.querySelectorAll('.rln').length, rb: Math.round(a.bottom), ct: Math.round(b.top), hidden: c.hidden }; })()`);
  ok('UX10/UX48 the chip sits below the two-line readout', g.lines === 2 && !g.hidden && g.ct >= g.rb + 4, g);
  await move(5, 400); await settle(200);
  const ct2 = await ev(`Math.round(document.getElementById('draftChipL').getBoundingClientRect().top)`);
  ok('UX10 the chip stays put when the readout goes back to one line', ct2 === g.ct, [g.ct, ct2]);
  await move(p[0], p[1]); await settle(200);
  const ff = await ev(`[...document.querySelectorAll('#leftReadout .rk .rm')].map((e) => getComputedStyle(e).fontFamily.split(',')[0])`);
  ok('UX105 the readout key\'s 3 marks ("(", "=" and ")") are set in STIX', ff.length >= 3 && ff.every((f) => /STIX/.test(f)), ff);
  await key('Escape'); await key('Escape'); await settle(80);
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
await go(`${U}?ns=${NS}ru&lang=ru`); await settle(1500);
  info.ruTitle = await ev(`document.getElementById('leftTitle').textContent`);
  ok('RU X\'s title starts "X ·"', /^X · /.test(info.ruTitle), info.ruTitle);
  info.ruHeads = await ev(`[...document.querySelectorAll('#shapeList .shapes-sub')].map((e) => e.textContent)`);
  ok('RU Shapes headings', info.ruHeads[0] === 'В X (плоскость z)', info.ruHeads);
await ev(`localStorage.setItem('cmw-lang', 'en'); 1`);
return { pass: fails.length === 0, fails, info };
