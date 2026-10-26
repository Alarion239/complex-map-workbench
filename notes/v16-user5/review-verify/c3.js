const BASE = 'http://localhost:9709/';
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const out = {}; const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error' || /\[tour\]/.test(x.m || '')) && !/Failed to load resource/.test(x.m || ''))); };
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const setView = async (w, h, dark, phone) => { await view(w, h, dark, phone); await send('Emulation.setUserAgentOverride', phone ? { userAgent: ANDROID, platform: 'Android' } : { userAgent: '' }); };
const want = [['edit', 'cards'], ['analysis', 'cauchy'], ['branches', 'sheets']];
for (const [w, h, dark, phone, lang] of [[1440, 900, false, false, ''], [390, 844, true, true, 'ru'], [1024, 700, false, true, '']]) {
  await setView(w, h, dark, phone);
  const ns = `vt${w}${lang}${Date.now()}`;
  await nav(`${BASE}test.html?ns=${ns}${lang ? '&lang=' + lang : ''}`); await settle(1800);
  await ev('Tour.dismissSuggestion()');
  // compact chain first (Names), to test the cards step makes pictures show
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(Names|Имена)$/.test(x.textContent.trim())); if (b) b.click(); return !!b; })()`); await settle(400);
  const pre = await ev('__cmwCards()');
  for (const [ch, id] of want) {
    const si = await ev(`Tour._t.CHAPTERS.find((c) => c.id === '${ch}').steps.findIndex((s) => s.id === '${id}')`);
    await ev(`Tour.start({ chapter: '${ch}', step: ${si} })`); await settle(2500);
    const cur = await ev('Tour.current()');
    const r = await ev(`(() => { const L = Tour.lit(); const body = document.querySelector('.tour-body'); const holes = L ? L.holes : [];
      const els = holes.map((h) => { const e = document.elementsFromPoint((h.l + h.r) / 2, (h.t + h.b) / 2).filter((x) => !x.closest('.tour-root'))[0]; return e ? (e.id || e.className || e.tagName).toString().slice(0, 60) : null; });
      const cards = [...document.querySelectorAll('.card canvas')].filter((c) => { const b = c.getBoundingClientRect(); return b.width > 20 && b.height > 20; }).length;
      return { body: body ? body.textContent.trim() : null, holes: holes.map((h) => [h.l, h.t, h.r, h.b].map(Math.round)), els, cards, anchor: L && L.anchor ? [L.anchor.l, L.anchor.t, L.anchor.r, L.anchor.b].map(Math.round) : null }; })()`);
    out[`${w}${lang}:${ch}/${id}`] = Object.assign({ cur }, r);
    await shot(`vt-${w}${lang}-${id}`);
    await ev('Tour.stop()'); await settle(800);
  }
  out[`${w}${lang}:cardsPre`] = pre && { kind: pre.kind, n: pre.cards && pre.cards.length };
  out[`${w}${lang}:cardsAfter`] = await ev('(() => { const c = __cmwCards(); return { kind: c.kind, n: c.cards && c.cards.length }; })()');
  // Help text for All sheets
  out[`${w}${lang}:help`] = await ev(`(() => { const s = [...document.querySelectorAll('p')].map((p) => p.textContent).filter((t) => /All sheets|Все листы/.test(t)); return s.map((t) => t.slice(t.search(/All sheets|Все листы/) - 40, t.search(/All sheets|Все листы/) + 260)); })()`);
  await grab();
}
await setView(1440, 900, false, false);
out.errs = errs;
return out;
