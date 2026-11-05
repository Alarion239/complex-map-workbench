// The ux165 learn suites' shared preamble (#811): the daemon's page address, the check list (R, check), the settle and
// log grab (settle, exc, grab), the laptop's user agent and view (UA0, laptop), a fresh first visit (fresh, firstVisit)
// and the wait for the app to be up (ready). A suite takes it as an expression for eval:
// `const { U, R, check, settle, exc, grab, UA0, laptop, fresh } = await eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'ux165_kit.js'), 'utf8'))`.
// The merge and plane suites keep their own: their settle, grab and fresh differ.
(async () => {
  const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
  const U = `http://localhost:${PORT}/test.html`;
  const R = [];
  const check = (name, pass, detail) => R.push([name, !!pass, detail]);
  const settle = async (ms = 600) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
  const exc = [];
  const grab = () => { for (const l of logs()) if (l.t === 'EXC') exc.push(l.m.slice(0, 300)); };
  const UA0 = await ev('navigator.userAgent');
  const laptop = async (w = 1366, h = 768, dark = false) => { await send('Emulation.setUserAgentOverride', { userAgent: UA0 }); await view(w, h, dark, false); };
  // a fresh first visit (no ?ns=, nothing saved): the app's own rule for the first-run line
  // a namespace's saved state is cleared first, so every run starts from the default scene
  // (from another namespace's page: a page saves its own state when it is left)
  // (the app is up: its state hook answers and the chain is drawn; a fresh page on a slow runner takes a few seconds)
  const ready = async () => { for (let i = 0; i < 40 && !(await ev(`typeof __cmwState === 'function' && !!document.querySelector('#pipeline')`)); i++) await sleep(250); };
  const fresh = async (ns, q = '') => { await nav(U + '?ns=ux165clean'); await ev(`(() => { for (const k of Object.keys(localStorage)) if (k.endsWith(':${ns}')) localStorage.removeItem(k); return 1; })()`); await nav(U + '?ns=' + ns + q); };
  const firstVisit = async (q = '') => { await fresh('ux165x'); await ev(`(() => { for (const k of Object.keys(localStorage)) if (!/:/.test(k)) localStorage.removeItem(k); return 1; })()`); await nav(U + q); for (let i = 0; i < 40 && !(await ev(`!!document.querySelector('.tour-lane')`)); i++) await sleep(200); };
  return { PORT, U, R, check, settle, exc, grab, UA0, laptop, fresh, firstVisit, ready };
})()
