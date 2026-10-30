// v16.5 wave 1, the chain piece (notes/ux-build/w1-chain-AS-BUILT.md; the audit: notes/ux-audit/REPORT.md): every fix of
// UX01 UX03 UX16 UX22 UX23 UX25 UX32 UX33 UX65 UX79 UX81 UX82 UX84 UX85 V03, on a laptop (1366×768) and a phone
// (412×860 and 915×412, Android emulation, real touch events), in light and dark, and in Russian.
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/ux165_chain_cmd.js
// Prints {pass, fails, info, shots}; screenshots go to <daemon folder>/shots/ux165-*.png. With dist/base.html (the v16.4
// snapshot's test page) next to dist/test.html, the same scenes are shot there too, as ux165-*-before.png.
const fails = [], shots = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
const BASE = await (async () => { try { const r = await fetch(`http://localhost:${PORT}/base.html`, { method: 'HEAD' }); return r.ok; } catch (e) { return false; } })();
const CHAIN = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }];
const DISC = { id: 's1', kind: 'disc', c: [0, 0], r: 1 }, LINE = { id: 's2', kind: 'line', a: [0, 0.5], b: [1, 0.5] };
let nsN = 0;
// open a page (test.html or base.html) with a saved state, at a size, light or dark, as a phone or not
async function openApp(page, st, w = 1366, h = 768, dark = false, mobile = false, q = '') {
  const ns = 'ux165c' + Date.now() + '_' + (nsN++);
  await view(w, h, dark, mobile);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/${page}?ns=${ns}${q}` }); await sleep(2300);
  await settle(600);
  return ns;
}
const P = () => ev('__cmwP()');
const C = () => ev('__cmwCards()');
const toasts = () => ev('__qa.toasts()');
const center = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
const touch = async (x, y, hold = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(hold); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const tap = async (sel, wait = 450) => { const c = await center(sel); if (!c) return false; await touch(c[0], c[1]); await settle(wait); return true; };
const palOpen = async () => { if (!(await ev(`!!document.getElementById('palInput')`))) { await key('k', 4); await settle(350); } };
const palType = async (q) => { await palOpen(); await ev(`(() => { const i = document.getElementById('palInput'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input')); })()`); await settle(300); };
const palRows = () => ev(`[...document.querySelectorAll('.pal-item')].map((e) => ({ label: e.querySelector('.pal-label').textContent, key: (e.querySelector('.pal-props .kbd') || {}).textContent || '', words: (e.querySelector('.pal-pw') || {}).textContent || '', wordsShown: !!(e.querySelector('.pal-pw') && e.querySelector('.pal-pw').getClientRects().length), letters: e.querySelectorAll('.pp').length, sel: e.classList.contains('sel') }))`);
const palState = () => ev(`(() => { const er = document.querySelector('.pal-err'); return { err: er ? er.textContent : null, errColor: er ? getComputedStyle(er).color : null, muted: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim(), bad: !!document.querySelector('.pal-err .pe-bad'), red: !!document.querySelector('.pal-list .err'), enterOff: document.querySelector('.pal-enter').classList.contains('off'), verb: document.querySelector('.pal-verb').textContent, empty: (document.querySelector('.pal-empty:not(.pal-err)') || {}).textContent || null }; })()`);
const palClose = async () => { if (await ev(`!!document.getElementById('palInput')`)) { await key('Escape'); await settle(250); } };
const rgb = (c) => (String(c).match(/\d+/g) || []).slice(0, 3).join(',');
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(',') : ''; };
const shot2 = async (name) => { shots.push(await shot('ux165-' + name)); };

// ======================= the laptop, 1366×768, light =======================
// ---- UX01 (restores 'X on the left' and 'Show alone is its own choice') ----
await openApp('test.html', { shapes: [DISC], steps: CHAIN });
await palType('sin z'); await key('Enter'); await settle(900);
let c = await C(), t = await toasts();
let titles = await ev(`({ l: document.getElementById('leftTitle').textContent, r: document.getElementById('rightTitle').textContent, chip: !document.getElementById('aloneChip').hidden, insp: (document.querySelector('#propsPanel .insp-step') || {}).dataset ? document.querySelector('#propsPanel .insp-step').dataset.k : null, acts: [...document.querySelectorAll('#toastHost .toast-act')].map((b) => b.textContent) })`);
ok('UX01 add: the planes keep F (focus 0), X stays the z-plane, no alone chip', c.focus === 0 && /z-plane/.test(titles.l) && /F\(z\)/.test(titles.r) && !titles.chip, { c: c.focus, titles });
ok('UX01 add: the new card is selected and the Inspector edits it', c.sel === 3 && titles.insp === '3', { sel: c.sel, insp: titles.insp });
ok('UX01 add: toast "Added f₃ Sine · Show alone · Undo"', /^Added f₃ Sine/.test(t[0] || '') && titles.acts.join() === 'Show alone,Undo', { t, acts: titles.acts });
await shot2('ux01-after-add');
await ev(`[...document.querySelectorAll('#toastHost .toast-act')].find((b) => b.textContent === 'Show alone').click()`); await settle(700);
ok('UX01 the toast\'s Show alone shows f₃ alone', (await C()).focus === 3, await C());
await ev(`document.getElementById('viewAllBtn').click()`); await settle(500);
ok('UX85 the chain head button reads Show F and returns to F', (await ev(`document.getElementById('viewAllBtn').textContent`)) === 'Show F' && (await C()).focus === 0, await ev(`document.getElementById('viewAllBtn').textContent`));
// Move (Alt+→ on a card, UX81) and Duplicate keep F, select the moved or new card
await ev(`document.querySelector('#pipeline .card[data-k="1"]').focus()`); await key('ArrowRight', 1); await settle(700);
let st = await P(); c = await C();
ok('UX81 Alt+→ moves f₁ one place; UX01 the planes keep F; the moved card is selected and keeps the keyboard', st.steps.map((s) => s.type).join() === 'mobius,exp,sin' && c.focus === 0 && c.sel === 2 && (await ev(`document.activeElement && document.activeElement.dataset.k`)) === '2', { types: st.steps.map((s) => s.type), c, t: await toasts() });
ok('UX01 move toast names it, with Undo', /^Moved Exponential to f₂/.test((await toasts())[0] || ''), await toasts());
await key('ArrowLeft', 1); await settle(700);
ok('UX81 Alt+← moves it back', (await P()).steps.map((s) => s.type).join() === 'exp,mobius,sin', (await P()).steps.map((s) => s.type));
await ev(`document.querySelector('#pipeline .card[data-k="2"] .more').click()`); await settle(300);
await ev(`[...document.querySelectorAll('#popHost .menu [role="menuitem"], #popHost .menu button')].find((b) => /Duplicate/.test(b.textContent)).click()`); await settle(800);
c = await C();
ok('UX01 Duplicate keeps F and selects the copy; toast "Duplicated f₂ as f₃"', c.focus === 0 && c.sel === 3 && (await P()).steps.length === 4 && /^Duplicated f₂ as f₃/.test((await toasts())[0] || ''), { c, t: await toasts() });
// a step shown alone stays shown when a step is added after it
await ev(`document.querySelector('#pipeline .card[data-k="1"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`); await settle(600);
await palType('cos z'); await key('Enter'); await settle(900);
c = await C();
ok('UX01 with f₁ alone, a step added after it keeps f₁ alone and selects the new f₂', c.focus === 1 && c.sel === 2 && (await P()).steps[1].type === 'cos', { c, steps: (await P()).steps.map((s) => s.type) });
// ---- UX79: Undo says what it undid, Redo is in the toast, the tooltip names the action ----
await key('z', 4); await settle(800);
ok('UX79 undo toast "Undid: add f₂ Cosine." with Redo', /^Undid: add f₂ Cosine\./.test((await toasts())[0] || '') && (await ev(`[...document.querySelectorAll('#toastHost .toast-act')].map((b) => b.textContent).join()`)) === 'Redo', await toasts());
await ev(`[...document.querySelectorAll('#toastHost .toast-act')].find((b) => b.textContent === 'Redo').click()`); await settle(800);
ok('UX79 the toast\'s Redo redoes, and says so', (await P()).steps[1].type === 'cos' && /^Redid: add f₂ Cosine/.test((await toasts())[0] || ''), { t: await toasts(), steps: (await P()).steps.map((s) => s.type) });
{ const u = await center('#undoBtn'); await move(u[0], u[1]); await settle(200); await move(u[0] + 600, u[1] + 300); }   // (a real pointer over Undo)
ok('UX79 the Undo tooltip names the action', /^Undo: add f₂ Cosine  (⌘Z|Ctrl Z)$/.test(await ev(`document.getElementById('undoBtn').dataset.tip`)), await ev(`document.getElementById('undoBtn').dataset.tip`));
await grab();

// zeros and poles: "add pole p₂ of f₁"; the Factor word (UX33)
await openApp('test.html', { shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '0.5', poles: '-0.5' }, on: true }], sel: 1 });
await ev(`document.querySelector('#pipeline .card[data-k="1"]').click()`); await settle(500);
await ev(`document.querySelector('#propsPanel .zp-add.poles').click()`); await settle(600);
await key('z', 4); await settle(700);
ok('UX79 "Undid: add pole p₂ of f₁."', /^Undid: add pole p₂ of f₁\./.test((await toasts())[0] || ''), await toasts());
await shot2('ux79-undo-toast');
const fac = await ev(`(() => { const l = document.querySelector('#propsPanel .insp-step label.pl:not(.zp-sym)'); return l ? l.textContent : null; })()`);
ok('UX33 the zeros-and-poles factor reads "Factor a₁"', fac === 'Factor a1', fac);
await grab();

