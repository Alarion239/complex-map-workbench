// D1, issue #23: the function search replaces as well as inserts. A chip in the search row says where the function
// goes (Insert, Replace F, Replace f_k; Tab or a click changes it, and it is remembered); the best match is listed all
// three ways; "Replace…" is the first item of a card's ⋯; the Inspector's title opens the search ready to replace its
// step; Clear chain is a word button in the classic chain head (clear_chain_open_cmd.js clicks it) and the palette's command in the steps view. On a laptop (1366×768), a phone (412×860) and in Russian.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/d1_replace_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
const CHAIN = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }];
const DISC = { id: 's1', kind: 'disc', c: [0, 0], r: 1 };
let nsN = 0;
async function openApp(st, w = 1366, h = 768, mobile = false, q = '') {
  const ns = 'd1r' + Date.now() + '_' + (nsN++);
  await view(w, h, false, mobile);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}${q}` }); await sleep(2300);
  await settle(600);
  return ns;
}
const P = () => ev('__cmwP()');
const types = async () => (await P()).steps.map((s) => s.type);
const toasts = () => ev('__qa.toasts()');
const palQ = async (q) => { await ev(`(() => { const i = document.getElementById('palInput'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input')); })()`); await settle(300); };
const pal = () => ev(`(() => { const p = document.querySelector('#popHost .palette'); if (!p) return null; const w = p.querySelector('.pal-where'), at = p.querySelector('.pal-at'), head = p.querySelector('.pal-head');
  return { where: w ? (w.getAttribute('aria-label') || '').replace(/^Where it goes: |^Куда: /, '') : null, whereLabel: w ? w.getAttribute('aria-label') : null, at: at && !at.hidden ? at.textContent : null, verb: (p.querySelector('.pal-verb') || {}).textContent || '',
    rows: [...p.querySelectorAll('.pal-item .pal-label')].slice(0, 4).map((e) => e.textContent), headFits: head.scrollWidth <= head.clientWidth + 1, whereFits: !w || w.scrollWidth <= w.clientWidth + 1 }; })()`);
const clickMenu = (label) => ev(`(() => { const b = [...document.querySelectorAll('#popHost .mi')].find((e) => e.querySelector('.mi-label').textContent === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true; })()`);

// ======================= the laptop =======================
await openApp({ shapes: [DISC], steps: CHAIN });
const clr = await ev(`(() => { const b = document.getElementById('clearChain'); return { shown: !!b.getClientRects().length, text: b.textContent, more: !!document.getElementById('chainMoreBtn') }; })()`);
// (the classic chain head has the word button; the steps view has no chain head: its Clear chain is the palette's command)
const inSteps = await ev(`document.documentElement.classList.contains('sv')`);
await key('k', 4); await settle(400);
await palQ('Clear chain');
const clrRows = await ev(`[...document.querySelectorAll('.pal-item .pal-label')].map((e) => e.textContent)`);
await key('Escape'); await settle(250);
ok(inSteps ? 'the steps view has no chain head: Clear chain is the palette\'s command' : 'Clear chain is a word button in the chain head (no ⋯ there)',
  inSteps ? !clr.shown && clrRows.includes('Clear chain') : clr.shown && clr.text === 'Clear chain' && !clr.more, { clr, clrRows });
await key('k', 4); await settle(400);
let p = await pal();
// (#35: "Insert at the end", beside "Insert at the start" and "Insert after f₂", for Append to the chain)
ok('the chip says where: Insert at the end (Insert by default)', p && /^Insert at the end/.test(p.where), p);
await palQ('sin z');
p = await pal();
ok('sin z: the best match three ways, Insert (the row as it was) first', p.rows.slice(0, 3).join(' | ') === 'Sine | Replace F with Sine | Replace f₂ Möbius with Sine', p.rows);
ok('Enter adds', p.verb === ' to add', p.verb);
await key('Tab'); await settle(300);
p = await pal();
ok('Tab: the chip says Replace F, and Replace F is first', /^Replace F/.test(p.where) && p.rows[0] === 'Replace F with Sine' && p.verb === ' to replace', p);
await key('Enter'); await settle(900);
let t = await toasts();
ok('Replace F: F is one step, Sine', (await types()).join() === 'sin', await types());
ok('Replace F: the toast says so', /^Replaced F with Sine\./.test(t[0] || ''), t);
await ev(`document.getElementById('undoBtn').click()`); await settle(700);
ok('one Undo brings the chain back', (await types()).join() === 'exp,mobius', await types());
// the choice is remembered
await key('k', 4); await settle(400);
p = await pal();
ok('the palette remembers Replace F', /^Replace F/.test(p.where), p);
await key('Tab'); await settle(250);
p = await pal();
ok('Tab again: Replace f₂', /^Replace f₂/.test(p.where), p);
await palQ('cos');
p = await pal();
ok('Replace f₂ first: Replace f₂ Möbius with Cosine', p.rows[0] === 'Replace f₂ Möbius with Cosine', p.rows);
await key('Enter'); await settle(900);
ok('Replace f₂: f₁ stays, f₂ is Cosine', (await types()).join() === 'exp,cos', await types());
t = await toasts();
ok('Replace f₂: the toast names both', /^Replaced f₂ \(Möbius\) with Cosine\./.test(t[0] || ''), t);
await ev(`document.getElementById('undoBtn').click()`); await settle(700);
// a card's ⋯: Replace… first, ready to replace that step
await ev(`document.querySelector('#pipeline .card[data-k="1"] .more').click()`); await settle(400);
const first = await ev(`(document.querySelector('#popHost .mi .mi-label') || {}).textContent || null`);
ok('a card\'s ⋯ starts with Replace…', first === 'Replace…', first);
await clickMenu('Replace…'); await settle(400);
p = await pal();
ok('Replace… opens the search on Replace f₁', p && /^Replace f₁/.test(p.where), p);
await palQ('tan');
p = await pal();
ok('Replace f₁ Exponential with Tangent is first', p.rows[0] === 'Replace f₁ Exponential with Tangent', p.rows);
await key('Enter'); await settle(900);
ok('Replace f₁: tan, mobius', (await types()).join() === 'tan,mobius', await types());
await ev(`document.getElementById('undoBtn').click()`); await settle(700);
// the Inspector's title
await ev(`document.querySelector('#pipeline .card[data-k="2"]').click()`); await settle(600);
const ttl = await ev(`(() => { const b = document.querySelector('#propsPanel .insp-step .ihead .ttl'); return b ? { role: b.getAttribute('role'), text: b.textContent, after: getComputedStyle(b, '::after').content } : null; })()`);
ok('the Inspector\'s title is a button, "Möbius ▾"', ttl && ttl.role === 'button' && ttl.text === 'Möbius' && /▾/.test(ttl.after), ttl);
await ev(`document.querySelector('#propsPanel .insp-step .ihead .ttl').click()`); await settle(400);
p = await pal();
ok('the title opens the search on Replace f₂', p && /^Replace f₂/.test(p.where), p);
await palQ('sinh');
await key('Enter'); await settle(900);
ok('the title\'s replace: exp, sinh', (await types()).join() === 'exp,sinh', await types());
// a connector's + always inserts, whatever was remembered
await ev(`document.querySelector('#pipeline .conn-add').click()`); await settle(400);
p = await pal();
ok('a connector\'s + inserts (at the start)', p && /^Insert at the start/.test(p.where), p);
await key('Escape'); await settle(250);
// Clear chain
await key('k', 4); await settle(400);
await palQ('Clear chain'); await key('Enter'); await settle(600);
ok('Clear chain (the palette\'s command) empties the chain and hides the chain head\'s button', (await types()).length === 0 && (await ev(`document.getElementById('clearChain').hidden`)), await types());
// an empty chain: no chip, the old context
await key('k', 4); await settle(400);
p = await pal();
ok('an empty chain: no Replace chip', p && p.where === null, p);
await key('Escape'); await settle(250);
await grab();

// ======================= a phone =======================
await openApp({ shapes: [DISC], steps: CHAIN }, 412, 860, true);
await ev(`document.getElementById('addStepBtn').scrollIntoView({ inline: 'center' })`); await settle(300);
await ev(`document.getElementById('addStepBtn').click()`); await settle(700);
p = await pal();
ok('phone: the position row holds the Replace chip and the position chip', p && p.where && /^Insert/.test(p.where) && /Insert at the end/.test(p.at || ''), p);
await ev(`document.querySelector('.pal-atrow .pal-where').click()`); await settle(300);
p = await pal();
ok('phone: a tap on it says Replace F; the position chip goes', /^Replace F/.test(p.where) && p.at === null, p);
await palQ('sin z');
p = await pal();
ok('phone: Replace F with Sine first', p.rows[0] === 'Replace F with Sine', p.rows);
await key('Enter'); await settle(900);
ok('phone: F is Sine', (await types()).join() === 'sin', await types());
await grab();

// ======================= Russian =======================
await openApp({ shapes: [DISC], steps: CHAIN }, 1366, 768, false, '&lang=ru');
await key('k', 4); await settle(400);
for (let i = 0; i < 3; i++) {
  p = await pal();
  ok(`ru: the head fits (${p && p.where})`, p && p.headFits && p.whereFits, p);
  await key('Tab'); await settle(250);
}
await palQ('синус');
p = await pal();
info.ru = p;
ok('ru: the rows say Заменить', p.rows.some((r) => /^Заменить F → /.test(r)), p.rows);
await key('Escape'); await settle(250);
await grab();

await view(1366, 768, false, false);
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
