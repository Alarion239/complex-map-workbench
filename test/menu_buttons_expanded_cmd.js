// Every button that opens a menu (aria-haspopup="menu") says whether it is open: aria-expanded is "false" at rest, "true"
// while its menu is open, "false" again after Escape. The walk takes the buttons the page has on screen (header, Inspector,
// tool rows) rather than a list, so a new menu button is covered. A command file for a CDP daemon (test/cdp_kit README);
// prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
await view(1280, 800, false, false);
await go(`http://localhost:${PORT}/test.html?ns=menubtn${Date.now()}`);
await settled({ max: 30000, until: '!!document.querySelector("#examplesBtn")' });
// (the visible menu buttons, each named by its id or class, with an index when several share it)
// (a button counts when a press at its centre lands on it: not clipped, scrolled away or covered)
const hit = `(b) => { const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !b.disabled && !!e && b.contains(e); }`;
const list = () => ev(`(() => { const hit = ${hit}; return [...document.querySelectorAll('button[aria-haspopup="menu"]')].filter((b) => b.getClientRects().length && hit(b)).map((b, i) => ({ i, name: b.id || b.className.split(' ').slice(-1)[0] })); })()`);
const exp = (i) => ev(`document.querySelectorAll('button[aria-haspopup="menu"]')[${i}].getAttribute('aria-expanded')`);
const nth = async (name, n) => { const all = await ev(`(() => { const hit = ${hit}; return [...document.querySelectorAll('button[aria-haspopup="menu"]')].map((b, i) => [i, b.id || b.className.split(' ').slice(-1)[0], !!b.getClientRects().length && hit(b)]); })()`); return all.filter((a) => a[1] === name && a[2])[n || 0][0]; };
// (a step's More ignores a press within half a second of the last one, which a long press and its context menu share:
// the press is repeated until the menu is there)
const menuUp = `!!document.querySelector('#popHost .pop, #hdrMenu:popover-open')`;
const open = async (i) => {
  const [x, y] = await ev(`(() => { const r = document.querySelectorAll('button[aria-haspopup="menu"]')[${i}].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  for (let t = 0; t < 40 && !(await ev(menuUp)); t++) {
    await click(x, y);
    await ev(`new Promise((r) => { const t0 = performance.now(); const f = () => ((${menuUp}) || performance.now() - t0 > 120 ? r() : requestAnimationFrame(f)); f(); })`);
  }
  await settled({ max: 8000, only: true, until: menuUp });
  await ev('new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))');
};
const shut = () => settled({ max: 8000, only: true, until: `!document.querySelector('#popHost .pop') && !document.querySelector('#hdrMenu:popover-open')` });
// (one leg: every menu button on screen, in the names it must include)
const walk = async (leg, must) => {
  // (all of them, on screen or not: a button the page keeps in a sheet or a hidden row has the attribute too)
  const bare = await ev(`[...document.querySelectorAll('button[aria-haspopup="menu"]')].filter((b) => b.getAttribute('aria-expanded') !== 'false').map((b) => b.id || b.className)`);
  ok(`${leg}: every menu button starts at aria-expanded="false"`, bare.length === 0, bare);
  const btns = await list();
  info[leg] = btns.map((b) => b.name);
  ok(`${leg}: the walk finds ${must.join(', ')}`, must.every((n) => btns.some((b) => b.name === n)), info[leg]);
  const seen = {};
  for (const b of btns) {
    const n = (seen[b.name] = (seen[b.name] || 0) + 1) - 1;
    const i = await nth(b.name, n);
    const label = `${leg} ${b.name}#${n}`;
    ok(`${label} at rest: aria-expanded is false`, (await exp(i)) === 'false', await exp(i));
    await open(i);
    ok(`${label} with its menu open: aria-expanded is true`, (await exp(i)) === 'true', await exp(i));
    await key('Escape'); await shut();
    ok(`${label} after Escape: aria-expanded is false`, (await exp(i)) === 'false', await exp(i));
  }
};
await walk('desktop', ['examplesBtn', 'exportBtn', 'shareBtn', 'themeBtn', 'palBtn', 'helpBtn', 'more', 'sv-more']);
// the phone layout: its header and the menu buttons it shows
await view(390, 844, true, true);
await go(`http://localhost:${PORT}/test.html?ns=menubtnph${Date.now()}`);
await settled({ max: 30000, until: '!!document.querySelector("#examplesBtn") || !!document.querySelector(".ph-bar, .ph-sheet")' });
await walk('phone', ['sv-more']);
return { pass: fails.length === 0, fails, info };