// ---- UX16, UX23, UX03, UX82 (the palette) ----
await openApp('test.html', { shapes: [DISC, LINE], steps: CHAIN });
await palType('z^2 + a');
let rows = await palRows(), ps = await palState();
ok('UX16 "z^2 + a" is a normal row, no error', rows.length === 1 && rows[0].label === 'Formula, with a new number a = 1' && !ps.err && !ps.red && !ps.enterOff && ps.verb === ' to add', { rows, ps });
await shot2('ux16-palette-new-number');
const h0 = (await P()).hi;
await key('Enter'); await settle(900);
st = await P();
ok('UX16 Enter adds the step and the number a = 1, as one undo step', st.steps.length === 3 && st.steps[2].type === 'custom' && st.params.map((p) => p.name + '=' + p.value).join() === 'a=1' && st.hi === h0 + 1, { steps: st.steps.map((s) => s.type), params: st.params, hi: st.hi, h0 });
const sig1 = st.sig;
await ev(`Params.set('a', 2), 1`); await settle(500);
ok('UX16 the step follows the number', (await P()).sig !== sig1, null);
await key('z', 4); await settle(700);
st = await P();
ok('UX16 one Undo removes both', st.steps.length === 2 && st.params.length === 0, { steps: st.steps.length, params: st.params });
// UX23: errors in grey, with the place marked, and repairs as rows
for (const [q, first, fix] of [['sin(z', 'Close the bracket: sin(z)', 'sin'], ['sinn z', 'Did you mean sin z?', null], ['sni z', 'Did you mean sin z?', null], ['z^^2', 'Did you mean z^2?', null], ['cos z +', 'Drop the trailing +: cos z', null]]) {
  await palType(q);
  rows = await palRows(); ps = await palState();
  ok(`UX23 "${q}": the repair row first, the message in grey with its place marked, Enter fixes`, rows[0] && rows[0].label === first && ps.err && /Not a formula yet/.test(ps.err) && ps.bad && !ps.red && rgb(ps.errColor) === hexRgb(ps.muted) && ps.verb === ' to fix', { rows: rows.map((r) => r.label), ps });
  if (q === 'sin(z') {
    const ff = await ev(`({ q: getComputedStyle(document.querySelector('.pal-err .pe-q')).fontFamily, inp: getComputedStyle(document.getElementById('palInput')).fontFamily })`);
    ok('UX23 the typed formula is shown in the palette input\'s face (B612 Mono drew "(" as "[")', ff.q === ff.inp && !/B612/.test(ff.q.split(',')[0]), ff);
    await shot2('ux23-palette-error');
    const n0 = (await P()).steps.length;
    await key('Enter'); await settle(900);
    ok('UX23 Enter on "Close the bracket" adds sin z', (await P()).steps.length === n0 + 1 && (await P()).steps[n0].type === fix, (await P()).steps.map((s) => s.type));
  }
}
await palType('zero');
rows = await palRows(); ps = await palState();
ok('UX23/UX03 "zero": no error for a plain word that finds things; Zeros and poles is offered', !ps.err && !ps.red && rows.some((r) => r.label === 'Zeros and poles'), { rows: rows.map((r) => r.label), ps });
await palType('qqqq');
ps = await palState();
ok('UX23 nothing to run: Enter is grey', ps.enterOff && !!ps.empty, ps);
// UX03: commands, tools, examples and the guide, by the words people use, with their keys
const want = { png: ['Export figure…', /⌘E|Ctrl E/], export: ['Export figure…', /⌘E|Ctrl E/], help: ['Open the guide', /\?/], dark: ['Theme: Dark', /^$/], disc: ['Tool: Disc', /^D$/], new: ['New: empty canvas', /^$/], keys: ['Keyboard shortcuts', /\?/], replace: ['Inverse of f₁ (Exponential)', /^$/], link: ['Copy link to this figure', /^$/], scene: ['Save scene (.cmw.json)', /^$/], example: ['Examples…', /^$/], alone: ['Show f₃ alone', /^L$/], rectangle: ['Tool: Rectangle', /^B$/], cut: ['Guide: Branch cuts', /^$/] };
for (const [q, [label, keyRe]] of Object.entries(want)) {
  await palType(q);
  rows = await palRows(); ps = await palState();
  const r = rows.find((x) => x.label === label);
  ok(`UX03 "${q}" finds ${label} with its key`, !!r && keyRe.test(r.key) && !ps.err, { rows: rows.map((x) => x.label + ' [' + x.key + ']') });
}
await palType('empty'); rows = await palRows();
ok('UX03 "empty" finds New: empty canvas once (the example row is the command)', rows.filter((x) => /empty canvas/i.test(x.label)).length === 1 && rows.some((x) => x.label === 'New: empty canvas'), rows.map((x) => x.label));
await palType('strip'); rows = await palRows();
ok('UX03 an example is found by its name; on it, the footer says Enter to open', rows.some((x) => /Strip to disk/.test(x.label)) && (!/Strip to disk/.test(rows[0].label) || (await palState()).verb === ' to open'), { rows: rows.map((x) => x.label), ps: await palState() });
await palType('png');
ok('UX03 the footer says Enter to run on a command', (await palState()).verb === ' to run', await palState());
await shot2('ux03-palette-png');
await palType('dark'); await key('Enter'); await settle(500);
ok('UX03 Theme: Dark runs', (await ev(`document.documentElement.dataset.theme`)) === 'dark', await ev(`document.documentElement.dataset.theme`));
await palType('auto'); rows = await palRows();
await ev(`[...document.querySelectorAll('.pal-item')].find((e) => e.querySelector('.pal-label').textContent === 'Theme: Auto').click()`); await settle(400);
await palType('keys'); await ev(`[...document.querySelectorAll('.pal-item')].find((e) => e.querySelector('.pal-label').textContent === 'Guide: Keys').click()`); await settle(800);
const gk = await ev(`(() => { const m = document.querySelector('.modal'); if (!m) return null; const hd = [...m.querySelectorAll('h3')].find((x) => x.textContent === 'Keys'); const b = hd.getBoundingClientRect(), mb = (m.querySelector('.modal-body') || m).getBoundingClientRect(); return { top: b.top, mt: mb.top, mb: mb.bottom }; })()`);
ok('UX03 Guide: Keys opens the guide at Keys', gk && gk.top >= gk.mt - 2 && gk.top < gk.mb, gk);
await key('Escape'); await settle(400);
// UX82: no row of letters; the highlighted row names its properties in words
await palType('sin');
rows = await palRows();
ok('UX82 no A E R P M Pr I letters; the highlighted row shows its properties in words, the others none', rows.every((r) => r.letters === 0) && rows[0].sel && rows[0].wordsShown && /Entire/.test(rows[0].words) && rows.slice(1).every((r) => !r.wordsShown), rows.slice(0, 4));
await shot2('ux82-palette-words');
await palClose();
// ---- V03: integrate asks which curve, and the result sits beside it in X ----
await palType('integrate');
rows = await palRows();
ok('V03 nothing selected: one row per curve, named as in the planes\' menu', rows[0] && rows[0].label === '∮ F dz around Disc 1' && rows[1] && rows[1].label === 'Integrate F along Line 1', rows.map((r) => r.label));
await key('Enter'); await settle(900);
const ip = await ev(`(() => { const p = document.querySelector('.int-pop'), R = document.getElementById('paneR').getBoundingClientRect(); if (!p) return null; const b = p.getBoundingClientRect(); return { r: b.right, l: b.left, Rl: R.left, title: p.querySelector('.int-title').textContent }; })()`);
ok('V03 the result is over X, never over Y', ip && ip.r <= ip.Rl && /Disc 1/.test(ip.title), ip);
await shot2('v03-integral-beside');
await key('Escape'); await settle(300);
await grab();

