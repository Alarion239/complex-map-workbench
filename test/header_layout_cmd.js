// The top bar and the view tabs (issues #248, #249): no "Complex Map Workbench" text in the bar (the logo, a hidden h1 and
// the page title stay); the room it gave goes to the search words and, together, the words of Export, Share, Theme and Sound; the bar does not overflow; the word
// of every view tab (Plane | Sphere in the panes, X → Y | Phase | Landscape in the bar) is centred in its tile with its
// icon as a pair (#335: the gap left of the content equals the gap right of it). 1440, 1280, 1100 and 900 px, en, ru, it. A command file for a CDP daemon (test/cdp_kit README).
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const LAPTOP_PX = 1100;    // (from this width the four words and the search's words show where they fit; under it the four are icons)
const WIDE_PX = 1440;      // (from this width the four words and a short example name must all show)
const ST = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 } };
const probe = () => ev(`(() => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
  const top = document.querySelector('.top'), h1 = document.querySelector('h1');
  const tabs = [...document.querySelectorAll('#leftTabs > button, #rightTabs > button, #viewSwitch > button')].filter((b) => vis(b) && vis(b.querySelector('span'))).map((b) => {
    const r = b.getBoundingClientRect(), s = b.querySelector('span').getBoundingClientRect(), ic = b.querySelector('svg'), i = ic && vis(ic) ? ic.getBoundingClientRect() : null;
    // the content: the icon (where it shows) and the word; d is the gap left of it less the gap right of it
    const l = Math.min(s.left, i ? i.left : s.left), rr = Math.max(s.right, i ? i.right : s.right);
    return { t: b.dataset.mode, w: Math.round(r.width), d: +((l - r.left) - (r.right - rr)).toFixed(2), icon: !!i };
  });
  const hr = h1.getBoundingClientRect(), cs = getComputedStyle(h1);
  return { over: top.scrollWidth > top.clientWidth + 1, h1: { w: Math.round(hr.width), h: Math.round(hr.height), clip: cs.clipPath, pos: cs.position }, title: document.title,
    wm: !!document.querySelector('.wordmark'), mark: vis(document.querySelector('.top .mark')), sound: vis(document.querySelector('#soundBtn .slbl')), other: [...document.querySelectorAll('#viewSwitch > button > span')].some((s) => vis(document.getElementById('viewSwitch')) && !vis(s)) || vis(document.querySelector('.top .cmd-field .ct-s')) || !vis(document.querySelector('.top .cmd-text')), words: ['#exportBtn .hw', '#shareBtn .hw', '#themeBtn .hw', '#soundBtn .slbl'].map((q) => vis(document.querySelector(q))), cmd: vis(document.querySelector('.top .cmd-text')),
    topText: [...top.querySelectorAll('*')].filter((e) => !e.closest('h1') && vis(e) && e.children.length === 0 && /Complex Map Workbench|Map Workbench/.test(e.textContent)).length, tabs };
})()`);
for (const lang of ['', 'ru', 'it']) {
  for (const w of [1440, 1280, 1100, 900]) {
    await view(w, 800, false, false);
    const ns = 'hdr' + w + lang + (Date.now() % 1000000);
    await load(ns, ST);
    if (lang) { await send('Page.navigate', { url: `${U}?ns=${ns}&lang=${lang}` }); await sleep(2500); }
    await ev(`__cmwSetMain('xy'); 1`); await settle(700);
    let p = await probe();
    for (let i = 0; i < 6 && p.tabs.length < 4; i++) { await settle(500); p = await probe(); }   // (a page still drawing its panes has no tabs yet)
    info[`${lang || 'en'} ${w}`] = p;
    const at = `${lang || 'en'} ${w}`;
    ok(`${at}: no wordmark and no app name in the bar`, !p.wm && p.topText === 0 && p.mark, p);
    ok(`${at}: the hidden h1 and the title stay`, p.h1.pos === 'absolute' && p.h1.w <= 2 && /Complex Map Workbench/.test(p.title), p);
    ok(`${at}: the bar does not overflow`, !p.over, p);
    ok(`${at}: every view tab's content (icon and word) is centred in its tile (±1 px)`, p.tabs.length >= 4 && p.tabs.every((t) => Math.abs(t.d) <= 1), p.tabs);
    // (the four words, Export, Share, Theme and Sound, show together or not at all; the four fold first, so the search's words are never the ones to go while any of them shows)
    ok(`${at}: Export, Share, Theme and Sound show their words together or not at all`, p.words.every((x) => x === p.words[0]), p.words);
    if (w < LAPTOP_PX) ok(`${at}: under ${LAPTOP_PX} px the four are icons`, !p.words.some(Boolean), p.words);
    if (w >= WIDE_PX) ok(`${at}: the four words show at ${WIDE_PX}`, p.words.every(Boolean), p.words);
    ok(`${at}: none of the four words shows while the search is icon-only`, !(p.words.some(Boolean) && !p.cmd), p);
    // (the four fold before any other word of the bar: the view tabs' words, the search's short label or none)
    ok(`${at}: the four words show only while the view tabs and the search keep their full words`, !(p.words.some(Boolean) && p.other), p);
    // (and before an open example's name: it takes room beside Examples)
    await ev(`(() => { const x = document.querySelector('#examplesBtn .exlabel'); x.textContent = 'Zeta function'; x.classList.remove('stale'); return 1; })()`); await settled({});
    const px = await ev(`(() => { const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; const nm = document.querySelector('#examplesBtn .exlabel'); return { name: vis(nm), nameCut: vis(nm) && nm.scrollWidth > nm.clientWidth + 0.5, words: ['#exportBtn .hw', '#shareBtn .hw', '#themeBtn .hw', '#soundBtn .slbl'].map((q) => vis(document.querySelector(q))) }; })()`);
    ok(`${at}: with an example open, the four words show only while its name does`, !(px.words.some(Boolean) && !px.name), px);
    // (hdrFit measures the name: it shows wherever it fits, in every language, and is never shown cut)
    ok(`${at}: an open example's name is never shown cut`, !px.nameCut, px);
    if (w >= WIDE_PX) ok(`${at}: a short example name shows beside Examples`, px.name, px);
    if (w >= LAPTOP_PX) ok(`${at}: the search shows its words`, p.cmd, p);
    // (#334) the Phase view has no style button in the bar either, and the bar still does not overflow
    await ev(`__cmwSetMain('phase'); 1`); await settle(500);
    const ph = await ev(`({ btn: !!document.getElementById('styleBtn'), over: (() => { const t = document.querySelector('.top'); return t.scrollWidth > t.clientWidth + 1; })() })`);
    ok(`${at}: Phase view, no style button and no overflow`, !ph.btn && !ph.over, ph);
  }
}
await view(1440, 900, false, false);
return { pass: fails.length === 0, fails, info };
