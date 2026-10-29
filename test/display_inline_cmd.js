// The display options inline (issue #247): on a laptop no Display pop-up covers the plane. Each pane head holds its
// options on one row: in the Phase view the style's six glyphs (one click each, the chosen one with its word), n (only for
// the styles it changes), and Outlines and Unit circle as icon toggles named for screen readers; what the head has no room
// for is behind a ⋯ button, with no title. In the X → Y view a pattern button holds the shapes' pattern. On a phone the
// Display sheet starts with the styles' row (no "This view" title), its targets 44 px or more. Laptop and phone, English
// and Russian. A command file for a CDP daemon (test/cdp_kit README).
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ST = { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'phase' } };
const st = () => ev('__cmwState()');
const fresh = async (w, h, mobile, lang, main = 'phase', state = ST) => {
  await view(w, h, false, mobile);
  const ns = 'dinl' + w + (lang || '') + (Date.now() % 1000000);
  await load(ns, state);
  if (lang) { await send('Page.navigate', { url: `${U}?ns=${ns}&lang=${lang}` }); await sleep(2500); }
  await ev(`__cmwSetMain('${main}'); 1`); await settle(1200);
};
const pops = () => ev(`document.querySelectorAll('#popHost .pop').length`);
// the head of pane side: its row's controls, whether anything in it is cut or overflows, and the title's state
const head = (side) => ev(`(() => {
  const p = document.getElementById('${side === 'L' ? 'paneL' : 'paneR'}'), hd = p.querySelector('.pane-head'), f = hd.querySelector('.options');
  const vis = (e) => !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().width > 0;
  const hr = hd.getBoundingClientRect(), t = hd.querySelector('.pane-title'), pt = t && t.querySelector('.ptitle');
  const kids = [...f.children].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { id: e.id || e.querySelector('input,select')?.id || e.className.split(' ').slice(-1)[0], l: r.left, r: r.right, w: r.width, h: r.height, cut: e.scrollWidth > e.clientWidth + 1 && !e.matches('.seg') }; });
  return { kids, over: hd.scrollWidth > hd.clientWidth + 1, outside: kids.filter((k) => k.l < hr.left - 1 || k.r > hr.right + 1).map((k) => k.id),
    title: pt ? { shown: vis(pt), cut: pt.scrollWidth > pt.clientWidth + 1 && t.clientWidth < pt.scrollWidth, cls: t.className } : null,
    disp: !!hd.querySelector('.disp-btn'), more: vis(f.querySelector('.opts-btn:not(.pat-btn)')), pat: vis(f.querySelector('.pat-btn')) };
})()`);
// the style row in X's head: its buttons, their names (the chosen one's word shows, the others' glyph only)
const styleRow = () => ev(`(() => {
  const s = document.getElementById('dcSeg'); if (!s || !s.getClientRects().length) return null;
  return { inHead: !!s.closest('.pane-head'), n: s.children.length, btns: [...s.children].map((b) => { const nm = b.querySelector('.sty-n'), r = b.getBoundingClientRect(); return { v: b.dataset.v, on: b.getAttribute('aria-checked') === 'true', name: b.getAttribute('aria-label'), word: !!nm && nm.getClientRects().length > 0, glyph: !!b.querySelector('.sty-g svg'), tip: b.dataset.tip, w: r.width, h: r.height }; }) };
})()`);
const ctl = (id) => ev(`(() => { const i = document.getElementById('${id}'); if (!i) return null; const l = i.closest('label') || i, r = l.getBoundingClientRect(); const lab = l.querySelector(':scope > .tg-l') || l.querySelector(':scope > span:not(.tg-ic)'); return { vis: r.width > 0 && l.getClientRects().length > 0, inHead: !!l.closest('.pane-head'), inPop: !!l.closest('.pop'), w: r.width, h: r.height, name: (lab ? lab.textContent : '').trim(), checked: i.checked, tip: l.dataset ? l.dataset.tip : null }; })()`);
const clickId = (id) => ev(`(() => { const i = document.getElementById('${id}'); if (!i) return null; i.click(); return i.checked; })()`);