// ---- UX84, UX22: the empty chain's F tile, Formula cards, the + card's label ----
await openApp('test.html', { shapes: [DISC], steps: [] });
let ft = await ev(`(() => { const t = document.querySelector('#pipeline .ftile'); return { ident: t.classList.contains('ident'), fF: t.querySelector('.fF').innerText.replace(/\\s+/g, ' '), lit: [...t.querySelectorAll('.lamp')].filter((l) => l.getClientRects().length).length, aria: t.getAttribute('aria-label') }; })()`);
ok('UX84 an empty chain\'s F tile reads F = z, with no guarantees listed', ft.ident && /^F\s?=\s?z$/.test(ft.fF.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()) && ft.lit === 0 && /^F = z/.test(ft.aria), ft);
let ac = await ev(`(() => { const a = document.getElementById('addStepBtn'), l = a.querySelector('span:nth-child(2)'); return { cls: a.className, txt: l.textContent, shown: l.getClientRects().length > 0 && l.offsetHeight > 20, cut: l.scrollHeight > l.clientHeight + 1 }; })()`);
ok('UX22 the + card says Add function, whole', /labelled/.test(ac.cls) && ac.shown && ac.txt === 'Add function' && !ac.cut, ac);
await shot2('ux84-empty-chain');
await palType('z^2+1/z'); rows = await palRows();
await key('Enter'); await settle(900);
const card = await ev(`(() => { const c = document.querySelector('#pipeline .card[data-k="1"]'); return { nm: c.querySelector('.nm').textContent, tip: c.dataset.tip, aria: c.getAttribute('aria-label') }; })()`);
ok('UX84 a typed step is a "Formula" card; the formula only in its tooltip and aria label', rows[0].label === 'Formula' && card.nm === 'Formula' && /z\^2\+1\/z/.test(card.tip || '') && /Formula z\^2\+1\/z/.test(card.aria), { row: rows[0], card });
ft = await ev(`document.querySelector('#pipeline .ftile').classList.contains('ident')`);
ok('UX84 with a step, the tile shows its guarantees again', ft === false, ft);
// four steps: no label
await openApp('test.html', { shapes: [DISC], steps: CHAIN.concat(CHAIN) });
ac = await ev(`(() => { const a = document.getElementById('addStepBtn'), l = a.querySelector('span:nth-child(2)'); return { cls: a.className, shown: l.getClientRects().length > 0 }; })()`);
ok('UX22 with four steps the + card is the plain 44 px tile', !/labelled/.test(ac.cls) && !ac.shown, ac);
await grab();

