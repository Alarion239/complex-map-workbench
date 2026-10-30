// The display options inline (issue #247): on a laptop no Display pop-up covers the plane. Each pane head holds its
// options on one row: in the Phase view the style's six glyphs (one click each; option 1: no word, each name is the
// tooltip and the accessible name, the chosen one's the header's style button), and Outlines and Unit circle as icon
// toggles named for screen readers; n (only for the styles it changes) and what the head has no room for are behind a
// ⋯ button, with no title. In the X → Y view a pattern button holds the shapes' pattern. On a phone the Display sheet
// starts with the styles' row (no "This view" title), its targets 44 px or more. Laptop and phone, English and
// Russian. A command file for a CDP daemon (test/cdp_kit README).
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
  // (a slow shared machine may still be laying the heads out: wait for both option rows, up to 5 s)
  for (let i = 0; i < 25 && !(await ev(`!!document.querySelector('#paneL .pane-head .options') && !!document.querySelector('#paneR .pane-head .options')`)); i++) await sleep(200);
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
// (what X's head holds when a check finds the style row missing: its items and widths, the strip's children, the row)
const diag = () => ev(`(() => { const hd = document.querySelector('#paneL .pane-head'), f = document.getElementById('leftFoot'), s = document.getElementById('dcSeg');
  return { headW: hd.clientWidth, head: [...hd.children].map((c) => [c.id || c.className.slice(0, 16), Math.round(c.getBoundingClientRect().width)]), foot: f ? [...f.children].map((c) => [c.id || c.className.slice(0, 16), Math.round(c.getBoundingClientRect().width)]) : null,
    seg: s ? { connected: s.isConnected, rects: s.getClientRects().length, parent: s.parentElement && (s.parentElement.id || s.parentElement.className), disp: getComputedStyle(s).display, w: s.getBoundingClientRect().width } : null, pops: document.querySelectorAll('#popHost .pop').length, ph: document.documentElement.className }; })()`);
const ctl = (id) => ev(`(() => { const i = document.getElementById('${id}'); if (!i) return null; const l = i.closest('label') || i, r = l.getBoundingClientRect(); const lab = l.querySelector(':scope > .tg-l') || l.querySelector(':scope > span:not(.tg-ic)'); return { vis: r.width > 0 && l.getClientRects().length > 0, inHead: !!l.closest('.pane-head'), inPop: !!l.closest('.pop'), w: r.width, h: r.height, name: (lab ? lab.textContent : '').trim(), checked: i.checked, tip: l.dataset ? l.dataset.tip : null }; })()`);
const clickId = (id) => ev(`(() => { const i = document.getElementById('${id}'); if (!i) return null; i.click(); return i.checked; })()`);

// ---- laptop, English, the app's own first scene at 1280 px: the Phase title whole (option 1's promise). (Where the
// Phase key chip renders, it fills in after the head's first layout, and the strip laid out without it left the title
// shortened; this daemon's chip is empty, so here the check guards the room, the chip's case is checked by hand)
{
  await view(1280, 800, false, false);
  await send('Page.navigate', { url: `${U}?ns=dinlfirst${Date.now() % 1000000}` }); await sleep(3000);
  await ev(`__cmwSetMain('phase'); 1`); await settle(1500);
  const hd = await head('L');
  ok(`1280 en first scene, Phase: the title is whole (the toggles give way first) and the head does not overflow`, hd && !hd.__exc && hd.title && hd.title.shown && !/\b(short|terse|notag)\b/.test(hd.title.cls) && !hd.over && !hd.outside.length, hd);
}