// ---- laptop, English, the Phase view
for (const [w, h, lang] of [[1440, 900, ''], [1100, 800, ''], [1366, 800, 'ru']]) {
  await fresh(w, h, false, lang);
  const tag = `${w} ${lang || 'en'}`;
  let hd = await head('L');
  ok(`${tag} Phase: no Display button, no pop-up open`, !hd.disp && (await pops()) === 0, hd);
  ok(`${tag} Phase: the head neither overflows nor cuts a control`, !hd.over && !hd.outside.length && !hd.kids.some((k) => k.cut), hd);
  ok(`${tag} Phase: the title shows`, hd.title && hd.title.shown, hd.title);
  let sr = await styleRow();
  if (!sr) {   // (not in the head at all: what the head holds, the view and the window, then the next size)
    ok(`${tag} Phase: the style row shows`, false, { hd, view: (await st()).view, dc: (await st()).dc, inner: await ev('[innerWidth, innerHeight, devicePixelRatio]'), seg: await ev(`(() => { const e = document.getElementById('dcSeg'); return e ? { parent: e.parentElement && (e.parentElement.id || e.parentElement.className), inPop: !!e.closest('.pop') } : null; })()`) });
    continue;
  }
  ok(`${tag} Phase: the six styles are a row in X's head, each a glyph with a name; the chosen one shows its word, the others not`,
    sr && sr.inHead && sr.n === 6 && sr.btns.every((b) => b.glyph && b.name && b.tip) && sr.btns.filter((b) => b.word).length === 1 && sr.btns.find((b) => b.word).on, sr);
  ok(`${tag} Phase: Pulled-back grid keeps its whole name for screen readers`, sr && /Pulled-back grid|Обратн|сетк/i.test(sr.btns.find((b) => b.v === 'grid').name), sr && sr.btns.find((b) => b.v === 'grid'));
  // one click picks a style, and nothing opens
  await ev(`document.querySelector('#dcSeg button[data-v="modulus"]').click()`); await settle(500);
  sr = await styleRow();
  ok(`${tag} Phase: one click on Contours sets it, with no pop-up`, (await st()).dc === 'modulus' && (await pops()) === 0 && sr.btns.find((b) => b.v === 'modulus').on && sr.btns.find((b) => b.v === 'modulus').word, [(await st()).dc, sr]);
  const sb = await ev(`(document.querySelector('#styleBtn .hw') || {}).textContent`);
  ok(`${tag} Phase: the header's style button follows`, sb && sb === (await ev(`document.querySelector('#dcSeg button[data-v="modulus"]').getAttribute('aria-label')`)), sb);
  // n only for the styles it changes
  let n = await ctl('secSel');
  ok(`${tag} Phase: n shows for Contours, in the head`, n && n.vis && n.inHead, n);
  await ev(`document.querySelector('#dcSeg button[data-v="classic"]').click()`); await settle(500);
  ok(`${tag} Phase: no n for Modulus`, !(await ctl('secSel')), await ctl('secSel'));
  await ev(`document.querySelector('#dcSeg button[data-v="enhanced"]').click()`); await settle(500);
  n = await ctl('secSel');
  ok(`${tag} Phase: n back for Tiles`, n && n.vis, n);
  // Outlines and Unit circle: icon toggles in the head, named, one click each
  for (const [id, re] of [['outlineChk', /Outlines|Контуры|Границы/], ['unitChk', /Unit circle|окружность/i]]) {
    const c = await ctl(id);
    ok(`${tag} Phase: ${id} is an icon toggle in X's head with its word as its name and tooltip`, c && c.vis && c.inHead && !c.inPop && c.w <= 30 && c.h >= 24 && re.test(c.name) && c.tip === c.name, c);
    if (!c) continue;   // (reported just above: not in the page)
    const was = c.checked;
    await clickId(id); await settle(300);
    const now = ((await ctl(id)) || {}).checked;
    ok(`${tag} Phase: one click on ${id} toggles it`, now === !was && (await pops()) === 0, [now, was]);
    await ev(`(() => { const i = document.getElementById('${id}'); if (i) i.click(); return 1; })()`); await settle(300);
  }
  // keyboard: the style row takes the arrow keys
  await ev(`document.querySelector('#dcSeg button.on').focus()`);
  await key('ArrowRight'); await settle(400);
  ok(`${tag} Phase: ArrowRight in the style row picks the next style`, (await st()).dc === 'phase', (await st()).dc);
  await ev(`document.querySelector('#dcSeg button[data-v="enhanced"]').click()`); await settle(300);
}