// ---- UX33, UX85, UX65 (the Inspector), UX81 (the ⊕) ----
await openApp('test.html', { shapes: [DISC], steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }, { type: 'custom', params: { expr: 'e^{1/z}', cut: 180 }, on: true }, { type: 'custom', params: { expr: '\\log(z+2)', cut: 180 }, on: true }], sel: 1 });
await ev(`document.querySelector('#pipeline .card[data-k="1"]').click()`); await settle(600);
const lab = () => ev(`[...document.querySelectorAll('#propsPanel .insp-step label.pl')].map((l) => l.textContent)`);
let L = await lab();
ok('UX33 the root step\'s fields read Root index n₁, Cut angle θ, Sheet k', L.join('|') === 'Root index n1|Cut angle θ|Sheet k', L);
const note1 = await ev(`document.querySelector('#propsPanel .insp-step .inote').textContent`);
ok('UX33 the note does not repeat the cut and the sheet', !/cut 180°/.test(note1) && (note1.match(/sheet/gi) || []).length <= 1, note1);
const alone = await ev(`(() => { const b = document.querySelector('#propsPanel .alone-btn'); return { tip: b.dataset.tip, rect: !!b.querySelector('svg rect'), circle: !!b.querySelector('svg circle') }; })()`);
ok('UX85 the button is Show alone, not a magnifier', alone.tip === 'Show alone  L' && alone.rect && !alone.circle, alone);
await shot2('ux33-ux85-inspector');
await ev(`document.querySelector('#propsPanel .alone-btn').click()`); await settle(600);
ok('UX85 while on, the same button reads Show F; the chip\'s × too', (await ev(`document.querySelector('#propsPanel .alone-btn').dataset.tip`)) === 'Show F  L' && (await ev(`document.querySelector('#aloneChip .icon-btn:last-child').getAttribute('aria-label')`)) === 'Show F', await ev(`document.querySelector('#propsPanel .alone-btn').dataset.tip`));
await ev(`document.querySelector('#propsPanel .alone-btn').click()`); await settle(600);
// θ follows the seam dragged on the map
const hs = await ev('__cmwCutHandles()');
const h1 = hs.find((x) => x.step === 1);
if (h1) {
  await drag(h1.x, h1.y, h1.x + 10, h1.y - 70, 10, 16); await settle(600);
  const cut = (await P()).steps[0].params.cut, fv = await ev(`document.querySelector('#propsPanel .insp-step input[data-pkey="cut"]').value`);
  ok('UX33 the Inspector\'s θ follows the seam dragged on the map', cut !== 180 && Number(fv) === Number(cut), { cut, fv });
} else ok('UX33 a cut handle to drag', false, hs);
await ev(`document.querySelector('#pipeline .card[data-k="2"]').click()`); await settle(600);
L = await lab();
ok('UX33 e^{1/z} has no cut: no θ field', !L.some((x) => /θ/.test(x)), L);
await ev(`document.querySelector('#pipeline .card[data-k="3"]').click()`); await settle(600);
L = await lab();
ok('UX33 log(z+2) has a cut: Cut angle θ', L.includes('Cut angle θ'), L);
// UX81: the ⊕ is 24 px and shows after a card with the keyboard
await ev(`document.querySelector('#pipeline .card[data-k="1"]').focus()`); await settle(300);
const ca = await ev(`(() => { const b = document.querySelector('#pipeline .conn[data-conn="2"] .conn-add').getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), op: getComputedStyle(document.querySelector('#pipeline .conn[data-conn="2"] .conn-add')).opacity }; })()`);
ok('UX81 the insert ⊕ is 24 px and shows next to the focused card', ca.w === 24 && ca.h === 24 && +ca.op > 0.9, ca);
await shot2('ux81-insert-focus');
// UX65: Numbers; an unused number; Use in fₖ; the numbers a step uses
const sec = await ev(`(() => { const s = document.querySelector('#propsPanel .prm'); return s ? { h: s.querySelector('h2').textContent, aria: s.getAttribute('aria-label'), hint: (s.querySelector('.prm-empty') || {}).textContent } : null; })()`);
ok('UX65 the section is Numbers', sec && sec.h === 'Numbers' && sec.aria === 'Numbers' && /^Type a new letter in any formula/.test(sec.hint || ''), sec);
// UX32: + Number starts with the next free letter, selected
await ev(`document.querySelector('#propsPanel .prm-add button').click()`); await settle(400);
const nn = await ev(`(() => { const i = document.querySelector('#propsPanel .prm-new input'); return { v: i.value, s: i.selectionStart, e: i.selectionEnd, f: document.activeElement === i, ph: i.placeholder }; })()`);
ok('UX32 + Number: the next free letter as selected text', nn.v === 'a' && nn.s === 0 && nn.e === 1 && nn.f, nn);
await ev(`[...document.querySelectorAll('#propsPanel .prm-new button')].find((b) => b.textContent === 'Add').click()`); await settle(500);
const un = await ev(`(() => { const u = document.querySelector('#propsPanel .prm-unused'); return u ? { t: u.textContent, b: (u.querySelector('button') || {}).textContent } : null; })()`);
ok('UX65 an unused number says so and offers Use in f₃ (the selected formula step)', un && /^Not used yet/.test(un.t) && un.b === 'Use in f₃', un);
await shot2('ux65-numbers');
await ev(`document.querySelector('#propsPanel .prm-unused button').click()`); await settle(700);
st = await P();
const nums = await ev(`(() => { const e = document.querySelector('#propsPanel .insp-step .inums'); return e && !e.hidden ? e.textContent : null; })()`);
ok('UX65 Use in f₃ appends + a; the step\'s editor lists a = 1; the note goes', / \+ a$/.test(st.steps[2].params.expr) && nums === 'Numbers: a = 1' && !(await ev(`!!document.querySelector('#propsPanel .prm-unused')`)), { expr: st.steps[2].params.expr, nums });
await grab();

