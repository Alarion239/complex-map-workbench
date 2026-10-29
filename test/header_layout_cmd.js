// The top bar and the view tabs (issues #248, #249): no "Complex Map Workbench" text in the bar (the logo, a hidden h1 and
// the page title stay); the room it gave goes to the Sound label and the search words; the bar does not overflow; the word
// of every view tab (Plane | Sphere in the panes, X → Y | Phase | Landscape in the bar) is centred in its tile, the icon
// hanging to its left. 1440, 1280, 1100 and 900 px, en, ru and it. A command file for a CDP daemon (test/cdp_kit README).
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ST = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 } };
const probe = () => ev(`(() => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
  const top = document.querySelector('.top'), h1 = document.querySelector('h1');
  const tabs = [...document.querySelectorAll('#leftTabs > button, #rightTabs > button, #viewSwitch > button')].filter((b) => vis(b) && vis(b.querySelector('span'))).map((b) => {
    const r = b.getBoundingClientRect(), s = b.querySelector('span').getBoundingClientRect();
    return { t: b.dataset.mode, w: Math.round(r.width), d: +((s.left + s.right) / 2 - (r.left + r.right) / 2).toFixed(2), icon: vis(b.querySelector('svg')) };
  });
  const hr = h1.getBoundingClientRect(), cs = getComputedStyle(h1);
  return { over: top.scrollWidth > top.clientWidth + 1, h1: { w: Math.round(hr.width), h: Math.round(hr.height), clip: cs.clipPath, pos: cs.position }, title: document.title,
    wm: !!document.querySelector('.wordmark'), mark: vis(document.querySelector('.top .mark')), sound: vis(document.querySelector('#soundBtn .slbl')), cmd: vis(document.querySelector('.top .cmd-text')),
    topText: [...top.querySelectorAll('*')].filter((e) => !e.closest('h1') && vis(e) && e.children.length === 0 && /Complex Map Workbench|Map Workbench/.test(e.textContent)).length, tabs };
})()`);
for (const lang of ['', 'ru', 'it']) {
  for (const w of [1440, 1280, 1100, 900]) {
    await view(w, 800, false, false);
    const ns = 'hdr' + w + lang + (Date.now() % 1000000);
    await load(ns, ST);
    if (lang) { await send('Page.navigate', { url: `${U}?ns=${ns}&lang=${lang}` }); await sleep(2500); }
    await ev(`__cmwSetMain('xy'); 1`); await settle(700);
    const p = await probe();
    info[`${lang || 'en'} ${w}`] = p;
    const at = `${lang || 'en'} ${w}`;
    ok(`${at}: no wordmark and no app name in the bar`, !p.wm && p.topText === 0 && p.mark, p);
    ok(`${at}: the hidden h1 and the title stay`, p.h1.pos === 'absolute' && p.h1.w <= 2 && /Complex Map Workbench/.test(p.title), p);
    ok(`${at}: the bar does not overflow`, !p.over, p);
    ok(`${at}: every view tab's word is centred in its tile (±1 px)`, p.tabs.length >= 4 && p.tabs.every((t) => Math.abs(t.d) <= 1), p.tabs);
    if (w >= 1100) ok(`${at}: the Sound label shows`, p.sound, p);
    if (w >= 1280 && !lang || w >= 1440) ok(`${at}: the search shows its words`, p.cmd, p);
  }
}
await view(1440, 900, false, false);
return { pass: fails.length === 0, fails, info };