// ---- laptop, the X → Y view (the default example's view)
for (const [w, h, lang] of [[1440, 900, ''], [1280, 800, ''], [1100, 800, ''], [1440, 900, 'ru']]) {
  const XY = { shapes: [{ type: 'disc', cx: 0, cy: 0, r: 1 }], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
  await fresh(w, h, false, lang, 'xy', XY);
  const tag = `${w} ${lang || 'en'} X → Y`;
  for (const side of ['L', 'R']) {
    const hd = await head(side);
    ok(`${tag} ${side}: no Display button; a pattern button; nothing overflows or is cut`, !hd.disp && hd.pat && !hd.over && !hd.outside.length && !hd.kids.some((k) => k.cut), hd);
    ok(`${tag} ${side}: the title shows`, hd.title && hd.title.shown, hd.title);
  }
  const pb = await ev(`(() => { const b = document.querySelector('#rightFoot .pat-btn'); return { name: b.getAttribute('aria-label'), tip: b.dataset.tip, h: b.getBoundingClientRect().height }; })()`);
  ok(`${tag}: the pattern button is named for the pattern`, /(Pattern|Узор): \S/.test(pb.name) && pb.tip === pb.name, pb);
  await ev(`document.querySelector('#rightFoot .pat-btn').click()`); await settle(500);
  let p = await ev(`(() => { const p = document.querySelector('#popHost .pat-pop'); if (!p) return null; const b = p.getBoundingClientRect(), hd = document.querySelector('#paneR .pane-head').getBoundingClientRect(); return { pats: p.querySelectorAll('#patternSeg .pat').length, titles: p.querySelectorAll('.opts-h').length, under: b.top >= hd.bottom - 1, exp: document.querySelector('#rightFoot .pat-btn').getAttribute('aria-expanded') }; })()`);
  ok(`${tag}: the pattern button opens the patterns, under the head, with no title`, p && p.pats >= 8 && p.titles === 0 && p.under && p.exp === 'true', p);
  await ev(`document.querySelector('#patternSeg .pat[data-pat="polar"]').click()`); await settle(500);
  ok(`${tag}: a pattern picked there applies, and the button's name follows`, (await ev(`(document.querySelector('#patternSeg .pat.on') || {}).dataset?.pat`)) === 'polar' && /Log|Лог/.test(await ev(`document.querySelector('#rightFoot .pat-btn').getAttribute('aria-label')`)), [await ev(`(document.querySelector('#patternSeg .pat.on') || {}).dataset?.pat`), await ev(`document.querySelector('#rightFoot .pat-btn').getAttribute('aria-label')`)]);
  await key('Escape'); await settle(300);
  ok(`${tag}: Escape closes it, and the regions' box goes home`, (await pops()) === 0 && (await ev(`document.getElementById('regionsBox').parentElement.id`)) === 'regionsHome', await ev(`document.getElementById('regionsBox').parentElement.id`));
  // View outline, Phase key, Unit circle: inline in Y's head, or behind its ⋯ (with no title), one action each
  for (const id of ['fovChk', 'wKeyChkR', 'unitChk']) {
    let c = await ctl(id);
    let opened = false;
    if (!(c && c.vis && c.inHead)) {
      await ev(`document.querySelector('#rightFoot .opts-btn:not(.pat-btn)').click()`); await settle(400);
      opened = true; c = await ctl(id);
      ok(`${tag}: ${id} not in the head is in the ⋯ pop-up, with no title`, c && c.vis && c.inPop && (await ev(`document.querySelectorAll('#popHost .opts-h').length`)) === 0, c);
    } else ok(`${tag}: ${id} in Y's head is an icon toggle named for screen readers`, c.w <= 30 && c.name.length > 2, c);
    const was = c && c.checked;
    await clickId(id); await settle(400);
    ok(`${tag}: ${id} toggles`, (await ev(`(document.getElementById('${id}') || {}).checked`)) === !was, was);
    await ev(`(() => { const i = document.getElementById('${id}'); if (i) i.click(); return 1; })()`); await settle(300);
    if (opened) { await key('Escape'); await settle(300); }
  }
  // (the check moves between the heads with the view: switching views never drops it from the page)
  for (const m of ['phase', 'xy', 'land', 'xy']) { await ev(`__cmwSetMain('${m}'); 1`); await settle(600); }
  ok(`${tag}: after Phase, X → Y, Landscape, X → Y the unit circle's check is still in the page and works`, await ev(`(() => { const u = document.getElementById('unitChk'); return !!u && document.body.contains(u); })()`), await ev(`(document.getElementById('unitBox') || {}).parentElement?.id || null`));
}

// ---- phone: the Display sheet
for (const [w, lang] of [[390, ''], [360, ''], [390, 'ru'], [360, 'ru']]) {
  await fresh(w, 780, true, lang);
  const tag = `phone ${w} ${lang || 'en'}`;
  await ev(`Phone.open('display')`); await settle(900);
  const sh = await ev(`(() => {
    const body = document.querySelector('.ph-sheet .ph-body:not([hidden])') || document.querySelector('.ph-sheet'), s = document.getElementById('dcSeg'); if (!s) return null;
    const sb = s.closest('.ph-sheet, .ph-sb').getBoundingClientRect();
    const first = [...s.closest('.ph-vopts').parentElement.children].find((e) => e.getClientRects().length && !e.matches('.ph-h[hidden]'));
    return { first: first === s.closest('.ph-vopts'), firstIsSeg: s.closest('.ph-vopts').firstElementChild === s, titles: [...document.querySelectorAll('.ph-sheet h3')].filter((e) => e.getClientRects().length).map((e) => e.textContent),
      chip: !!document.querySelector('.ph-style') && document.querySelector('.ph-style').getClientRects().length > 0,
      btns: [...s.children].map((b) => { const r = b.getBoundingClientRect(), n = b.querySelector('.sty-n'); return { w: r.width, h: r.height, in: r.left >= sb.left - 1 && r.right <= sb.right + 1, word: n && n.getClientRects().length > 0, cut: n && n.scrollWidth > n.clientWidth + 1 }; }) };
  })()`);
  ok(`${tag}: the sheet starts with the styles' row, no "This view" title, no separate style chip in the flat Phase view`, sh && sh.first && sh.firstIsSeg && !sh.titles.some((t) => /This view|Этот вид/.test(t)) && !sh.chip, sh);
  ok(`${tag}: six styles, each ≥ 44 × 44 px with its word, inside the sheet, none cut`, sh && sh.btns.length === 6 && sh.btns.every((b) => b.w >= 44 && b.h >= 44 && b.in && b.word && !b.cut), sh && sh.btns);
  await ev(`document.querySelector('#dcSeg button[data-v="classic"]').click()`); await settle(500);
  ok(`${tag}: one tap picks a style`, (await st()).dc === 'classic', (await st()).dc);
  for (const id of ['outlineChk', 'unitChk']) {
    const c = await ctl(id);
    ok(`${tag}: ${id} is a row of the sheet with its word, ≥ 44 px tall`, c && c.vis && !c.inHead && c.h >= 44 && c.name.length > 2, c);
  }
  await ev(`Phone.close(true)`); await settle(400);
  // the Landscape: the chip says where the styles live
  await ev(`__cmwSetMain('land'); 1`); await settle(800);
  await ev(`Phone.open('display')`); await settle(800);
  const ch = await ev(`(() => { const e = document.querySelector('.ph-style'); return e && e.getClientRects().length ? { dis: e.getAttribute('aria-disabled'), h: e.getBoundingClientRect().height } : null; })()`);
  ok(`${tag}: in the Landscape the style chip shows, dimmed`, ch && ch.dis === 'true' && ch.h >= 44, ch);
  await ev(`Phone.close(true)`); await settle(300);
}
await view(1440, 900, false, false);
return { pass: fails.length === 0, fails };