// ---- laptop, English, the Phase view
for (const [w, h, lang] of [[1440, 900, ''], [1280, 800, ''], [1100, 800, ''], [1366, 800, 'ru']]) {
  await fresh(w, h, false, lang);
  const tag = `${w} ${lang || 'en'}`;
  // (at 1440 px in English the whole row is inline beside a whole title; narrower or in Russian, and with wider fonts, a
  // head short of room has its designed fallbacks: controls behind ⋯ (reachable, no title), the style's word dropped,
  // the title cut by fitTitle; never an overflow)
  const strict = w === 1440 && !lang;
  let hd = await head('L');
  if (!hd || hd.__exc) { ok(`${tag} Phase: X's head reads`, false, hd); continue; }
  ok(`${tag} Phase: no Display button, no pop-up open`, !hd.disp && (await pops()) === 0, hd);
  ok(`${tag} Phase: the head neither overflows nor cuts a control`, !hd.over && !hd.outside.length && !hd.kids.some((k) => k.cut), hd);
  if (strict) ok(`${tag} Phase: the title shows`, hd.title && hd.title.shown, hd.title);
  // (option 1's promise: the Phase title whole, role included, down to 1280 px in English; the toggles go behind ⋯ first)
  ok(`${tag} Phase: the title is whole (not shortened: the toggles give way first)`, hd.title && hd.title.shown && !/\b(short|terse|notag)\b/.test(hd.title.cls), hd.title);
  let sr = await styleRow();
  if (!sr) {   // (not in the head at all: what the head holds, the view and the window, then the next size)
    ok(`${tag} Phase: the style row shows`, false, { d: await diag(), hd, view: (await st()).view, dc: (await st()).dc, inner: await ev('[innerWidth, innerHeight, devicePixelRatio]'), seg: await ev(`(() => { const e = document.getElementById('dcSeg'); return e ? { parent: e.parentElement && (e.parentElement.id || e.parentElement.className), inPop: !!e.closest('.pop') } : null; })()`) });
    continue;
  }
  // (#247 option 1: the glyphs alone; each style's name is its tooltip and accessible name, the chosen one's the header's
  // style button)
  ok(`${tag} Phase: the six styles are a row of glyphs in X's head, each named, the chosen one marked, no word shown`,
    sr && sr.inHead && sr.n === 6 && sr.btns.every((b) => b.glyph && b.name && b.tip && !b.word) && sr.btns.filter((b) => b.on).length === 1, [sr, await diag()]);
  ok(`${tag} Phase: Pulled-back grid keeps its whole name for screen readers`, sr && /Pulled-back grid|Обратн|сетк/i.test(sr.btns.find((b) => b.v === 'grid').name), sr && sr.btns.find((b) => b.v === 'grid'));
  // one click picks a style, and nothing opens
  await ev(`document.querySelector('#dcSeg button[data-v="modulus"]').click()`); await settle(500);
  sr = await styleRow();
  ok(`${tag} Phase: one click on Contours sets it, with no pop-up`, !!sr && (await st()).dc === 'modulus' && (await pops()) === 0 && sr.btns.find((b) => b.v === 'modulus').on, [(await st()).dc, sr || await diag()]);
  if (!sr) continue;
  const sb = await ev(`(document.querySelector('#styleBtn .hw') || {}).textContent`);
  ok(`${tag} Phase: the header's style button follows`, sb && sb === (await ev(`document.querySelector('#dcSeg button[data-v="modulus"]').getAttribute('aria-label')`)), sb);
  // n only for the styles it changes, and (#247 option 1) always behind the head's ⋯, which shows it with no title
  const nBehind = async () => {
    if (await ctl('secSel')) return { inline: true };
    await ev(`(() => { const b = document.querySelector('#leftFoot .opts-btn:not(.pat-btn)'); if (b) b.click(); return 1; })()`); await settle(400);
    const c = await ctl('secSel'), titles = await ev(`document.querySelectorAll('#popHost .opts-h').length`);
    await key('Escape'); await settle(300);
    return { inline: false, inPop: !!(c && c.vis && c.inPop), titles };
  };
  let n = await nBehind();
  ok(`${tag} Phase: n for Contours is behind X's ⋯, with no title`, !n.inline && n.inPop && n.titles === 0, [n, await diag()]);
  await ev(`document.querySelector('#dcSeg button[data-v="classic"]').click()`); await settle(500);
  n = await nBehind();
  ok(`${tag} Phase: no n for Modulus`, !n.inline && !n.inPop, n);
  await ev(`document.querySelector('#dcSeg button[data-v="enhanced"]').click()`); await settle(500);
  n = await nBehind();
  ok(`${tag} Phase: n back for Tiles, behind ⋯`, !n.inline && n.inPop, n);
  // Outlines and Unit circle: icon toggles in the head, named, one click each
  for (const [id, re] of [['outlineChk', /Outlines|Контуры|Границы/], ['unitChk', /Unit circle|окружность/i]]) {
    let c = await ctl(id), opened = false;
    if (strict || (c && c.inHead)) ok(`${tag} Phase: ${id} is an icon toggle in X's head with its word as its name and tooltip`, c && c.vis && c.inHead && !c.inPop && c.w <= 30 && c.h >= 24 && re.test(c.name) && c.tip === c.name, [c, await diag()]);
    else {
      // (behind the head's ⋯: one click opens a pop-up with no title, the check with its word there)
      await ev(`(() => { const b = document.querySelector('#leftFoot .opts-btn:not(.pat-btn)'); if (b) b.click(); return 1; })()`); await settle(400);
      opened = true; c = await ctl(id);
      ok(`${tag} Phase: ${id} not in X's head is behind its ⋯, with its word, no title`, c && c.vis && c.inPop && re.test(c.name) && (await ev(`document.querySelectorAll('#popHost .opts-h').length`)) === 0, [c, await diag()]);
    }
    if (!c) continue;   // (reported just above: not in the page)
    const was = c.checked;
    await clickId(id); await settle(300);
    const now = ((await ctl(id)) || {}).checked;
    ok(`${tag} Phase: one click on ${id} toggles it`, now === !was && (opened || (await pops()) === 0), [now, was]);
    await ev(`(() => { const i = document.getElementById('${id}'); if (i) i.click(); return 1; })()`); await settle(300);
    if (opened) { await key('Escape'); await settle(300); }
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
    if (w === 1440 && !lang) ok(`${tag} ${side}: the title shows`, hd.title && hd.title.shown, hd.title);
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
  // View outline, Phase key, Unit circle: inline in Y's head, or behind its ⋯ (with no title); with nothing inline, in
  // the pattern button's pop-up above the patterns (one button, #247 option 1)
  for (const id of ['fovChk', 'wKeyChkR', 'unitChk']) {
    let c = await ctl(id);
    let opened = false;
    if (!(c && c.vis && c.inHead)) {
      await ev(`(document.querySelector('#rightFoot .opts-btn:not(.pat-btn)') || document.querySelector('#rightFoot .pat-btn')).click()`); await settle(400);
      opened = true; c = await ctl(id);
      ok(`${tag}: ${id} not in the head is in the ⋯ or pattern pop-up, with no title`, c && c.vis && c.inPop && (await ev(`document.querySelectorAll('#popHost .opts-h').length`)) === 0, c);
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

// ---- a touch screen at desktop layout (a tablet, 1366 × 1024: an iPad Pro's landscape): a long-press on an icon toggle
// or a style glyph shows its name, and the release does not toggle or pick it (#261 review). (At 1024 px option 1 sends
// the toggles behind ⋯ before the title gives up letters, with wider fonts, as on the CI runners; the toggle checked is
// one the head holds)
{
  await fresh(1366, 1024, false, '');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await settle(300);
  const desk = await ev(`!document.documentElement.classList.contains('ph')`);
  const tg = await ev(`(() => { const i = [...document.querySelectorAll('.pane-head label.ic-tg input')].find((x) => x.closest('label').getClientRects().length); return i ? [i.id, i.closest('label').dataset.tip || ''] : null; })()`);
  ok('touch at 1366: an icon toggle in a pane head', Array.isArray(tg), tg);
  const cases = [['#dcSeg button[data-v="grid"]', /Pulled-back grid/, `__cmwState().dc`]];
  if (Array.isArray(tg)) cases.unshift([`#${tg[0]}`, new RegExp(tg[1].split(':')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `document.getElementById('${tg[0]}').checked`]);
  for (const [sel, re, read] of cases) {
    const p = await ev(`(() => { const e = document.querySelector('${sel}'); if (!e) return null; const l = (e.closest('label') || e).getBoundingClientRect(); return l.width ? [l.left + l.width / 2, l.top + l.height / 2] : null; })()`);
    if (!desk || !Array.isArray(p)) { ok(`touch at 1366: ${sel} in a pane head`, false, { desk, p }); continue; }
    const before = await ev(read);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p[0], y: p[1], id: 1 }] });
    await sleep(750);
    const tip = await ev(`(() => { const t = document.getElementById('tip'); return t && t.getClientRects().length && getComputedStyle(t).visibility !== 'hidden' && getComputedStyle(t).opacity !== '0' ? t.textContent : null; })()`);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settle(400);
    ok(`touch at 1366: a long-press on ${sel} shows its name`, re.test(tip || ''), tip);
    ok(`touch at 1366: and its release changes nothing`, (await ev(read)) === before, [before, await ev(read)]);
  }
  await send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 });
}

