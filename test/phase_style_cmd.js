// The Phase style (Tiles, Plain, Modulus, Contours, Pulled-back grid, Cauchy) is one click away (issue #81): a button in the
// header beside the palette's disc while X is the flat Phase view, with a menu of the styles; in the Landscape it is dimmed
// and says where the styles live; on a phone the Display sheet's first row is a "Style: Tiles" chip with the same menu. The
// pane head's own style row (#247: inline, no Display pop-up) follows, and on a phone the Display sheet starts with that
// row; the chip shows there in the Landscape only. A command file for a CDP daemon (test/cdp_kit README).
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

// ---- laptop
await fresh(1440, 900, false, '');
let b = await btn();
ok('Phase view: the style button shows the current style', b && b.vis && b.label === 'Tiles', b);
await ev(`__cmwSetMain('xy'); 1`); await settle(500);
ok('X → Y: no style button', !(await btn()).vis, await btn());
await ev(`__cmwSetMain('phase'); 1`); await settle(500);
await ev(`document.getElementById('styleBtn').click()`); await settle(400);
let items = await menuItems();
ok('its menu lists the six styles, Tiles checked', items.length === 6 && items[0].t === 'Tiles' && items[0].checked === 'true' && items.map((x) => x.t).join() === 'Tiles,Plain,Modulus,Contours,Pulled-back grid,Cauchy', items);
await pickItem('/Contours/');
b = await btn();
ok('picking Contours sets the style and the button follows', (await dc()) === 'modulus' && b.label === 'Contours', [await dc(), b]);
ok('the pane head\'s own style row follows, with no pop-up to open (#247)', !(await ev(`!!document.querySelector('.disp-btn')`)) && await ev(`(document.querySelector('#dcSeg button.on') || {}).dataset && document.querySelector('#dcSeg button.on').dataset.v === 'modulus'`), await ev(`(document.querySelector('#dcSeg button.on') || {}).textContent`));
await ev(`document.querySelector('#dcSeg button[data-v="grid"]').click()`); await settle(500);
ok('and a pick there moves the button', (await btn()).label === 'Pulled-back grid', await btn());
ok('the header has no overflow with it', !(await btn()).over, await btn());
// the Landscape: dimmed, says where the styles live, and switches
await ev(`__cmwSetMain('land'); 1`); await settle(700);
b = await btn();
ok('Landscape: the button is there, dimmed, and says where the styles belong', b.vis && b.disabled === 'true' && /belong to the flat Phase view/.test(b.tip), b);
await ev(`document.getElementById('styleBtn').click()`); await settle(400);
items = await menuItems();
ok('its menu has the note (disabled) and the switch', items.length === 2 && items[0].dis && /Switch to Phase/.test(items[1].t), items);
await pickItem('/Switch to Phase/');
ok('Switch to Phase goes to the flat Phase view', (await ev('__cmwState().view.main')) === 'phase' && (await btn()).disabled === 'false', await ev('__cmwState().view'));
// a narrower header: the word gives way before Share's, and nothing overflows
for (const w of [1280, 1100]) {
  await view(w, 800, false, false); await settle(600);
  b = await btn();
  ok(`${w} px: the header does not overflow with the style button`, !b.over, b);
}
// Russian
await fresh(1366, 800, false, 'ru');
b = await btn();
ok('Russian: the button names the style', b && b.vis && /Тасс|Плитк|Мозаик/.test(b.label || '') || (b && b.vis && !!b.label), b);
ok('Russian: no overflow', b && !b.over, b);

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
