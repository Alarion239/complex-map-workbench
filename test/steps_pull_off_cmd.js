// The steps view's regions of later planes pulled back to an earlier one (#1700): a piece of a preimage outside the window
// shows nothing, so the plane says how many pieces are off it ("+1 off view"). Cayley, then cube, with a small disc on w₂
// whose three preimages on z are near -4.8 + 5.1i (off the window at the default camera), -0.447 + 0.124i and
// 0.706 + 0.155i:
//  - on z the disc's count is 1 of 3, in English and Russian (the drawn words, __cmwPullOff);
//  - zoomed out so that every piece is in the window, nothing is counted (the control: the count follows the window);
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
const WORDS = { en: '+1 off view', ru: 'ещё 1 за краем' };
const open = async (lang, s) => {
  const ns = `pulloff-${lang}-${s}-${Date.now()}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0 }, DISC], steps: STEPS, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s } };
  await view(1440, 900, false, false);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane') && __cmwSteps().planes.length === 3", LOAD_MS);
  await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
  await frames();
};
const off = () => ev("typeof __cmwPullOff === 'function' ? __cmwPullOff() : null");
for (const lang of ['en', 'ru']) {
  await open(lang, 90);
  const o = await off(), d = o && o.find((e) => e.id === 'd2');
  info[`${lang} z`] = o;
  ok(`${lang}: on z the disc of w₂ has 1 of its 3 pieces off the window`, !!d && d.n === 1 && d.all === 3, o);
  ok(`${lang}: the plane says "${WORDS[lang]}"`, !!d && d.text === WORDS[lang], d && d.text);
  const [W, H] = await ev("(() => { const r = document.getElementById('plotL').getBoundingClientRect(); return [r.width, r.height]; })()");
  ok(`${lang}: the words sit in the pane`, !!d && d.x >= 0 && d.y >= 0 && d.x <= W && d.y <= H, [d, W, H]);
}
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
