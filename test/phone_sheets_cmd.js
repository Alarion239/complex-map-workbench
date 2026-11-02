// The phone's sheets in English, Russian and Italian at 360, 390 and 412 px (#251): a sheet's title is whole (it wraps to a
// second line before it is cut), the Tools sheet's grabber lies clear of its Snap pill, the Numbers sheet says its title once
// with its Tip in view, the planes' readouts are not cut (Russian's "w 2 / дел." in the right plane), and the Display
// sheet's regions show no pattern swatches (#363). A command file for a CDP daemon (test/cdp_kit README); prints
// { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ST = { shapes: [], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }] };
const open = async (w, h, lang, classic = false) => {
  const ns = `psh${w}${lang}-${Date.now()}`;
  await view(w, h, false, true);
  if (classic) {
    // (the state is written from a page of the origin that is not the app, so the app's first load is the classic view's; the kit's load() would open the steps view)
    await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
    await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(ST))}); 1`);
    await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=classic` });
  } else {
    await load(ns, ST);
    if (lang !== 'en') { const u = await ev('location.href'); await send('Page.navigate', { url: u + (u.includes('?') ? '&' : '?') + 'lang=' + lang }); }
  }
  for (let i = 0; i < 40; i++) { if (await ev(`document.documentElement.classList.contains('ph') && typeof Phone !== 'undefined'`)) break; await sleep(250); }
  await settle(900);
};
// (a read just after a layout change can come back empty on a slow runner: ask again before judging it)
const evr = async (expr) => { let v; for (let i = 0; i < 6; i++) { v = await ev(expr); if (v !== undefined && v !== null) return v; await sleep(400); } return v; };
const rect = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; })()`;
for (const [w, h] of [[360, 740], [390, 844], [412, 915]]) for (const lang of ['en', 'ru', 'it']) {
  const at = `${w} ${lang}`;
  await open(w, h, lang);
  ok(`${at}: the steps view is on`, await ev('typeof __cmwSteps === "function" && __cmwSteps().on'), null);
  // sheet titles whole: no text cut sideways or by the line clamp
  for (const k of ['tools', 'display', 'more']) {
    await ev(`Phone.open('${k}')`); await settle(700);
    const t = await evr(`(() => { const e = document.querySelector('.ph-sheet .ph-st'); return e && { text: e.textContent, sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight }; })()`);
    ok(`${at}: the ${k} sheet's title is whole`, t && t.text.length > 0 && t.sw <= t.cw + 1 && t.sh <= t.ch + 1, t);
    if (k === 'tools') {
      const g = await evr(rect('.ph-grab')), s = await evr(rect('.ph-pill.ph-snap'));
      ok(`${at}: the Tools sheet's grabber lies clear of the Snap pill`, g && s && (g.b <= s.t + 0.5 || g.r <= s.l + 0.5 || g.l >= s.r - 0.5), { g, s });
      // the Snap pill, undo and close keep 44 px targets
      const small = await evr(`[...document.querySelectorAll('.ph-sheet .ph-sh button')].filter((e) => e.getClientRects().length && getComputedStyle(e).pointerEvents !== 'none').map((e) => { const b = e.getBoundingClientRect(); return [e.className, Math.round(b.width), Math.round(b.height)]; }).filter((x) => x[1] < 44 || x[2] < 44)`);
      ok(`${at}: the Tools sheet's head buttons are 44 px`, small.length === 0, small);
    }
    await ev('Phone.close(true)'); await settle(300);
  }
  // the readout of the one plane, with a sheet open
  await ev(`Phone.open('tools')`); await settle(700);
  const ro = await evr(`['leftReadout'].map((id) => { const e = document.getElementById(id); return e && e.getClientRects().length && / \\/ /.test(e.textContent) ? [id, e.scrollWidth, e.clientWidth] : null; }).filter(Boolean)`);   // (the plane's scale readout, "2 / div": the first-run hint's longer text has no " / " and is not read)
  ok(`${at}: the plane's readout is not cut`, ro.length > 0 && ro.every((r) => r[1] <= r[2] + 1), ro);
  await ev('Phone.close(true)'); await settle(300);
  // the Edit sheet's head row: the step's name is level with the f₂ chip beside it (it sat at the top of its 44 px button)
  await ev(`Phone.open('edit')`); await settle(800);
  const lv = await evr(`(() => { const h = document.querySelector('.ph-sheet .insp-step .ihead'); const t = h && h.querySelector('.ttl-btn'), i = h && h.querySelector('.idx'); if (!t || !i || !t.firstChild) return null; const r = document.createRange(); r.selectNodeContents(t.firstChild); const a = r.getBoundingClientRect(), b = i.getBoundingClientRect(); return { text: (a.top + a.bottom) / 2, chip: (b.top + b.bottom) / 2 }; })()`);
  ok(`${at}: the Edit sheet's step name is level with its chip`, lv && Math.abs(lv.text - lv.chip) <= 3, lv);
  await ev('Phone.close(true)'); await settle(300);
  // the Numbers sheet: its title once, its Tip in view
  await ev(`Phone.open('edit', { params: true })`); await settle(800);
  const n = await evr(`(() => { const sh = document.querySelector('.ph-sheet'), sb = sh.querySelector('.ph-sb:not([hidden])').getBoundingClientRect(), tip = sh.querySelector('.ph-tip'), tb = tip && tip.getBoundingClientRect(); const heads = [...sh.querySelectorAll('h2')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()); return { title: sh.querySelector('.ph-st').textContent, heads, tipIn: !!tb && tb.top >= sb.top && tb.bottom <= sb.bottom + 1, tip: tb && [Math.round(tb.top), Math.round(tb.bottom)], sb: [Math.round(sb.top), Math.round(sb.bottom)] }; })()`);
  ok(`${at}: the Numbers sheet says its title once`, n.title.length > 0 && !n.heads.includes(n.title), n);
  ok(`${at}: the Numbers sheet's Tip is in view`, n.tipIn, n);
  await ev('Phone.close(true)'); await settle(300);
}
// the Display sheet's regions (#363): the steps view's Display sheet has no regions' display (the X → Y view's Regions box), so this half opens the classic view
for (const [w, h] of [[360, 740], [390, 844], [412, 915]]) for (const lang of ['en', 'ru', 'it']) {
  const at = `${w} ${lang} classic`;
  await open(w, h, lang, true);
  await ev(`Phone.open('display')`); await settle(700);
  const rg = await evr(`(() => { const b = document.querySelector('.ph-sheet #regionsBox'); if (!b || !b.getClientRects().length) return null; const cut = [...b.querySelectorAll('.check > span, .fl, .lbl')].filter((e) => e.getClientRects().length && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)).map((e) => e.textContent); return { swatches: b.querySelectorAll('#patternSeg, .pat, canvas').length, lines: !!b.querySelector('#linesChk'), cut }; })()`);
  ok(`${at}: the Display sheet's regions: grid lines, no pattern swatches, no label cut`, rg && rg.swatches === 0 && rg.lines && rg.cut.length === 0, rg);
  await ev('Phone.close(true)'); await settle(300);
}
return { pass: fails.length === 0, fails, info };
