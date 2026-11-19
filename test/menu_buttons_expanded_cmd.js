// Every button that opens a menu (aria-haspopup="menu") says whether it is open: aria-expanded is "false" at rest, "true"
// while its menu is open, "false" again after each way out of it: Escape, the same button pressed again, a press outside,
// and a choice (the menu's first item, on a fresh page, since a choice changes the scene). The walk takes the buttons the page has on screen (header, Inspector,
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
const GONE = `!document.querySelector('#popHost .pop.menu') && !document.querySelector('#hdrMenu:popover-open')`;
const shut = async (label) => { await settled({ max: 8000, only: true, until: GONE }); const gone = await ev(GONE); ok(`${label}: the menu is gone`, gone, gone); };
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
    await key('Escape'); await shut(`${label} after Escape`);
    ok(`${label} after Escape: aria-expanded is false`, (await exp(i)) === 'false', await exp(i));
    // (the same button again closes the menu it opened)
    await open(i);
    const [bx, by] = await ev(`(() => { const r = document.querySelectorAll('button[aria-haspopup="menu"]')[${i}].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    await ev('new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))');
    // (a step's More ignores a press within half a second of the last: pressed until the menu is gone, which a closed menu ends)
    for (let t = 0; t < 40 && (await ev(menuUp)); t++) {
      await click(bx, by);
      await ev(`new Promise((r) => { const t0 = performance.now(); const f = () => (!(${menuUp}) || performance.now() - t0 > 120 ? r() : requestAnimationFrame(f)); f(); })`);
    }
    await shut(`${label} after pressing it again`);
    ok(`${label} after pressing it again: the menu is gone and aria-expanded is false`, (await exp(i)) === 'false', await exp(i));
    // (a press outside: the page's bottom left corner, clear of the menu and its button)
    await open(i);
    const outside = await ev(`(() => { const e = document.elementFromPoint(6, innerHeight - 6), m = document.querySelector('#popHost .pop'); return !(m && m.contains(e)); })()`);
    await click(6, await ev('innerHeight - 6')); await shut(`${label} after a press outside`);
    ok(`${label} after a press outside: aria-expanded is false`, outside && (await exp(i)) === 'false', [outside, await exp(i)]);
  }
};
await walk('desktop', ['examplesBtn', 'exportBtn', 'shareBtn', 'themeBtn', 'palBtn', 'helpBtn', 'more', 'sv-more']);
// a choice: the menu's first item, on a fresh page for each button (a choice may load an example, open a dialog or another popover, or turn a setting: the menu itself is gone)
const choice = async (name, n) => {
  await go(`http://localhost:${PORT}/test.html?ns=menubtnc${Date.now()}`);
  await settled({ max: 30000, until: '!!document.querySelector("#examplesBtn")' });
  const i = await nth(name, n);
  await open(i);
  // (the first item that is not a submenu's, when the menu has one: Enter on a submenu's item opens it and the menu stays)
  const leaf = await ev(`(() => { const b = [...document.querySelectorAll('#popHost .pop [role^="menuitem"]')].find((e) => !e.classList.contains('has-sub') && !e.disabled && !e.hidden && e.getClientRects().length); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  if (leaf) await click(leaf[0], leaf[1]); else await key('Enter');
  await shut(`desktop ${name}#${n} after a choice`);
  ok(`desktop ${name}#${n} after a choice: aria-expanded is false`, (await exp(i)) === 'false', await exp(i));
};
{ const seen = {}; for (const name of info.desktop) { const n = (seen[name] = (seen[name] || 0) + 1) - 1; await choice(name, n); } }
await view(1280, 800, false, false);
// the Export figure dialog's Size and More formats buttons, and Size's accessible name (its row's heading, then the size it shows)
await go(`http://localhost:${PORT}/test.html?ns=menubtnx${Date.now()}`);
await settled({ max: 30000, until: '!!document.querySelector("#examplesBtn")' });
await key('e', 4);
await settled({ max: 20000, until: '!!document.getElementById("xfSize") && !!document.getElementById("xfMore") && document.getElementById("xfMore").getClientRects().length > 0' });
const named = await ev(`(() => { const b = document.getElementById('xfSize'); const ids = (b.getAttribute('aria-labelledby') || '').split(' ').filter(Boolean); return { ids, text: ids.map((id) => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; }) }; })()`);
ok('Export figure: Size is named by its row heading, then the size it shows', named.ids.length === 2 && named.text[0] === 'Size' && !!named.text[1], named);
for (const id of ['xfSize', 'xfMore']) {
  const at = () => ev(`document.getElementById('${id}').getAttribute('aria-expanded')`);
  ok(`Export figure ${id} at rest: aria-expanded is false`, (await at()) === 'false', await at());
  const [fx, fy] = await ev(`(() => { const r = document.getElementById('${id}').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await click(fx, fy);
  await settled({ max: 8000, only: true, until: `!!document.querySelector('.pop.menu')` });
  ok(`Export figure ${id} with its menu open: aria-expanded is true`, (await at()) === 'true', await at());
  await key('Escape');
  await settled({ max: 8000, only: true, until: `!document.querySelector('.pop.menu')` });
  ok(`Export figure ${id} after Escape: aria-expanded is false`, (await at()) === 'false', await at());
}
// the phone layout: its header and the menu buttons it shows
await view(390, 844, true, true);
await go(`http://localhost:${PORT}/test.html?ns=menubtnph${Date.now()}`);
await settled({ max: 30000, until: '!!document.querySelector("#examplesBtn") || !!document.querySelector(".ph-bar, .ph-sheet")' });
await walk('phone', ['sv-more']);
return { pass: fails.length === 0, fails, info };