// ---- UX32: the region field's hint, and Add on an empty field ----
const fi = await ev(`(() => { const i = document.getElementById('formulaInput'); const ph = getComputedStyle(i, '::placeholder'); return { ph: i.placeholder, font: ph.fontFamily, style: ph.fontStyle, inFont: getComputedStyle(i).fontFamily }; })()`);
ok('UX32 the placeholder is a hint ("such as …", not the field\'s mono type)', /^such as /.test(fi.ph) && fi.font !== fi.inFont && fi.style === 'italic', fi);
await ev(`document.getElementById('formulaInput').value = ''; document.getElementById('formulaAdd').click()`); await settle(300);
const fe = await ev(`({ f: document.activeElement && document.activeElement.id, n: document.getElementById('formulaNote').hidden ? null : document.getElementById('formulaNote').textContent })`);
ok('UX32 Add on an empty field: the cursor goes there and the note says what to type', fe.f === 'formulaInput' && /^Type a set/.test(fe.n || ''), fe);
await shot2('ux32-formula-empty-add');
await grab();

// ---- UX25: Examples ▾, New first, Opened … · Undo ----
await openApp('test.html', { shapes: [DISC], steps: CHAIN });
await palType('sin z'); await key('Enter'); await settle(800);   // (something to go back to)
const n0 = (await P()).steps.length;
let xb = await ev(`(() => { const b = document.getElementById('examplesBtn'); return { txt: b.innerText.replace(/\\s+/g, ' ').trim(), tip: b.dataset.tip || b.title }; })()`);
ok('UX25 the button says Examples, with its tooltip', /^Examples/.test(xb.txt) && /Worked examples/.test(xb.tip), xb);
await ev(`document.getElementById('examplesBtn').click()`); await settle(600);
const g0 = await ev(`(() => { const i = document.querySelector('#popHost .examples .ex-item'); return i ? { cls: i.className, name: i.querySelector('.ex-name').textContent } : null; })()`);
ok('UX25 New: empty canvas is first in the list', g0 && /ex-new/.test(g0.cls) && g0.name === 'New: empty canvas', g0);
await shot2('ux25-examples-menu');
await ev(`document.querySelectorAll('#popHost .examples .ex-item')[1].click()`); await settle(1500);
t = await toasts();
xb = await ev(`document.getElementById('examplesBtn').innerText.replace(/\\s+/g, ' ').trim()`);
ok('UX25 opening an example: "Opened Strip to disk." with Undo; the button names it after Examples', /^Opened Strip to disk\.\s*Undo$/.test(t[0] || '') && /^Examples\s*Strip to disk/.test(xb), { t, xb });
// (Undo is clicked first: the toast lasts about 2.4 s, and a screenshot taken before the click, with the cards drawing, could outlast it)
await ev(`[...document.querySelectorAll('#toastHost .toast-act')].find((b) => b.textContent === 'Undo').click()`); await settle(1200);
ok('UX25 the toast\'s Undo brings the work back', (await P()).steps.length === n0, (await P()).steps.length);
await shot2('ux25-undone');
await grab();

