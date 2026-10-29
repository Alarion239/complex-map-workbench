// "Between z0 and z1" in the real app (issue #70; notes/orthogonal-circle/segments/SPEC.md 12): the chip's fourth choice
// makes the hyperbolic segment from the first point to the second (an arc with def.between 1, its ends the two points,
// named Hyperbolic line, its row "hyperbolic segment from z₀ to z₁, inside the unit circle"); the Inspector offers Whole |
// Inside | Outside | Between, each one undo step; the ⋯ menu offers "Between z₀ and z₁ only" and Whole circle; dragging a point
// across C makes it undefined with the reason, and back; a saved scene reloads it (bitwise ends); Russian and Italian read.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/between_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const W = (re, im, side = 'L') => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const CI = (o) => ev(`__cmwCI(${JSON.stringify(o || null)})`);
const ST = () => CI({ shapes: true });
const byId = (st, id) => st.list.find((s) => s.id === id);
const tool = async (id) => { const r = await clickSel(`#tools .tool[data-tool="${id}"], #constructTools .tool[data-tool="${id}"]`); await settle(150); return r; };
const rowD = (id) => ev(`(document.querySelector('.shape[data-id="${id}"] .d') || {}).textContent`);
const chipBtn = (lab) => ev(`(() => { const b = [...document.querySelectorAll('#draftChipL .cm-sb, #draftChipR .cm-sb')].find((x) => x.getAttribute('aria-label') === ${JSON.stringify(lab)}); if (b) b.click(); return !!b; })()`);
const inspBtn = (lab) => ev(`(() => { const b = [...document.querySelectorAll('.cm-iside button')].find((x) => x.textContent.trim() === ${JSON.stringify(lab)}); if (b) b.click(); return !!b; })()`);
const NS = 'btw' + (Date.now() % 1000000);
const SD = { shapes: [], steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 170 }, unit: true, snap: true, nextId: 50 };
const hist = async () => (await ST()).hi;
const be = (a, b) => Array.isArray(a) && Array.isArray(b) && Object.is(a[0], b[0]) && Object.is(a[1], b[1]);

await view(1440, 900, false, false);
await load(NS, SD);
await settle(900);
// 1. the chip: four choices, the fourth makes the segment
await tool('perp');
const chip = await ev(`[...document.querySelectorAll('#draftChipL .cm-sb')].map((b) => [b.getAttribute('aria-label'), b.title])`);
ok('the chip has Whole | Inside | Outside | Between, Between with its tooltip', JSON.stringify(chip.map((x) => x[0])) === '["Whole","Inside","Outside","Between"]' && /hyperbolic segment from the first point to the second/.test(chip[3][1]), chip);
await ev(`(() => { const b = [...document.querySelectorAll('#draftChipL .cm-sb')].find((x) => x.getAttribute('aria-label') === 'Between'); b.click(); return 1; })()`);
const u = await W(Math.cos(0.9), Math.sin(0.9));
await click(u[0] + 2, u[1] - 1); await settle(150);
const P = [0.3, 0.2], Q = [-0.5, 0.35];
const A = await W(P[0], P[1]), B = await W(Q[0], Q[1]);
await click(A[0], A[1]); await settle(120); await click(B[0], B[1]); await settle(300);
await key('Escape'); await tool('select'); await settle(250);
let st = await ST();
const k = st.list.find((s) => s.def && s.def.op === 'perp');
ok('the click made a perpendicular circle with between 1, no seg, drawn as an arc', !!k && k.def.between === 1 && !('seg' in k.def) && k.kind === 'arc', k && { def: k.def, kind: k.kind });
const pts = st.list.filter((s) => s.kind === 'point');
const pz = (id) => (byId(st, id) || {}).p;
const ends = k ? [k.a, k.b] : [];
ok('its ends are the two points, bitwise', !!k && k.def.args.length === 3 && ends.some((e) => be(e, pz(k.def.args[1].s))) && ends.some((e) => be(e, pz(k.def.args[2].s))), { ends, args: k && k.def.args.map((r) => pz(r.s)) });
info.row = k ? await rowD(k.id) : null;
ok('the row reads "hyperbolic segment from z₀ to z₁, inside the unit circle"', /^hyperbolic segment from z₀ to z₁, inside /.test(info.row || ''), info.row);

