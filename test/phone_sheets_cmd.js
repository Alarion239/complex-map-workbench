// The phone's sheets in English, Russian and Italian at 360, 390 and 412 px (#251): a sheet's title is whole (it wraps to a
// second line before it is cut), the Tools sheet's grabber lies clear of its Snap pill, the Numbers sheet says its title once
// with its Tip in view, the planes' readouts are not cut (Russian's "w 2 / дел." in the right plane), and the Display
// sheet's pattern names wrap between words (#339). A command file for a CDP daemon (test/cdp_kit README); prints
// { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ST = { shapes: [], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }] };
const open = async (w, h, lang) => {
  await view(w, h, false, true); await load(`psh${w}${lang}-${Date.now()}`, ST);
  if (lang !== 'en') { const u = await ev('location.href'); await send('Page.navigate', { url: u + (u.includes('?') ? '&' : '?') + 'lang=' + lang }); }
  for (let i = 0; i < 40; i++) { if (await ev(`document.documentElement.classList.contains('ph') && typeof Phone !== 'undefined'`)) break; await sleep(250); }
  await settle(900);
};
// (a read just after a layout change can come back empty on a slow runner: ask again before judging it)
const evr = async (expr) => { let v; for (let i = 0; i < 6; i++) { v = await ev(expr); if (v !== undefined && v !== null) return v; await sleep(400); } return v; };
const rect = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; })()`;
for (const [w, h] of [[360, 740], [390, 844], [412, 915]]) for (const lang of ['en', 'ru', 'it']) {
  const at = `${w} ${lang}`;
  await open(w, h, lang);
  // sheet titles whole: no text cut sideways or by the line clamp
  for (const k of ['tools', 'display', 'more']) {
    await ev(`Phone.open('${k}')`); await settle(700);
    const t = await evr(`(() => { const e = document.querySelector('.ph-sheet .ph-st'); return e && { text: e.textContent, sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight }; })()`);
    ok(`${at}: the ${k} sheet's title is whole`, t && t.text.length > 0 && t.sw <= t.cw + 1 && t.sh <= t.ch + 1, t);
    if (k === 'display') {
      // (#339) a pattern's name breaks between its words, not inside one: each word lies on one line ("Растяжение" was
      // hyphenated at the 52 px swatch's width), and no name is cut by the two-line clamp
      const pw = await evr(`(() => { const ls = [...document.querySelectorAll('.ph-sheet .patterns .pat > span')].filter((e) => e.getClientRects().length); if (!ls.length) return null; const bad = []; for (const l of ls) { const tn = l.firstChild; if (!tn || tn.nodeType !== 3) continue; const re = /\\S+/g; let m; while ((m = re.exec(tn.data))) { const r = document.createRange(); r.setStart(tn, m.index); r.setEnd(tn, m.index + m[0].length); const tops = new Set([...r.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top))); if (tops.size > 1) bad.push([m[0], 'split']); } if (l.scrollHeight > l.clientHeight + 1) bad.push([l.textContent, 'clamped']); } return { n: ls.length, bad }; })()`);
      ok(`${at}: the Display sheet's pattern names break between words, none cut`, pw && pw.n > 0 && pw.bad.length === 0, pw);
    }
    if (k === 'tools') {
      const g = await evr(rect('.ph-grab')), s = await evr(rect('.ph-pill.ph-snap'));
      ok(`${at}: the Tools sheet's grabber lies clear of the Snap pill`, g && s && (g.b <= s.t + 0.5 || g.r <= s.l + 0.5 || g.l >= s.r - 0.5), { g, s });
      // the Snap pill, undo and close keep 44 px targets
      const small = await evr(`[...document.querySelectorAll('.ph-sheet .ph-sh button')].filter((e) => e.getClientRects().length && getComputedStyle(e).pointerEvents !== 'none').map((e) => { const b = e.getBoundingClientRect(); return [e.className, Math.round(b.width), Math.round(b.height)]; }).filter((x) => x[1] < 44 || x[2] < 44)`);
      ok(`${at}: the Tools sheet's head buttons are 44 px`, small.length === 0, small);
    }
    await ev('Phone.close(true)'); await settle(300);
  }
  // the readouts, in the two-plane view an open sheet gives
  await ev(`Phone.open('tools')`); await settle(700);
  const ro = await evr(`['rightReadout'].map((id) => { const e = document.getElementById(id); return e && e.getClientRects().length && / \\/ /.test(e.textContent) ? [id, e.scrollWidth, e.clientWidth] : null; }).filter(Boolean)`);   // (the right plane's scale readout, "w 2 / div": the left one carries the first-run hint's longer text, cut by design)
  ok(`${at}: the right plane's readout is not cut`, ro.length > 0 && ro.every((r) => r[1] <= r[2] + 1), ro);
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
return { pass: fails.length === 0, fails, info };