// ======================= dark, laptop: the palette and the Inspector =======================
await openApp('test.html', { shapes: [DISC], steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }], sel: 1 }, 1366, 768, true);
await ev(`document.querySelector('#pipeline .card[data-k="1"]').click()`); await settle(500);
await shot2('dark-inspector');
await palType('sin(z');
ps = await palState();
ok('dark: the formula error is grey (--muted)', rgb(ps.errColor) === hexRgb(ps.muted), ps);
await shot2('dark-ux23-palette-error');
await palClose();
await grab();
// dark: adding keeps F (UX01); the empty chain's F = z and the + card's label (UX84, UX22)
await openApp('test.html', { shapes: [DISC], steps: CHAIN }, 1366, 768, true);
await palType('sin z'); await key('Enter'); await settle(900);
c = await C();
ok('dark: adding keeps F and selects f₃', c.focus === 0 && c.sel === 3, c);
await shot2('dark-ux01-after-add');
await openApp('test.html', { shapes: [DISC], steps: [] }, 1366, 768, true);
await shot2('dark-ux84-ux22-empty-chain');
await grab();

// ======================= Russian =======================
await openApp('test.html', { shapes: [DISC], steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }], sel: 1 }, 1366, 768, false, false, '&lang=ru');
await ev(`document.querySelector('#pipeline .card[data-k="1"]').click()`); await settle(600);
const ru = await ev(`({ labels: [...document.querySelectorAll('#propsPanel .insp-step label.pl')].map((l) => l.textContent), tip: document.querySelector('#propsPanel .alone-btn').dataset.tip, nums: (document.querySelector('#propsPanel .prm h2') || {}).textContent, show: document.getElementById('viewAllBtn').textContent, ph: document.getElementById('formulaInput').placeholder })`);
const ruAdd = await ev(`(() => { const l = document.querySelector('#addStepBtn span:nth-child(2)'); return { t: l.textContent, cut: l.scrollHeight > l.clientHeight + 1 }; })()`);
ok('Russian: the + card\'s label is whole', ruAdd.t === 'Добавить шаг' && !ruAdd.cut, ruAdd);
ok('Russian: the words, Показать отдельно, Числа, Показать F, the hint', ru.labels.join('|') === 'Степень корня n1|Угол разреза θ|Лист k' && ru.tip === 'Показать отдельно  L' && ru.nums === 'Числа' && ru.show === 'Показать F' && /^например/.test(ru.ph), ru);
await palType('z^2 + a');
rows = await palRows();
ok('Russian: the new-number row', rows[0] && rows[0].label === 'Формула с новым числом a = 1', rows);
await palType('экспорт');
rows = await palRows();
ok('Russian: ⌘K finds Export by a Russian word', rows.some((r) => /Экспорт/.test(r.label) || /рисун/i.test(r.label)), rows.map((r) => r.label));
await shot2('ru-palette-export');
await palClose();
await grab();