// ---- phone: the Display sheet
// (the words of an element's text that wrap onto a second line inside themselves)
const BROKEN = `const brokenWords = (e) => { const out = []; if (!e) return out; for (const t of e.childNodes) { if (t.nodeType !== 3) continue; const re = /\\S+/g; let m;
      while ((m = re.exec(t.textContent))) { const r = document.createRange(); r.setStart(t, m.index); r.setEnd(t, m.index + m[0].length); if (new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size > 1) out.push(m[0]); } } return out; };`;
for (const [w, lang] of [[390, ''], [360, ''], [390, 'ru'], [360, 'ru']]) {
  await fresh(w, 780, true, lang);
  const tag = `phone ${w} ${lang || 'en'}`;
  await ev(`Phone.open('display')`); await settle(900);
  const sh = await ev(`(() => {
    ${BROKEN}
    const body = document.querySelector('.ph-sheet .ph-body:not([hidden])') || document.querySelector('.ph-sheet'), s = document.getElementById('dcSeg'); if (!s) return null;
    const sb = s.closest('.ph-sheet, .ph-sb').getBoundingClientRect();
    const first = [...s.closest('.ph-vopts').parentElement.children].find((e) => e.getClientRects().length && !e.matches('.ph-h[hidden]'));
    return { first: first === s.closest('.ph-vopts'), firstIsSeg: s.closest('.ph-vopts').firstElementChild === s, titles: [...document.querySelectorAll('.ph-sheet h3')].filter((e) => e.getClientRects().length).map((e) => e.textContent),
      chip: !!document.querySelector('.ph-style') && document.querySelector('.ph-style').getClientRects().length > 0,
      btns: [...s.children].map((b) => { const r = b.getBoundingClientRect(), n = b.querySelector('.sty-n'); return { w: r.width, h: r.height, in: r.left >= sb.left - 1 && r.right <= sb.right + 1, word: n && n.getClientRects().length > 0, cut: n && n.scrollWidth > n.clientWidth + 1, broken: brokenWords(n) }; }) };
  })()`);
  ok(`${tag}: the sheet starts with the styles' row, no "This view" title, no separate style chip in the flat Phase view`, sh && sh.first && sh.firstIsSeg && !sh.titles.some((t) => /This view|Этот вид/.test(t)) && !sh.chip, sh);
  ok(`${tag}: six styles, each ≥ 44 × 44 px with its word, inside the sheet, none cut`, sh && sh.btns.length === 6 && sh.btns.every((b) => b.w >= 44 && b.h >= 44 && b.in && b.word && !b.cut), sh && sh.btns);
  ok(`${tag}: no style's word is broken across two lines (Russian «Интеграл Коши» was, at 360 px)`, sh && sh.btns.every((b) => !b.broken.length), sh && sh.btns.map((b) => b.broken));
  await ev(`document.querySelector('#dcSeg button[data-v="classic"]').click()`); await settle(500);
  ok(`${tag}: one tap picks a style`, (await st()).dc === 'classic', (await st()).dc);
  for (const id of ['outlineChk', 'unitChk']) {
    const c = await ctl(id);
    ok(`${tag}: ${id} is a row of the sheet with its word, ≥ 44 px tall`, c && c.vis && !c.inHead && c.h >= 44 && c.name.length > 2, c);
  }
  // (the mesh stops stay inside their group: in Russian their laptop stagger, two rows of 44 px targets, ran under the tip)
  const mesh = await ev(`(() => { const g = document.getElementById('meshGroup'); if (!g || !g.getClientRects().length) return null; const gb = g.getBoundingClientRect().bottom;
    return [...g.querySelectorAll('#meshPresets > button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, over: Math.round(r.bottom - gb), h: Math.round(r.height) }; }); })()`);
  ok(`${tag}: the mesh quality's five stops stay inside their group, each ≥ 44 px tall`, mesh && mesh.length === 5 && mesh.every((b) => b.over <= 1 && b.h >= 44), mesh);
  await ev(`Phone.close(true)`); await settle(400);
  // the Landscape: the chip says where the styles live
  await ev(`__cmwSetMain('land'); 1`); await settle(800);
  await ev(`Phone.open('display')`); await settle(800);
  const ch = await ev(`(() => { const e = document.querySelector('.ph-style'); return e && e.getClientRects().length ? { dis: e.getAttribute('aria-disabled'), h: e.getBoundingClientRect().height } : null; })()`);
  ok(`${tag}: in the Landscape the style chip shows, dimmed`, ch && ch.dis === 'true' && ch.h >= 44, ch);
  await ev(`Phone.close(true)`); await settle(300);
}
// a landscape phone (wider than 767 px): the Display sheet opened from the Phase plane has all its options, the styles
// first (it had only the unit circle: the plane's strip was laid out as a laptop's, the sheet given only its overflow)
for (const lang of ['', 'ru']) {
  await fresh(780, 360, true, lang);
  const tag = `phone 780 × 360 ${lang || 'en'}`;
  await ev(`(() => { const b = document.querySelector('#plotL .ph-dsp'); if (b) b.click(); return !!b; })()`); await settle(900);
  const sh = await ev(`(() => {
    ${BROKEN}
    const s = document.getElementById('dcSeg'), v = s && s.closest('.ph-vopts'); if (!v) return { seg: s && (s.parentElement.id || s.parentElement.className) };
    const sb = s.closest('.ph-sheet, .ph-sb').getBoundingClientRect();
    return { firstIsSeg: v.firstElementChild === s, ids: [...v.querySelectorAll('input, select')].map((i) => i.id),
      btns: [...s.children].map((b) => { const r = b.getBoundingClientRect(), n = b.querySelector('.sty-n'); return { w: r.width, h: r.height, in: r.left >= sb.left - 1 && r.right <= sb.right + 1, word: n && n.getClientRects().length > 0, broken: brokenWords(n) }; }) };
  })()`);
  ok(`${tag}: the Phase plane's Display sheet starts with the six styles, then its toggles`, sh && sh.firstIsSeg && sh.btns && sh.btns.length === 6 && ['outlineChk', 'unitChk'].every((id) => sh.ids.includes(id)), sh);
  ok(`${tag}: each style ≥ 44 × 44 px with its word, inside the sheet, none broken`, sh && sh.btns && sh.btns.every((b) => b.w >= 44 && b.h >= 44 && b.in && b.word && !b.broken.length), sh && sh.btns);
  await ev(`Phone.close(true)`); await settle(300);
}
// the tour's Phase key step where Y's head holds no toggle (they are merged into the pattern button's pop-up): the step
// is visited, not skipped as missing, and it lights the control that holds the key. The runners' wider fonts merged
// them at 1440 px, where the tour shard runs; here the step is run at four narrower widths with wider titles, and at
// one of them at least the key must be behind the pattern button, so the merged case is the one checked
{
  const runs = [];
  for (const w of [1280, 1180, 1100, 1024]) {
    await view(w, 800, false, false);
    await send('Page.navigate', { url: `${U}?ns=dinlkey${w}${Date.now() % 1000000}` }); await sleep(2500);
    await ev(`__cmwSetMain('xy'); 1`); await settle(1200);
    // (the runners' wider fonts, emulated: titles that need more room, so the toggles give way as they did there)
    await ev(`(() => { const st = document.createElement('style'); st.textContent = '.pane-title { letter-spacing: ${w > 1200 ? 4 : 2}px; }'; document.head.append(st); return 1; })()`); await settle(600);
    await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); Tour.start({ chapter: 'views' }); return 1; })()`); await settle(1500);
    const ids = [];
    let lit = null;
    for (let k = 0; k < 10 && (await ev('Tour.isActive()')); k++) {
      const c = await ev('Tour.current()');
      if (!c || c.chapter !== 'views') break;
      ids.push(c.id);
      if (c.id === 'key') lit = await ev(`(() => { const L = Tour.lit(), a = L && L.anchor, b = document.querySelector('#wKeyChkR'), k = b && document.body.contains(b) ? (b.closest('label') || b) : document.querySelector('#rightFoot .opts-btn:not(.pat-btn)') || document.querySelector('#rightFoot .pat-btn'), r = k && k.getBoundingClientRect(); return { a, k: r && { l: r.left, r: r.right }, pat: !!k && k.classList.contains('pat-btn') }; })()`);
      await ev('Tour.next(); 1'); await settle(900);
    }
    await ev('Tour.isActive() ? Tour.stop() : 0; 1'); await settle(300);
    runs.push({ w, ids, lit });
    ok(`${w} en X → Y: the tour visits the Phase key step (not skipped as missing)`, ids.includes('key'), ids);
    ok(`${w} en X → Y: the Phase key step lights the control that holds the key`, lit && lit.a && lit.k && Math.abs(lit.a.l - lit.k.l) < 2 && Math.abs(lit.a.r - lit.k.r) < 2, lit);
  }
  ok('the Phase key step was checked with the key behind the pattern button at one width at least', runs.some((r) => r.lit && r.lit.pat), runs.map((r) => [r.w, r.lit && r.lit.pat]));
}
await view(1440, 900, false, false);
return { pass: fails.length === 0, fails };
