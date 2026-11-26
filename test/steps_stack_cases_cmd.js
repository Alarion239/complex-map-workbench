// The Stack's hard cases (#1992): scenes the first pictures do not show, each drawn without a tear, a blank or a wrong
// label, with the Stack and the card saying in words what happens. Opened as __cmwSteps states at Tilt (yaw -30, pitch 35)
// at 1440 × 900:
//  - a critical value inside the disc (z², the disc about 0.2, radius 0.5, 0 inside): the one piece covers the disc twice, so
//    its tube is labelled "covers the disc twice: its critical point 0", at that critical point's strand half way up, and not
//    by a narrowing (the piece's feature is the critical point, not a narrowing); control: z² with the disc about 1 (the
//    critical value outside it) keeps its narrowing label and has no such label;
//  - a preimage that reaches ∞ (1/z with the disc about 0.2, which holds F(∞) = 0): its piece has no bounded tube, so no tube is
//    drawn (the first picture drew the cone of its hole and a narrowing at 5), and the key says so, in en, ru and it;
//  - a piece off the window (the Joukowski map, the disc about 0.6 + 0.5i, the view on the other piece): the Stack says "+1 off view"
//    as the flat plane does, as one upright label over the tilted floor, with the same count as the card and the plane's own
//    (the flat draw's copy, turned with the floor, is not drawn), inside the pane and clear of the marks, in en, ru and it;
//  - steps whose pieces are not counted (exp, the disc about -1 on log's cut): no tubes, and the key says why in the card's own
//    words, on a line of its own, in en, ru and it; straight down (no tubes by design) and where the pieces are counted the key
//    has no such line.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LOAD_MS = 40000, READY_MS = 60000;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const until = (expr, max = READY_MS) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const DEG = Math.PI / 180;
const SCENES = {
  crit: { name: 'z² with 0 inside the disc', steps: [{ type: 'pown', params: { n: 2 }, on: true }], c: [0.2, 0], r: 0.5, view: [0, 0, 160] },
  cut: { name: 'exp with the disc on log\'s cut', steps: [{ type: 'exp', params: {}, on: true }], c: [-1, 0], r: 0.4, view: [0, 0, 90], noTubes: true },
  off: { name: 'Joukowski with a piece off the view', steps: [{ type: 'joukowski', params: {}, on: true }], c: [0.6, 0.5], r: 0.35, view: [0.4, 1.1, 260] },
  inf: { name: '1/z with F(∞) = 0 inside the disc', steps: [{ type: 'recip', params: {}, on: true }], c: [0.2, 0], r: 0.5, view: [0, 0, 60], noTubes: true },
  outside: { name: 'z² with 0 outside the disc (control)', steps: [{ type: 'pown', params: { n: 2 }, on: true }], c: [1, 0], r: 0.5, view: [0, 0, 160] },
};
const hooked = () => ev('typeof __cmwStack === "function"');
const open = async (key, { w = 1440, h = 900, lang = 'en' } = {}) => {
  const ns = `cases-${Date.now()}`, M = SCENES[key];
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'd', kind: 'disc', c: M.c, r: M.r, stage: 1 }], steps: M.steps, nextId: 50, focus: 0, srcView: { cx: M.view[0], cy: M.view[1], s: M.view[2] } };
  await view(w, h, false, false);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')", LOAD_MS);
  await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
  await ev(`__cmwSelect('d'); 1`);
  await until(`__cmwShapes().selected === 'd' && typeof __cmwLookDown === 'function' && !!__cmwLookDown()`);
  await ev(`__cmwSteps({ surf: 'stack' }); 1`);
  await ev(`__cmwCam('L', { yaw: ${-30 * DEG}, pitch: ${35 * DEG} }); 1`);
  await until(`(() => { const d = __cmwStack().drawn; return !!d && (${!!M.noTubes} || !!d.tubes) && Math.abs(d.camera.pitch - ${35 * DEG}) < 1e-6; })()`, 20000);
  await frames();
};
const drawn = async () => (await ev('__cmwStack()')).drawn;
const clean = (t) => String(t).replace(/ /g, ' ');
ok('the page has the Stack', await (async () => { await open('crit'); return hooked(); })(), null);
{
  const d = await drawn(), T = d && d.tubes, labels = T ? T.labels : [];
  info.crit = { labels: labels.map((L) => ({ kind: L.kind, text: clean(L.text), s: L.s, at: L.at })), strands: T && T.strands.map((q) => ({ from: q.from, to: q.to })), pieces: T && T.pieces.length };
  const cover = labels.filter((L) => L.kind === 'covers'), strand = T && T.strands[0];
  ok(`${SCENES.crit.name}: one tube, for the piece that covers the disc twice, and one critical strand (controls)`, !!T && T.pieces.length === 1 && T.strands.length === 1, info.crit);
  ok(`${SCENES.crit.name}: the tube is labelled "covers the disc twice: its critical point 0", half way up its strand`, cover.length === 1 && clean(cover[0].text) === 'covers the disc twice: its critical point 0' && Math.abs(cover[0].s - 0.5) < 1e-9 && !!strand && Math.hypot(cover[0].at[0] - strand.pts[5][0], cover[0].at[1] - strand.pts[5][1]) < 1.5, info.crit);
  ok(`${SCENES.crit.name}: no narrowing label (the piece's feature is its critical point)`, !labels.some((L) => L.kind === 'narrow'), info.crit);
}
// (the words in Russian and in Italian)
for (const [lang, want] of [['ru', 'накрывает круг дважды: его критическая точка 0'], ['it', 'copre il disco due volte: il suo punto critico 0']]) {
  await open('crit', { lang });
  const d = await drawn(), L = d && d.tubes && d.tubes.labels.find((x) => x.kind === 'covers');
  ok(`${SCENES.crit.name}: the label in ${lang}`, !!L && clean(L.text) === want, L && L.text);
}
await open('outside');
{
  const d = await drawn(), T = d && d.tubes, labels = T ? T.labels : [];
  info.outside = labels.map((L) => ({ kind: L.kind, text: clean(L.text) }));
  ok(`${SCENES.outside.name}: the narrowing is labelled as before and no tube covers the disc twice`, labels.some((L) => L.kind === 'narrow') && !labels.some((L) => L.kind === 'covers'), info.outside);
}
// uncounted steps: the key says why where the tubes are not drawn
const keyWhy = () => ev(`(() => { const k = document.querySelector('#plotL .ld-key'), w = k && !k.hidden ? k.querySelector('.ld-why') : null, c = document.querySelector('.ro-counts'); return { why: w ? w.textContent : null, card: c ? c.textContent : null, role: w ? w.getAttribute('role') : null, items: k ? k.querySelectorAll('.ld-it').length : 0 }; })()`);
for (const [lang, test] of [['en', /^The pieces of its preimage are not counted/], ['ru', /[а-яё]/i], ['it', /^I pezzi/]]) {
  await open('cut', { lang });
  const d = await drawn(), k = await keyWhy();
  info['cut ' + lang] = { tubes: !!(d && d.tubes), key: k };
  ok(`${SCENES.cut.name} (${lang}): no tubes are drawn (control)`, !!d && d.tubes === null, info['cut ' + lang]);
  ok(`${SCENES.cut.name} (${lang}): the key says why, in the card's own words`, !!k.why && k.why === k.card && test.test(k.why), k);
}
await open('crit');
{
  const k = await keyWhy();
  ok(`${SCENES.crit.name}: where the pieces are counted the key has no line of why`, k.why === null && k.items > 0, k);
}
await open('cut');
await ev(`__cmwCam('L', { yaw: 0, pitch: ${90 * DEG} }); 1`);
await until(`(() => { const d = __cmwStack().drawn; return !!d && d.camera.pitch >= ${90 * DEG} - 1e-9; })()`, 10000);
{
  const k = await keyWhy();
  ok(`${SCENES.cut.name}: straight down, where no tubes are drawn by design, the key has no line of why`, k.why === null, k);
}
// a piece off the window: the count over the tilted floor
for (const [lang, want] of [['en', '+1 off view'], ['ru', 'ещё 1 за краем'], ['it', 'altri 1 fuori vista']]) {
  await open('off', { lang });
  const d = await drawn(), O = d && d.off, plane = await ev('__cmwPullOff()'), card = await ev("(document.querySelector('.ro-off') || {}).textContent || ''"), pane = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.width, r.height]; })()`);
  info['off ' + lang] = { off: O, plane, card, pane };
  ok(`${SCENES.off.name} (${lang}): one count over the floor, "${want}", inside the pane, covering no mark`, !!O && O.length === 1 && clean(O[0].text) === want && !!O[0].box && O[0].box[0] >= 0 && O[0].box[1] >= 0 && O[0].box[2] <= pane[0] && O[0].box[3] <= pane[1] && O[0].hits === 0, info['off ' + lang]);
  ok(`${SCENES.off.name} (${lang}): its count is the plane's and the card's (1 piece)`, !!O && O.length === 1 && O[0].n === 1 && plane.length === 1 && plane[0].n === 1 && /\b1\b/.test(card), info['off ' + lang]);
}
// a preimage that reaches infinity (1/z, the disc about 0.2 holding F(∞) = 0): its piece has no bounded tube, so none is drawn and the key says why
for (const [lang, want] of [['en', 'No tubes: the disc holds F(∞), so a piece of its preimage reaches ∞'], ['ru', 'Трубок нет: круг содержит F(∞), поэтому часть его прообраза уходит в ∞'], ['it', 'Nessun tubo: il disco contiene F(∞), quindi una parte della controimmagine arriva all’∞']]) {
  await open('inf', { lang });
  const d = await drawn(), k = await keyWhy();
  info['inf ' + lang] = { tubes: !!(d && d.tubes), key: k };
  ok(`${SCENES.inf.name} (${lang}): no tube is drawn (no wrong tube over the exterior)`, !!d && d.tubes === null, info['inf ' + lang]);
  ok(`${SCENES.inf.name} (${lang}): the key says the preimage reaches ∞`, k.why === want, k);
}
return { pass: fails.length === 0, fails, info };
