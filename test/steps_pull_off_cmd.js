// The steps view's regions of later planes pulled back to an earlier one: a piece of a preimage outside the window
// shows nothing, so the plane says how many pieces are off it ("+1 off view"). Cayley, then cube, with a small disc on w₂
// whose three preimages on z are near -4.8 + 5.1i (off the window at the default camera), -0.447 + 0.124i and
// 0.706 + 0.155i:
//  - on z the disc's count is 1 of 3, in English and Russian, and the words are placed in the pane (__cmwPullOff, and
//    the label placer's own list, __cmwLabelsPlaced);
//  - zoomed out so that every piece is in the window, nothing is counted (the control: the count follows the window);
//  - with the camera far from every piece, all 3 are counted and the words are drawn at the window's edge, clear of the
//    controls over the plane (the scale chip, the key, the view buttons);
//  - a disc on w₂ about 0, the cube's critical value, is not counted (0.34, r 0.35, and 0.5, r 0.7): its preimage on z is
//    one piece, round z = i, though a point in it has three preimages;
//  - the same disc made large (r 0.25): its third piece reaches into the window's top-left, so nothing is off view;
//  - on w₂, the disc's own plane, nothing is counted (the count is for pullbacks only).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LOAD_MS = 40000, READY_MS = 60000;
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const until = (expr, max = READY_MS) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
// (the disc on w₂ and its three preimages on z, from w₂ = ((z − i)/(z + i))³)
const DISC = { id: 'd2', kind: 'disc', c: [0.4465, 0.3], r: 0.03, stage: 2 };
const STEPS = [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }];
// (a disc on w₂ holding w₂ = 0, the cube's critical value: one piece on z, three preimages of each of its points)
const CRIT_DISCS = [{ id: 'd3', kind: 'disc', c: [0.34, 0], r: 0.35, stage: 2 }, { id: 'd4', kind: 'disc', c: [0.5, 0], r: 0.7, stage: 2 }];
// (the disc made large: its far piece reaches into the window)
const BIG_DISC = { id: 'd5', kind: 'disc', c: [0.4465, 0.3], r: 0.25, stage: 2 };
const WORDS = { en: '+1 off view', ru: 'ещё 1 за краем' };
// (a camera with every piece of the disc off the window, up and to the left of it: the words then go near the window's
// top-left corner, where they must clear the scale chip)
const FAR = [4.8, -5.1];
const open = async (lang, s, extra = [], at = [0, 0], disc = true) => {
  const ns = `pulloff-${lang}-${s}-${Date.now()}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0 }, ...(disc ? [DISC] : []), ...extra], steps: STEPS, nextId: 50, focus: 0, srcView: { cx: at[0], cy: at[1], s } };
  await view(1440, 900, false, false);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane') && __cmwSteps().planes.length === 3", LOAD_MS);
  await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
  await frames();
};
const off = () => ev("typeof __cmwPullOff === 'function' ? __cmwPullOff() : null");
// the labels the placer drew on the left pane, and the pane's size in css px
const placed = () => ev('__cmwLabelsPlaced()');
const paneSize = () => ev("(() => { const r = document.getElementById('plotL').getBoundingClientRect(); return [r.width, r.height]; })()");
// the boxes of the controls over the left plane, in its css px
const chrome = () => ev(`(() => { const o = document.getElementById('canvasL').getBoundingClientRect(); return [...document.querySelectorAll('#plotL > .chip, #plotL > .legend-chip, #plotL > .options, #plotL > .viewstack, #plotL > .empty-chip')].filter((e) => !e.hidden && e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { x0: r.left - o.left, x1: r.right - o.left, y0: r.top - o.top, y1: r.bottom - o.top, id: e.id || e.className }; }).filter((r) => r.x1 > r.x0 && r.y1 > r.y0); })()`);
for (const lang of ['en', 'ru']) {
  await open(lang, 90);
  const o = await off(), d = o && o.find((e) => e.id === 'd2');
  info[`${lang} z`] = o;
  ok(`${lang}: on z the disc of w₂ has 1 of its 3 pieces off the window`, !!d && d.n === 1 && d.all === 3, o);
  ok(`${lang}: the plane says "${WORDS[lang]}"`, !!d && d.text === WORDS[lang], d && d.text);
  const [W, H] = await paneSize(), lab = (await placed()).find((q) => q.text === WORDS[lang]);
  info[`${lang} z placed`] = lab;
  ok(`${lang}: the placer drew "${WORDS[lang]}" in the pane`, !!lab && lab.x >= 0 && lab.y >= 0 && lab.x1 <= W && lab.y1 <= H, [lab, W, H]);
}
// no piece in view: all 3 counted, the words at the window's edge
await open('en', 90, [], FAR);
const far = await off(), fd = far && far.find((e) => e.id === 'd2'), [FW, FH] = await paneSize();
info['en z, far'] = far;
ok('far from every piece: all 3 are counted', !!fd && fd.n === 3 && fd.all === 3, far);
const fl = (await placed()).find((q) => q.text === '+3 off view'), ch = await chrome();
info['en z, far placed'] = { fl, ch };
ok('far from every piece: the placer drew the words in the pane', !!fl && fl.x >= 0 && fl.y >= 0 && fl.x1 <= FW && fl.y1 <= FH, [fl, FW, FH]);
ok('far from every piece: the words are clear of the controls over the plane', !!fl && ch.length > 0 && !ch.some((r) => fl.x < r.x1 && fl.x1 > r.x0 && fl.y < r.y1 && fl.y1 > r.y0), { fl, ch });
// discs about the critical value: one piece on z, no count
await open('en', 90, CRIT_DISCS);
const crit = await off();
info['en z, critical'] = crit;
for (const d of CRIT_DISCS) ok(`a disc on w₂ about 0, the cube's critical value (${d.c[0]}, r ${d.r}), is not counted`, Array.isArray(crit) && !crit.some((e) => e.id === d.id) && crit.some((e) => e.id === 'd2'), crit);
// the large disc: its far piece shows in the window's top-left, so none is off view
await open('en', 90, [BIG_DISC], [0, 0], false);
const big = await off();
info['en z, large'] = big;
ok('the large disc, whose far piece reaches into the window, is not counted', Array.isArray(big) && !big.some((e) => e.id === 'd5'), big);
// the control: zoomed out, every piece is in the window
await open('en', 30);
const all = await off();
info['en z, zoomed out'] = all;
ok('zoomed out so every piece is in the window: nothing is counted', Array.isArray(all) && !all.some((e) => e.id === 'd2'), all);
// on w₂, the disc's own plane: no pullback, no count
await open('en', 90);
await ev('__cmwSteps({ go: 2, now: true })');
await until('__cmwSteps().i === 2 && !__cmwSteps().moving && __cmwSteps().ready.ready');
await frames();
const own = await off();
info['en w2'] = own;
ok('on w₂, the disc\'s own plane, nothing is counted', Array.isArray(own) && !own.some((e) => e.id === 'd2'), own);
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass, fails, info };