// ======================= the phone, 412×860, Android, touch =======================
await openApp('test.html', { shapes: [DISC], steps: CHAIN }, 412, 860, false, true);
await ev(`document.getElementById('addStepBtn').scrollIntoView({ inline: 'center' })`); await settle(300);
await tap('#addStepBtn', 700);
await ev(`(() => { const i = document.getElementById('palInput'); i.value = 'sin z'; i.dispatchEvent(new Event('input')); })()`); await settle(400);
rows = await palRows();
ok('UX82 phone: no property words or letters on the rows', rows.every((r) => !r.wordsShown && r.letters === 0), rows.slice(0, 3));
await key('Enter'); await settle(1000);
c = await C(); t = await toasts();
ok('UX01 phone: adding keeps F and selects f₃; the toast offers Show alone', c.focus === 0 && c.sel === 3 && /^Added f₃ Sine/.test(t[0] || '') && /Show alone/.test(t[0] || ''), { c, t });
await shot2('phone-ux01-after-add');
const ftp = await ev(`(() => { const f = document.querySelector('#pipeline .ftile .fid'); return f ? f.getClientRects().length : -1; })()`);
ok('UX84 phone: the F tile stays F', ftp === 0, ftp);
await ev(`document.querySelector('#pipeline .card[data-k="1"]').scrollIntoView({ inline: 'center' })`); await settle(300);
await tap('#pipeline .card[data-k="1"]', 900);
const sh = await ev(`(() => { const s = document.querySelector('.ph-sheet'); if (!s || s.hidden) return null; const ab = s.querySelector('#propsPanel .alone-btn'), mv = [...s.querySelectorAll('#propsPanel .ihead .mv-btn')]; const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; }; return { ab: ab ? ab.textContent : null, abSize: ab ? r(ab) : null, mv: mv.map((e) => ({ t: e.textContent, s: r(e), dis: e.disabled, vis: e.getClientRects().length > 0 })) }; })()`);
ok('UX85 phone: the sheet says Show alone in words', sh && sh.ab === 'Show alone' && sh.abSize[1] >= 44, sh);
ok('UX81 phone: ← → in the sheet head, 44 px, ← off for f₁', sh && sh.mv.length === 2 && sh.mv.every((m) => m.vis && m.s[0] >= 44 && m.s[1] >= 44) && sh.mv[0].dis && !sh.mv[1].dis, sh);
await shot2('phone-sheet-show-alone-move');
await tap('.ph-sheet #propsPanel .ihead .mv-btn:nth-of-type(2)', 900);
ok('UX81 phone: → moves f₁ one place; the planes keep F', (await P()).steps.map((s) => s.type).join() === 'mobius,exp,sin' && (await C()).focus === 0, { types: (await P()).steps.map((s) => s.type), c: await C() });
await grab();

// ---- phone landscape, 915×412: adding keeps F there too ----
await openApp('test.html', { shapes: [DISC], steps: CHAIN }, 915, 412, false, true);
await ev(`window.__cmwOpenPal ? 0 : 0`);
await ev(`(() => { const b = document.getElementById('addStepBtn'); b.scrollIntoView({ inline: 'center' }); b.click(); })()`); await settle(700);
await ev(`(() => { const i = document.getElementById('palInput'); i.value = 'exp z'; i.dispatchEvent(new Event('input')); })()`); await settle(400);
await key('Enter'); await settle(900);
c = await C();
ok('UX01 phone landscape: adding keeps F', c.focus === 0 && c.sel === 3, c);
await grab();

