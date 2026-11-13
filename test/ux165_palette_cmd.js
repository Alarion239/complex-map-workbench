// The command palette's fixes (notes/ux-build/w1-chain-AS-BUILT.md), in the steps view on a laptop (1366×768):
// a formula with a new letter is a normal row, and Enter adds the step and the number as one undo step; an error is
// grey with its place marked, and its repairs are rows that Enter runs; commands, tools, examples and the guide are
// found by the words people use, with their keys; the highlighted row names its properties in words.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/ux165_palette_cmd.js
// Prints {pass, fails, info, shots}; screenshots go to <daemon folder>/shots/ux165-*.png.
const fails = [], shots = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
const CHAIN = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }];
const DISC = { id: 's1', kind: 'disc', c: [0, 0], r: 1 }, LINE = { id: 's2', kind: 'line', a: [0, 0.5], b: [1, 0.5] };
let nsN = 0;
async function openApp(page, st, w = 1366, h = 768, dark = false, mobile = false, q = '') {
  const ns = 'ux165c' + Date.now() + '_' + (nsN++);
  await view(w, h, dark, mobile);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ until: "document.readyState === 'complete'", max: 8000, only: true });
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/${page}?ns=${ns}${q}` }); await settled({ until: "typeof __cmwP === 'function'", max: 30000 });
  return ns;
}
const P = () => ev('__cmwP()');
let st;
const palOpen = async () => { if (!(await ev(`!!document.getElementById('palInput')`))) { await key('k', 4); await settled({ until: "!!document.getElementById('palInput')", max: 8000 }); } };
const palType = async (q) => { await palOpen(); await ev(`(() => { const i = document.getElementById('palInput'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input')); })()`); await settled({ until: `document.getElementById('palInput').value === ${JSON.stringify(q)}`, max: 8000 }); };
const palRows = () => ev(`[...document.querySelectorAll('.pal-item')].map((e) => ({ label: e.querySelector('.pal-label').textContent, key: (e.querySelector('.pal-props .kbd') || {}).textContent || '', words: (e.querySelector('.pal-pw') || {}).textContent || '', wordsShown: !!(e.querySelector('.pal-pw') && e.querySelector('.pal-pw').getClientRects().length), letters: e.querySelectorAll('.pp').length, sel: e.classList.contains('sel') }))`);
const palState = () => ev(`(() => { const er = document.querySelector('.pal-err'); return { err: er ? er.textContent : null, errColor: er ? getComputedStyle(er).color : null, muted: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim(), bad: !!document.querySelector('.pal-err .pe-bad'), red: !!document.querySelector('.pal-list .err'), enterOff: document.querySelector('.pal-enter').classList.contains('off'), verb: document.querySelector('.pal-verb').textContent, empty: (document.querySelector('.pal-empty:not(.pal-err)') || {}).textContent || null }; })()`);
const palClose = async () => { if (await ev(`!!document.getElementById('palInput')`)) { await key('Escape'); await settled({ until: "!document.getElementById('palInput')", max: 8000 }); } };
const rgb = (c) => (String(c).match(/\d+/g) || []).slice(0, 3).join(',');
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(',') : ''; };
const shot2 = async (name) => { shots.push(await shot('ux165-' + name)); };

// ---- the palette ----
await openApp('test.html', { shapes: [DISC, LINE], steps: CHAIN });
await palType('z^2 + a');
let rows = await palRows(), ps = await palState();
ok('"z^2 + a" is a normal row, no error', rows.length === 1 && rows[0].label === 'Formula, with a new number a = 1' && !ps.err && !ps.red && !ps.enterOff && ps.verb === ' to add', { rows, ps });
await shot2('ux16-palette-new-number');
const h0 = (await P()).hi;
await key('Enter'); await settled({ until: `__cmwP().hi === ${h0 + 1}`, max: 8000 });
st = await P();
ok('Enter adds the step and the number a = 1, as one undo step', st.steps.length === 3 && st.steps[2].type === 'custom' && st.params.map((p) => p.name + '=' + p.value).join() === 'a=1' && st.hi === h0 + 1, { steps: st.steps.map((s) => s.type), params: st.params, hi: st.hi, h0 });
const sig1 = st.sig;
await ev(`Params.set('a', 2), 1`); await settled({ until: `__cmwP().sig !== ${JSON.stringify(sig1)}`, max: 8000 });
ok('the step follows the number', (await P()).sig !== sig1, null);
await key('z', 4); await settled({ until: '__cmwP().steps.length === 2', max: 8000 });
st = await P();
ok('one Undo removes both', st.steps.length === 2 && st.params.length === 0, { steps: st.steps.length, params: st.params });
// errors in grey, with the place marked, and repairs as rows
for (const [q, first, fix] of [['sin(z', 'Close the bracket: sin(z)', 'sin'], ['sinn z', 'Did you mean sin z?', null], ['sni z', 'Did you mean sin z?', null], ['z^^2', 'Did you mean z^2?', null], ['cos z +', 'Drop the trailing +: cos z', null]]) {
  await palType(q);
  rows = await palRows(); ps = await palState();
  ok(`"${q}": the repair row first, the message in grey with its place marked, Enter fixes`, rows[0] && rows[0].label === first && ps.err && /Not a formula yet/.test(ps.err) && ps.bad && !ps.red && rgb(ps.errColor) === hexRgb(ps.muted) && ps.verb === ' to fix', { rows: rows.map((r) => r.label), ps });
  if (q === 'sin(z') {
    const ff = await ev(`({ q: getComputedStyle(document.querySelector('.pal-err .pe-q')).fontFamily, inp: getComputedStyle(document.getElementById('palInput')).fontFamily })`);
    ok('the typed formula is shown in the palette input\'s face (the old mono face, B612 Mono, drew "(" as "[")', ff.q === ff.inp && !/B612/.test(ff.q.split(',')[0]), ff);
    await shot2('ux23-palette-error');
    const n0 = (await P()).steps.length;
    await key('Enter'); await settled({ until: `__cmwP().steps.length === ${n0 + 1}`, max: 8000 });
    ok('Enter on "Close the bracket" adds sin z', (await P()).steps.length === n0 + 1 && (await P()).steps[n0].type === fix, (await P()).steps.map((s) => s.type));
  }
}
await palType('zero');
rows = await palRows(); ps = await palState();
ok('"zero": no error for a plain word that finds things; Zeros and poles is offered', !ps.err && !ps.red && rows.some((r) => r.label === 'Zeros and poles'), { rows: rows.map((r) => r.label), ps });
await palType('qqqq');
ps = await palState();
ok('nothing to run: Enter is grey', ps.enterOff && !!ps.empty, ps);
// commands, tools, examples and the guide, by the words people use, with their keys
const want = { png: ['Export figure…', /⌘E|Ctrl E/], export: ['Export figure…', /⌘E|Ctrl E/], help: ['Open the guide', /\?/], dark: ['Theme: Dark', /^$/], disc: ['Tool: Disc', /^D$/], new: ['New: empty canvas', /^$/], keys: ['Keyboard shortcuts', /\?/], replace: ['Inverse of f₁ (Exponential)', /^$/], link: ['Copy link to this figure', /^$/], scene: ['Save scene (.cmw.json)', /^$/], example: ['Examples…', /^$/], alone: ['Show f₃ alone', /^L$/], rectangle: ['Tool: Rectangle', /^B$/], cut: ['Guide: Branch cuts', /^$/] };
for (const [q, [label, keyRe]] of Object.entries(want)) {
  await palType(q);
  rows = await palRows(); ps = await palState();
  const r = rows.find((x) => x.label === label);
  ok(`"${q}" finds ${label} with its key`, !!r && keyRe.test(r.key) && !ps.err, { rows: rows.map((x) => x.label + ' [' + x.key + ']') });
}
await palType('empty'); rows = await palRows();
ok('"empty" finds New: empty canvas once (the example row is the command)', rows.filter((x) => /empty canvas/i.test(x.label)).length === 1 && rows.some((x) => x.label === 'New: empty canvas'), rows.map((x) => x.label));
await palType('strip'); rows = await palRows();
ok('an example is found by its name; on it, the footer says Enter to open', rows.some((x) => /Strip to disk/.test(x.label)) && (!/Strip to disk/.test(rows[0].label) || (await palState()).verb === ' to open'), { rows: rows.map((x) => x.label), ps: await palState() });
await palType('png');
ok('the footer says Enter to run on a command', (await palState()).verb === ' to run', await palState());
await shot2('ux03-palette-png');
await palType('dark'); await key('Enter'); await settled({ until: "document.documentElement.dataset.theme === 'dark'", max: 8000 });
ok('Theme: Dark runs', (await ev(`document.documentElement.dataset.theme`)) === 'dark', await ev(`document.documentElement.dataset.theme`));
await palType('auto'); rows = await palRows();
await ev(`[...document.querySelectorAll('.pal-item')].find((e) => e.querySelector('.pal-label').textContent === 'Theme: Auto').click()`); await settled({ until: "document.documentElement.dataset.theme !== 'dark'", max: 8000 });
await palType('keys'); await ev(`[...document.querySelectorAll('.pal-item')].find((e) => e.querySelector('.pal-label').textContent === 'Guide: Keys').click()`); await settled({ until: "(() => { const m = document.querySelector('.modal'); return !!m && [...m.querySelectorAll('h3')].some((x) => x.textContent === 'Keys'); })()", max: 8000 });
const gk = await ev(`(() => { const m = document.querySelector('.modal'); if (!m) return null; const hd = [...m.querySelectorAll('h3')].find((x) => x.textContent === 'Keys'); const b = hd.getBoundingClientRect(), mb = (m.querySelector('.modal-body') || m).getBoundingClientRect(); return { top: b.top, mt: mb.top, mb: mb.bottom }; })()`);
ok('Guide: Keys opens the guide at Keys', gk && gk.top >= gk.mt - 2 && gk.top < gk.mb, gk);
await key('Escape'); await settled({ until: "!document.querySelector('.modal')", max: 8000 });
// the steps view owns the surface: the palette offers Surface rows, and no row of the removed view switch or its keys
const surfLabel = () => ev(`document.querySelector('.sv-surf1').getAttribute('aria-label')`);
const seen = [];
for (const q of ['surface', 'landscape', 'sphere', 'phase', 'plane', 'view', 'fit']) { await palType(q); seen.push(...(await palRows())); }
ok('no row of the removed view switch: View:, X:, Y:, Phase: rows', !seen.some((r) => /^(View|X|Y|Phase): /.test(r.label)), seen.map((r) => r.label));
ok('no palette row carries the removed keys 1 to 3 or ⇧1 to ⇧4', !seen.some((r) => /^⇧?[1-4]$/.test(r.key)), seen.filter((r) => /^⇧?[1-4]$/.test(r.key)));
await palType('surface'); rows = await palRows();
ok('"surface" offers Surface: Plane, Sphere and Landscape, with no key', ['Plane', 'Sphere', 'Landscape'].every((n) => rows.some((r) => r.label === 'Surface: ' + n && r.key === '')), rows.map((r) => r.label + ' [' + r.key + ']'));
await palType('globe'); rows = await palRows();
ok('"globe" finds Surface: Sphere', rows.some((r) => r.label === 'Surface: Sphere'), rows.map((r) => r.label));
await palType('Surface: Sphere'); await key('Enter'); await settled({ until: "/Sphere/.test(document.querySelector('.sv-surf1').getAttribute('aria-label'))", max: 8000, only: true });
ok('Surface: Sphere runs: the plane head names the Sphere', /Sphere/.test(await surfLabel()), await surfLabel());
await palType('Surface: Plane'); await key('Enter'); await settled({ until: "/Plane/.test(document.querySelector('.sv-surf1').getAttribute('aria-label'))", max: 8000, only: true });
ok('Surface: Plane runs: back to the plane', /Plane/.test(await surfLabel()), await surfLabel());
await palType('fit'); rows = await palRows();
ok('"fit" finds Fit view with its key Z, and no "Fit both planes"', rows.some((r) => r.label === 'Fit view' && r.key === 'Z') && !rows.some((r) => /both planes/.test(r.label)), rows.map((r) => r.label + ' [' + r.key + ']'));
await palType('surface'); await shot2('p8-palette-surface');
await palClose();
// no row of letters; the highlighted row names its properties in words
await palType('sin');
rows = await palRows();
ok('no A E R P M Pr I letters; the highlighted row shows its properties in words, the others none', rows.every((r) => r.letters === 0) && rows[0].sel && rows[0].wordsShown && /Entire/.test(rows[0].words) && rows.slice(1).every((r) => !r.wordsShown), rows.slice(0, 4));
await shot2('ux82-palette-words');
await palClose();
await openApp('test.html', { shapes: [DISC, LINE], steps: CHAIN });
await palType('Surface: Landscape'); await key('Enter'); await settled({ until: "/Landscape/.test(document.querySelector('.sv-surf1').getAttribute('aria-label'))", max: 8000, only: true });
ok('Surface: Landscape runs: the plane head names the Landscape', /Landscape/.test(await surfLabel()), await surfLabel());
await grab();
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info, shots: shots.map((s) => s.replace(/^.*\/shots\//, '')) };