// 2. the Inspector: the four choices, Between on, each one undo step
if (k) {
  for (let i = 0; i < 3 && !(await ev(`!!document.querySelector('.cm-iside')`)); i++) {
    await ev(`(() => { const r = document.querySelector('.shape[data-id="${k.id}"] .shape-name') || document.querySelector('.shape[data-id="${k.id}"]'); r && r.click(); return 1; })()`);
    await settle(400);
  }
  info.insp = await ev(`[...document.querySelectorAll('.cm-iside button')].map((b) => b.textContent.trim() + (b.classList.contains('on') ? '*' : ''))`);
  ok('the Inspector: Whole | Inside | Outside | Between, Between on', JSON.stringify(info.insp) === '["Whole","Inside","Outside","Between*"]', info.insp);
  const steps = [];
  for (const [lab, want] of [['Inside', 'seg1'], ['Between', 'between'], ['Whole', 'whole'], ['Between', 'between']]) {
    const h0 = await hist();
    await inspBtn(lab); await settle(350);
    const kk = byId(await ST(), k.id);
    steps.push([lab, kk.def.between === 1 ? 'between' : kk.def.seg ? 'seg' + kk.def.seg : 'whole', kk.kind, (await hist()) - h0]);
  }
  info.inspSteps = steps;
  ok('Inside, Between, Whole, Between each change it in one undo step', steps.every(([lab, v, kind, dh], i) => v === ['seg1', 'between', 'whole', 'between'][i] && dh === 1 && kind === (v === 'whole' ? 'circle' : 'arc')), steps);
  // ⋯: the item and Whole circle
  await ev(`(() => { const b = document.querySelector('.shape[data-id="${k.id}"] .more'); if (b) { b.scrollIntoView({ block: 'nearest' }); b.click(); } return !!b; })()`);
  await settle(300);
  info.menu = await ev(`[...document.querySelectorAll('.menu .mi, [role="menuitem"]')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim())`);
  ok('the ⋯ menu offers Whole circle while Between is on', (info.menu || []).includes('Whole circle'), info.menu);
  await key('Escape'); await settle(200);

  // 3. dragging z1 across the unit circle: undefined with the reason; back inside: defined again
  const zQ = k.def.args[2].s, zq = pz(zQ);
  const from = await W(zq[0], zq[1]), out = await W(1.4, 0.4);
  await drag(from[0], from[1], out[0], out[1], 10, 16); await settle(500);
  let s2 = await ST(), k2 = byId(s2, k.id);
  info.undef = k2 && k2.undef;
  info.rowUndef = await rowD(k.id);
  ok('Q dragged outside C makes it undefined, with the reason in its row', /different sides/.test(info.rowUndef || ''), info.rowUndef);
  // (Undo puts Q back: the segment is defined again)
  await key('z', 2); await settle(600);
  s2 = await ST(); k2 = byId(s2, k.id);
  info.rowBack = await rowD(k.id);
  ok('and Undo (Q back inside) defines it again', /^hyperbolic segment from z₀ to z₁, inside /.test(info.rowBack || '') && k2.def.between === 1 && k2.kind === 'arc', { row: info.rowBack, kind: k2.kind, q: byId(s2, zQ).p });

  // 4. a saved scene reloads it, the ends bitwise
  const fig = await ev(`__cmwP().figure`);
  await load(NS + 'r', fig); await settle(1200);
  const s3 = await ST(), k3 = s3.list.find((s) => s.def && s.def.op === 'perp');
  info.k3 = k3 && { undef: k3.undef, def: k3.def, kind: k3.kind, a: k3.a, b: k3.b };
  info.k3row = k3 && await rowD(k3.id);
  info.inspBefore = await ev(`(() => ({ insp: !!document.querySelector('.cm-insp'), side: !!document.querySelector('.cm-iside'), sel: (window.__cmwCI && __cmwCI({}) && 1) }))()`);
  ok('a reload keeps Between, kind arc, ends bitwise', !!k3 && k3.def.between === 1 && k3.kind === 'arc' && be(k3.a, k2.a) && be(k3.b, k2.b), k3 && { def: k3.def, a: k3.a, b: k3.b });
  // 5. Russian and Italian: the row and the Inspector word
  for (const [lang, rowRe, btn] of [['ru', /гиперболический отрезок/, 'Между'], ['it', /segmento iperbolico/, 'Tra']]) {
    await ev(`I18N.setPref('${lang}'), 1`); await settle(1500);
    const r = await rowD(k3.id);
    ok(`${lang}: the row reads as a hyperbolic segment`, rowRe.test(r || ''), r);
    for (let i = 0; i < 3 && !(await ev(`!!document.querySelector('.cm-iside')`)); i++) {
      await ev(`(() => { const r = document.querySelector('.shape[data-id="${k3.id}"] .shape-name') || document.querySelector('.shape[data-id="${k3.id}"]'); r && r.click(); return 1; })()`); await settle(400);
    }
    const labs = await ev(`[...document.querySelectorAll('.cm-iside button')].map((b) => b.textContent.trim())`);
    ok(`${lang}: the Inspector's fourth choice is ${btn}`, labs[3] === btn, labs);
  }
  await ev(`I18N.setPref('en'), 1`); await settle(1000);
}
// 6. the Hyperbolic line tool offers Inside | Between too
await load(NS + 'h', SD); await settle(900);
await tool('hyper');
const hchip = await ev(`[...document.querySelectorAll('#draftChipL .cm-sb')].map((b) => [b.getAttribute('aria-label'), b.getAttribute('aria-pressed')])`);
ok('the Hyperbolic line tool has Inside | Between (Inside on)', JSON.stringify(hchip) === '[["Inside","true"],["Between","false"]]', hchip);
await ev(`(() => { const b = [...document.querySelectorAll('#draftChipL .cm-sb')].find((x) => x.getAttribute('aria-label') === 'Between'); b.click(); return 1; })()`);
const hu = await W(Math.cos(0.9), Math.sin(0.9));
await click(hu[0] + 2, hu[1] - 1); await settle(150);
const hA = await W(0.3, 0.2), hB = await W(-0.5, 0.35);
await click(hA[0], hA[1]); await settle(120); await click(hB[0], hB[1]); await settle(300);
await key('Escape'); await tool('select'); await settle(250);
const hs = await ST(), hk = hs.list.find((x) => x.def && x.def.op === 'perp');
ok('the Hyperbolic line tool on Between made the segment (between 1, nk hyper, an arc)', !!hk && hk.def.between === 1 && hk.def.nk === 'hyper' && hk.kind === 'arc', hk && { def: hk.def, kind: hk.kind });
await ev(`Construct.hyper = 'in', 1`);
if (fails.length) { try { fs.writeFileSync('/tmp/between_info.json', JSON.stringify(info, null, 1)); } catch (e) { /* no fs */ } }
return { pass: fails.length === 0, fails, info };
