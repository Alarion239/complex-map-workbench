// The Undo message on a laptop clear of the planes' controls, in the classic view (UX80): after Clear chain the message
// sits in the chain head or above the chain, between X's and Y's button columns. The steps view has no chain head: its
// messages are asked in toasts_515_cmd.js (the message over the rail, inside the strip) and ux165_fix_cmd.js. A command
// file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/ux165_learn_msg_classic_cmd.js
// Prints { pass, of, fails: [[name, false, detail]], exc }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const settle = async (ms = 600) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const exc = [];
const grab = () => { for (const l of logs()) if (l.t === 'EXC') exc.push(l.m.slice(0, 300)); };
const meet = (a, b) => !!a && !!b && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
const UA0 = await ev('navigator.userAgent');
const laptop = async (w = 1366, h = 768, dark = false) => { await send('Emulation.setUserAgentOverride', { userAgent: UA0 }); await view(w, h, dark, false); };
// a fresh first visit (no ?ns=, nothing saved): the app's own rule for the first-run line
// a namespace's saved state is cleared first, so every run starts from the default scene
// (from another namespace's page: a page saves its own state when it is left)
const fresh = async (ns, q = '') => { await nav(U + '?ns=ux165clean'); await ev(`(() => { for (const k of Object.keys(localStorage)) if (k.endsWith(':${ns}')) localStorage.removeItem(k); return 1; })()`); await nav(U + '?ns=' + ns + q); };
logs();
grab();
let g = null;
// ---------------------------------------------------------------- UX80: messages clear of the planes' controls
await laptop();
await fresh('ux165e'); await settle(1800);
await ev(`document.querySelector('#clearChain').click()`); await settle(500);
// (a desktop message that fits whole on one line goes in the chain head's free middle (#toastHost data-placed="head"); only a
// longer one goes above the chain)
g = await ev(`(() => { const t = document.querySelector('#toastHost .toast').getBoundingClientRect(), r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; }; return { t: { l: t.left, t: t.top, r: t.right, b: t.bottom }, x: r('#paneL .viewstack'), y: r('#paneR .viewstack'), chain: r('.pipe-wrap'), head: r('.pipe-head'), placed: document.getElementById('toastHost').getAttribute('data-placed') }; })()`);
check('UX80 laptop: the Undo message sits in the chain head (v16.5 regress-3) or above the chain, between X\'s and Y\'s button columns', !meet(g.t, g.x) && !meet(g.t, g.y) && (g.placed === 'head' ? g.t.t >= g.head.t - 1 && g.t.b <= g.head.b + 1 && g.t.l >= g.head.l && g.t.r <= g.head.r : g.t.b <= g.chain.t && g.t.l >= g.x.r && g.t.r <= g.y.l), g);
await shot('ux165-ux80-laptop');
await laptop(1440, 900, false);
await send('Emulation.setUserAgentOverride', { userAgent: UA0 });
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails, exc };
