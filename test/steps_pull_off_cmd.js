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
//  - smaller (r 0.18, at 1280 x 800): its third piece shows only as a sliver at the window's top-left corner (the
//    control counts the pane's pixels in it, from w₂ = ((z − i)/(z + i))³), so nothing is off view either;
//  - the words keep off the axes, in English and Russian (at the default camera they sit beside the piece at -0.447 +
//    0.124i, by the imaginary axis);
//  - the plane's description says the count in words (#1770);
//  - zoomed out in place, a frame that places no label leaves none in the placer's list (#1893);
//  - with two regions counted, each count names its region (#1892);
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
// (a second small disc on w₂, for two regions counted at once)
const TWIN_DISC = { id: 'd7', kind: 'disc', c: [-0.4465, 0.3], r: 0.03, stage: 2 };
// (the disc a little smaller: its far piece shows only at the window's top-left corner, at 1280 x 800)
const SLIVER_DISC = { id: 'd6', kind: 'disc', c: [0.4465, 0.3], r: 0.18, stage: 2 }, SLIVER_VIEW = [1280, 800];
const WORDS = { en: '+1 off view', ru: 'ещё 1 за краем' };
// (a camera with every piece of the disc off the window, up and to the left of it: the words then go near the window's
// top-left corner, where they must clear the scale chip)
const FAR = [4.8, -5.1];
const open = async (lang, s, extra = [], at = [0, 0], disc = true, size = [1440, 900]) => {
  const ns = `pulloff-${lang}-${s}-${Date.now()}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0 }, ...(disc ? [DISC] : []), ...extra], steps: STEPS, nextId: 50, focus: 0, srcView: { cx: at[0], cy: at[1], s } };
  await view(size[0], size[1], false, false);
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
  // (the axes run through the pane's centre at this camera, centred on 0)
  ok(`${lang}: the words keep off the axes`, !!lab && !(lab.x < W / 2 && lab.x1 > W / 2) && !(lab.y < H / 2 && lab.y1 > H / 2), [lab, W, H]);
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
// the smaller disc: its far piece shows only at the window's corner, so none is off view either
await open('en', 90, [SLIVER_DISC], [0, 0], false, SLIVER_VIEW);
const sl = await off();
// (the control: the pane's pixels in the far piece, z with ((z − i)/(z + i))³ in the disc whose cube root is nearest the
// far preimage's, from the camera at 0, 90 px a unit)
const peek = await ev(`(() => {
  const r = document.getElementById('canvasL').getBoundingClientRect(), W = r.width, H = r.height, c = ${JSON.stringify(SLIVER_DISC.c)}, R = ${SLIVER_DISC.r};
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], div = (a, b) => { const q = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / q, (a[1] * b[0] - a[0] * b[1]) / q]; };
  const m = Math.hypot(c[0], c[1]) ** (1 / 3), a0 = Math.atan2(c[1], c[0]) / 3, roots = [0, 1, 2].map((k) => [m * Math.cos(a0 + 2 * Math.PI * k / 3), m * Math.sin(a0 + 2 * Math.PI * k / 3)]);
  // (the far preimage: z = i (1 + t)/(1 - t) farthest from 0)
  const zOf = (t) => mul([0, 1], div([1 + t[0], t[1]], [1 - t[0], -t[1]])), far = roots.reduce((p, q) => (Math.hypot(...zOf(q)) > Math.hypot(...zOf(p)) ? q : p));
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const z = [(x + 0.5 - W / 2) / 90, -(y + 0.5 - H / 2) / 90], t = div([z[0], z[1] - 1], [z[0], z[1] + 1]), w = mul(mul(t, t), t);
    if (Math.hypot(w[0] - c[0], w[1] - c[1]) >= R) continue;
    const near = roots.reduce((p, q) => (Math.hypot(t[0] - q[0], t[1] - q[1]) < Math.hypot(t[0] - p[0], t[1] - p[1]) ? q : p));
    if (near === far) n++;
  }
  return { n, W, H };
})()`);
info['en z, sliver'] = { sl, peek };
ok(`the smaller disc's far piece shows in the window at ${SLIVER_VIEW.join(' x ')} (the control: some of the pane's pixels lie in it)`, peek.n > 0, peek);
ok('the smaller disc, whose far piece shows only at the window\'s corner, is not counted', Array.isArray(sl) && !sl.some((e) => e.id === 'd6'), { sl, peek });
// the control: zoomed out, every piece is in the window
await open('en', 30);
const all = await off();
info['en z, zoomed out'] = all;
ok('zoomed out so every piece is in the window: nothing is counted', Array.isArray(all) && !all.some((e) => e.id === 'd2'), all);
// the count in words, in the plane's description (#1770): at the default camera, d2's 1 of 3 pieces off the view
await open('en', 90);
{
  const said = await ev(`(() => {
    const c = document.getElementById('overlayL'), id = c.getAttribute('aria-describedby'), d = id && document.getElementById(id);
    const t = $t('Pieces of {name} pulled back off the view: {n} of {all}', { name: '\\u0000', n: 1, all: 3 }).split('\\u0000');
    return { text: d ? d.textContent : null, head: t[0], tail: t[1] };
  })()`);
  info['en z, said'] = said;
  const at = said.text ? said.text.indexOf(said.head) : -1;
  ok('the plane\'s description says the count: "Pieces of <the disc> pulled back off the view: 1 of 3"', at >= 0 && said.text.indexOf(said.tail, at + said.head.length + 1) > at, said);
}
// a frame that places no label (zoomed out, with no reload): the placer's list (__cmwLabelsPlaced) is that frame's, with
// none of the counts an earlier frame placed (#1893)
{
  const before = (await placed()).some((q) => q.text === WORDS.en);
  await ev("__cmwSet('srcView', { cx: 0, cy: 0, s: 30 }), 1");
  await until('__cmwSteps().ready.ready && Math.abs(__cmwSteps().win[2] - 30) < 1e-9');
  await frames(); await settled({ max: 20000 });
  const o2 = await off(), now = await placed();
  info['en z, zoomed out in place'] = { o2, now };
  ok('zoomed out in place: the count was placed before (the control)', before, before);
  ok('zoomed out in place: nothing is counted, and the placer\'s list does not keep the last frame\'s count', Array.isArray(o2) && !o2.some((e) => e.id === 'd2') && !now.some((q) => /off view/.test(q.text)), { o2, now });
}
// two regions counted on z (the camera far from every piece): each count names its region as its row does, so the two are
// told apart by more than their inks (#1892); one region counted keeps the bare count (the far scene above)
await open('en', 90, [TWIN_DISC], FAR);
{
  const two = await off(), names = await ev(`(() => { const t = $t('{name}: +{n} off view', { name: '\\u0000', n: 9 }).split('\\u0000'); return t; })()`);
  info['en z, two regions'] = { two, names };
  const a = two && two.find((e) => e.id === 'd2'), b = two && two.find((e) => e.id === TWIN_DISC.id);
  const nameOf = (e) => (e && e.text.endsWith(names[1].replace('9', String(e.n))) ? e.text.slice(names[0].length, e.text.length - names[1].replace('9', String(e.n)).length) : null);
  ok('two regions counted (the control: both have pieces off the view)', !!a && !!b && a.n > 0 && b.n > 0, two);
  ok('two regions counted: each count names its region ("<name>: +n off view"), and the names differ', !!a && !!b && !!nameOf(a) && !!nameOf(b) && nameOf(a) !== nameOf(b), [a && a.text, b && b.text]);
}
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
