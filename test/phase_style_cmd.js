// The Phase style (Tiles, Plain, Modulus, Contours, Pulled-back grid, Cauchy) is one click away (issue #81): the pane head's
// own style row (#247: inline, no Display pop-up); the top bar has no style control of its own (#334). On a phone the
// Display sheet starts with that row; its "Style: Tiles" chip, with the menu of the styles, shows there in the Landscape only. A command file for a CDP daemon (test/cdp_kit README).
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ST = { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'phase' } };
const dc = () => ev('__cmwState().dc');
const menuItems = () => ev(`[...document.querySelectorAll('#popHost .pop.menu .mi')].map((b) => ({ t: b.textContent.trim(), checked: b.getAttribute('aria-checked'), dis: b.disabled }))`);
const pickItem = async (re) => { await ev(`[...document.querySelectorAll('#popHost .pop.menu .mi')].find((b) => ${re}.test(b.textContent)).click()`); await settle(500); };
const fresh = async (w, h, mobile, lang, state) => {
  await view(w, h, false, mobile);
  const ns = 'pstyle' + w + (lang || '') + (Date.now() % 1000000);
  await load(ns, state || ST);
  if (lang) { await send('Page.navigate', { url: `${U}?ns=${ns}&lang=${lang}` }); await sleep(2500); }
  await ev(`__cmwSetMain('phase'); 1`); await settle(800);
};
const btn = () => ev(`(() => { const b = document.getElementById('styleBtn'); if (!b) return null; const r = b.getBoundingClientRect(); return { vis: !b.hidden && r.width > 0, label: (b.querySelector('.hw') || {}).textContent, disabled: b.getAttribute('aria-disabled'), tip: b.getAttribute('data-tip'), r: [r.left, r.right], top: document.querySelector('.top').getBoundingClientRect().right, over: document.querySelector('.top').scrollWidth > document.querySelector('.top').clientWidth + 1 }; })()`);

// ---- laptop: the header has no style control at any width (#334: the pane head's row is the one place); the row works
const hdrStyle = () => ev(`(() => { const top = document.querySelector('.top'); const named = [...top.querySelectorAll('button')].filter((b) => /Phase style|Стиль фазы|Stile della fase/i.test((b.getAttribute('aria-label') || '') + (b.getAttribute('data-tip') || '') + (b.getAttribute('title') || ''))); return { id: !!document.getElementById('styleBtn'), named: named.map((b) => b.id || b.className), over: top.scrollWidth > top.clientWidth + 1 }; })()`);
for (const [w, lang] of [[1440, ''], [1280, ''], [1100, ''], [900, ''], [1440, 'ru'], [1280, 'ru'], [1100, 'it']]) {
  await fresh(w, 800, false, lang);
  const h = await hdrStyle();
  ok(`${w} ${lang || 'en'}: Phase view, no style control in the top bar and no overflow`, !h.id && h.named.length === 0 && !h.over, h);
}
await fresh(1440, 900, false, '');
ok('Phase view: the pane head\'s style row has the six styles, one on', await ev(`document.querySelectorAll('#dcSeg button').length === 6 && document.querySelectorAll('#dcSeg button.on').length === 1`), await dc());
await ev(`document.querySelector('#dcSeg button[data-v="modulus"]').click()`); await settle(500);
ok('a click on a style there sets it (one click, no pop-up)', (await dc()) === 'modulus' && !(await ev(`!!document.querySelector('.disp-btn')`)), await dc());
await ev(`document.querySelector('#dcSeg button[data-v="grid"]').click()`); await settle(500);
ok('and again', (await dc()) === 'grid', await dc());
await ev(`__cmwSetMain('land'); 1`); await settle(700);
ok('Landscape: still no style control in the top bar', !(await hdrStyle()).id, await hdrStyle());

// ---- phone: the Display sheet's first row (#247: the styles' own row of glyphs in the flat Phase view, one tap each; the
// chip, with its menu, in the Landscape, where it says where the styles live)
for (const [w, lang] of [[360, ''], [390, ''], [360, 'ru'], [390, 'ru']]) {
  await fresh(w, 780, true, lang);
  await ev(`__cmwSetMain('phase'); 1`); await settle(600);
  await ev(`Phone.open('display')`); await settle(900);
  const c = await ev(`(() => { const e = document.getElementById('dcSeg'); if (!e || !e.getClientRects().length) return null; const v = e.closest('.ph-vopts'), r = e.getBoundingClientRect(), s = e.closest('.ph-sheet, .ph-sb').getBoundingClientRect(), ch = document.querySelector('.ph-style'); return { first: !!v && v.firstElementChild === e && [...v.parentElement.children].filter((x) => x.getClientRects().length)[0] === v, l: r.left, rr: r.right, sl: s.left, sr: s.right, minH: Math.min(...[...e.children].map((b) => b.getBoundingClientRect().height)), chip: !!ch && ch.getClientRects().length > 0 }; })()`);
  ok(`phone ${w} ${lang || 'en'}: the Display sheet's first row is the style row, whole and inside the sheet, no chip beside it`, c && c.first && c.l >= c.sl - 1 && c.rr <= c.sr + 1 && c.minH >= 44 && !c.chip, c);
  await ev(`document.querySelector('#dcSeg button[data-v="classic"]').click()`); await settle(500);
  ok(`phone ${w} ${lang || 'en'}: one tap sets the style`, (await dc()) === 'classic', await dc());
  await ev(`Phone.close(true)`); await settle(300);
  await ev(`__cmwSetMain('land'); 1`); await settle(700);
  await ev(`Phone.open('display')`); await settle(800);
  const k = await ev(`(() => { const e = document.querySelector('.ph-style'); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(), t = e.querySelector('.ph-rl'); return { text: t.textContent, h: r.height, dis: e.getAttribute('aria-disabled'), cut: t.scrollWidth > t.clientWidth + 1 }; })()`);
  ok(`phone ${w} ${lang || 'en'}: in the Landscape the style chip shows, dimmed, whole`, k && /(Style|Стиль): /.test(k.text) && k.h >= 44 && k.dis === 'true' && !k.cut, k);
  await ev(`document.querySelector('.ph-style').click()`); await settle(500);
  items = await menuItems();
  ok(`phone ${w} ${lang || 'en'}: its menu says where the styles live and switches`, items.length === 2 && /Switch to Phase|Перейти/.test(items[1].t), items);
  await pickItem('/Switch to Phase|Перейти/');
  ok(`phone ${w} ${lang || 'en'}: Switch to Phase goes to the flat Phase view`, (await ev('__cmwState().view.main')) === 'phase', await ev('__cmwState().view.main'));
  await ev(`Phone.close(true)`); await settle(300);
}
await view(1440, 900, false, false);
return { pass: fails.length === 0, fails };
