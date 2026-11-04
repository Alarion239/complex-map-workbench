// The first-run line and the tour's practice note on a laptop (UX21, #250, UX90): the first visit's one-line invitation in
// the docked slot, above the planes and clear of the Inspector, with its Start and dismiss buttons and its words whole;
// Start runs the tour from Basics; no Details sheet at 1366 x 768 or 1440 x 900, no Next key hint and no timer button
// (Move on by itself is a switch in the Chapters menu), and the welcome lead says what the practice clears. The same in
// the steps view and the classic view; the phone and landscape legs stay in ux165_learn_cmd.js. A command file for a
// CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/ux165_learn_first_run_cmd.js
// Prints { pass, of, fails: [[name, false, detail]], exc }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const settle = async (ms = 600) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const exc = [];
const grab = () => { for (const l of logs()) if (l.t === 'EXC') exc.push(l.m.slice(0, 300)); };
const UA0 = await ev('navigator.userAgent');
const laptop = async (w = 1366, h = 768, dark = false) => { await send('Emulation.setUserAgentOverride', { userAgent: UA0 }); await view(w, h, dark, false); };
// (the app is up: its state hook answers and the chain is drawn; a fresh page on a slow runner takes a few seconds)
const ready = async () => { for (let i = 0; i < 40 && !(await ev(`typeof __cmwState === 'function' && !!document.querySelector('#pipeline')`)); i++) await sleep(250); };
// a fresh first visit (no ?ns=, nothing saved): the app's own rule for the first-run line
// a namespace's saved state is cleared first, so every run starts from the default scene
// (from another namespace's page: a page saves its own state when it is left)
const fresh = async (ns, q = '') => { await nav(U + '?ns=ux165clean'); await ev(`(() => { for (const k of Object.keys(localStorage)) if (k.endsWith(':${ns}')) localStorage.removeItem(k); return 1; })()`); await nav(U + '?ns=' + ns + q); };
const firstVisit = async (q = '') => { await fresh('ux165x'); await ev(`(() => { for (const k of Object.keys(localStorage)) if (!/:/.test(k)) localStorage.removeItem(k); return 1; })()`); await nav(U + q); for (let i = 0; i < 40 && !(await ev(`!!document.querySelector('.tour-lane')`)); i++) await sleep(200); };
logs();
grab();
// ---------------------------------------------------------------- UX21: the first-run line, docked
await laptop();
await firstVisit();
let g = await ev(`(() => { const s = document.querySelector('.tour-lane'); if (!s) return null; const b = s.getBoundingClientRect(), p = document.querySelector('#paneL').getBoundingClientRect(), q = document.querySelector('#paneR').getBoundingClientRect(), i = document.querySelector('#rightPanel').getBoundingClientRect(), shown = [p, q].filter((r) => r.width > 0 && r.height > 0); return { slot: s.parentNode.id, mode: s.dataset.mode, h: Math.round(b.height), clear: shown.length > 0 && shown.every((r) => b.bottom <= r.top + 0.5), insp: b.right <= i.left + 0.5, card: !!document.querySelector('.tour-suggest'), title: s.querySelector('.tl-title').textContent, btns: [...s.querySelectorAll('button')].map((x) => x.textContent) }; })()`);
check('UX21 laptop: the first-run invitation is one line in the docked slot, above every plane shown, clear of the Inspector, no card', g && g.slot === 'tourSlot' && g.mode === 'desk' && g.h <= 48 && g.clear && g.insp && !g.card && /New here\?/.test(g.title), g);
check('UX21 laptop: Start the tour and Not now', g && g.btns.some((t) => /Start the tour/.test(t)) && g.btns.some((t) => /Not now/.test(t)), g && g.btns);
g = await ev(`(() => { const t = document.querySelector('.tour-lane .tl-text'); return { cut: t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1, two: t.closest('.tour-lane').classList.contains('two'), body: !t.querySelector('.tl-body').hidden }; })()`);
check('UX21 laptop: the line is one line and its words are whole (the description only where it fits whole)', !g.cut && !g.two, g);
await shot('ux165-ux21-laptop');
await laptop(1366, 768, true); await settle(300); await shot('ux165-ux21-laptop-dark'); await laptop();
await ev(`document.querySelector('.tour-lane .btn.primary').click()`); await settle(1500);
check('UX21 laptop: Start runs the tour from Basics, and the line has gone', (await ev('Tour.isActive() && Tour.current().chapter === "basics"')) && !(await ev(`!!document.querySelector('.tour-lane')`)));
// (#250) no Details on a laptop: the strip's text is plain, with the key on Next and the switch beside ×; the welcome lead says the practice is cleared (UX90)
g = await ev(`({ why: Tour.lit() ? Tour.lit().why : null, details: [...document.querySelectorAll('.tour-strip *')].some((e) => /Details/.test(e.textContent) || /Details/.test(e.getAttribute('aria-label') || '')), key: getComputedStyle(document.querySelector('.ts-next'), '::after').content, autob: !!document.querySelector('.ts-autob') && document.querySelector('.ts-autob').getClientRects().length > 0, textBtn: document.querySelector('.ts-text').getAttribute('role'), lead: (document.querySelector('#tourLead') || {}).textContent })`);
check('#250: no Details at 1366; the Next key hint is gone, the timer button is gone (Move on by itself is a switch in the Chapters menu)', g.why === false && !g.details && g.key === 'none' && !g.autob, g);
check('UX90: the welcome lead says what is cleared', /Practice freely: what you draw here is cleared at the end/.test(g.lead || ''), g.lead);
await ev(`document.querySelector('.ts-next').focus()`); await key('Escape'); await settle(500); await ev('Tour.stop()'); await settle(300);
await laptop(1440, 900);
await fresh('ux165w'); await settle(1500);
// (a fresh page on a slow runner: the app up before the tour starts, and the step lit before it is read)
await ready();
await ev(`Tour.start({ chapter: 'planes' })`); await settle(1500);
for (let i = 0; i < 20 && !(await ev('!!Tour.lit()')); i++) await sleep(250);
check('#250: no sheet at 1440 x 900 either', (await ev('Tour.lit() && Tour.lit().why')) === false && (await ev(`!document.querySelector('#tourWhy') || !document.querySelector('#tourWhy').isConnected`)));
await ev('Tour.stop()'); await settle(300);
await laptop();

await laptop(1440, 900, false);
await send('Emulation.setUserAgentOverride', { userAgent: UA0 });
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails, exc };