// ======================= before: the same scenes on the v16.4 snapshot =======================
if (BASE) {
  const before = async (name, st, fn, w = 1366, h = 768, dark = false, mobile = false, q = '') => { await openApp('base.html', st, w, h, dark, mobile, q); try { await fn(); } catch (e) { info['before-' + name] = String(e); } await shot2(name + '-before'); await palClose(); };
  await before('ux01-after-add', { shapes: [DISC], steps: CHAIN }, async () => { await palType('sin z'); await key('Enter'); await settle(900); });
  await before('ux16-palette-new-number', { shapes: [DISC, LINE], steps: CHAIN }, async () => { await palType('z^2 + a'); });
  await before('ux23-palette-error', { shapes: [DISC, LINE], steps: CHAIN }, async () => { await palType('sin(z'); });
  await before('ux03-palette-png', { shapes: [DISC, LINE], steps: CHAIN }, async () => { await palType('png'); });
  await before('ux82-palette-words', { shapes: [DISC, LINE], steps: CHAIN }, async () => { await palType('sin'); });
  await before('ux84-empty-chain', { shapes: [DISC], steps: [] }, async () => {});
  await before('ux33-ux85-inspector', { shapes: [DISC], steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }], sel: 1 }, async () => { await ev(`document.querySelector('#pipeline .card[data-k="1"]').click()`); await settle(600); });
  await before('dark-inspector', { shapes: [DISC], steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }], sel: 1 }, async () => { await ev(`document.querySelector('#pipeline .card[data-k="1"]').click()`); await settle(600); }, 1366, 768, true);
  await before('ux25-examples-menu', { shapes: [DISC], steps: CHAIN }, async () => { await ev(`document.getElementById('examplesBtn').click()`); await settle(600); });
  await before('v03-integral-beside', { shapes: [DISC, LINE], steps: CHAIN }, async () => { await palType('integrate'); await key('Enter'); await settle(900); });
  await before('phone-sheet-show-alone-move', { shapes: [DISC], steps: CHAIN }, async () => { await ev(`document.querySelector('#pipeline .card[data-k="1"]').scrollIntoView({ inline: 'center' })`); await settle(300); await tap('#pipeline .card[data-k="1"]', 900); }, 412, 860, false, true);
  const ROOTS = [{ type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }, { type: 'custom', params: { expr: 'e^{1/z}', cut: 180 }, on: true }, { type: 'custom', params: { expr: '\\log(z+2)', cut: 180 }, on: true }];
  await before('ux79-undo-toast', { shapes: [DISC], steps: [{ type: 'zp', params: { a: '1', zeros: '0.5', poles: '-0.5' }, on: true }], sel: 1 }, async () => { await ev(`document.querySelector('#pipeline .card[data-k="1"]').click()`); await settle(500); await ev(`document.querySelector('#propsPanel .zp-add.poles').click()`); await settle(600); await key('z', 4); await settle(700); });
  await before('ux81-insert-focus', { shapes: [DISC], steps: ROOTS, sel: 1 }, async () => { await ev(`document.querySelector('#pipeline .card[data-k="1"]').click()`); await settle(500); await ev(`document.querySelector('#pipeline .card[data-k="1"]').focus()`); await settle(300); });
  await before('ux65-numbers', { shapes: [DISC], steps: ROOTS, sel: 3 }, async () => { await ev(`document.querySelector('#pipeline .card[data-k="3"]').click()`); await settle(500); await ev(`document.querySelector('#propsPanel .prm-add button').click()`); await settle(400); });
  await before('ux32-formula-empty-add', { shapes: [DISC], steps: CHAIN }, async () => { await ev(`document.getElementById('formulaInput').value = ''; document.getElementById('formulaAdd').click()`); await settle(300); });
  await before('ux25-opened-example', { shapes: [DISC], steps: CHAIN }, async () => { await palType('sin z'); await key('Enter'); await settle(800); await ev(`document.getElementById('examplesBtn').click()`); await settle(600); await ev(`document.querySelectorAll('#popHost .examples .ex-item')[1].click()`); await settle(1500); });
  await before('dark-ux23-palette-error', { shapes: [DISC], steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }], sel: 1 }, async () => { await palType('sin(z'); }, 1366, 768, true);
  await before('dark-ux01-after-add', { shapes: [DISC], steps: CHAIN }, async () => { await palType('sin z'); await key('Enter'); await settle(900); }, 1366, 768, true);
  await before('dark-ux84-ux22-empty-chain', { shapes: [DISC], steps: [] }, async () => {}, 1366, 768, true);
  await before('ru-palette-export', { shapes: [DISC], steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }], sel: 1 }, async () => { await ev(`document.querySelector('#pipeline .card[data-k="1"]').click()`); await settle(600); await palType('экспорт'); }, 1366, 768, false, false, '&lang=ru');
  await before('phone-ux01-after-add', { shapes: [DISC], steps: CHAIN }, async () => { await ev(`document.getElementById('addStepBtn').scrollIntoView({ inline: 'center' })`); await settle(300); await tap('#addStepBtn', 700); await ev(`(() => { const i = document.getElementById('palInput'); i.value = 'sin z'; i.dispatchEvent(new Event('input')); })()`); await settle(400); await key('Enter'); await settle(1000); }, 412, 860, false, true);
  await logs();
}
await view(1366, 768, false, false);
info.base = BASE;
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info, shots: shots.map((s) => s.replace(/^.*\/shots\//, '')) };
