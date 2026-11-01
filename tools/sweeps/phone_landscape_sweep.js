const PORT = 8793;
const U = `http://localhost:${PORT}/test.html`;
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const CHAIN = [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'exp', params: {}, on: true }];
const MEASURE = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; for (let p = e; p; p = p.parentElement) { if (p.hidden) return false; const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden') return false; } return r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh; };
  const sel = 'button, a[href], input, select, textarea, summary, [role=button], [role=tab], [role=menuitem], [role=checkbox], [role=switch], [tabindex]:not([tabindex="-1"]), .tool, .card';
  const all = [...document.querySelectorAll(sel)].filter(vis);
  const name = (e) => (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') || e.tagName.toLowerCase();
  const txt = (e) => (e.getAttribute('aria-label') || e.title || e.textContent || e.value || '').trim().replace(/\\s+/g, ' ').slice(0, 28);
  const items = all.map((e) => { const r = e.getBoundingClientRect(); const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2)); const top = document.elementFromPoint(cx, cy); const covered = !!top && top !== e && !e.contains(top) && !top.contains(e); return { n: name(e), t: txt(e), l: Math.round(r.left), tp: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), covered, off: r.left < -1 || r.right > vw + 1 || r.bottom > vh + 1 }; });
  const small = items.filter((i) => (i.w < 44 || i.h < 44));
  const offs = items.filter((i) => i.off && i.w > 0);
  const overl = [];
  for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) { if (all[a].contains(all[b]) || all[b].contains(all[a])) continue; const A = all[a].getBoundingClientRect(), B = all[b].getBoundingClientRect(); const w = Math.min(A.right, B.right) - Math.max(A.left, B.left), h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top); if (w > 4 && h > 4) overl.push([items[a].n + ' "' + items[a].t + '"', items[b].n + ' "' + items[b].t + '"', Math.round(w) + 'x' + Math.round(h)]); }
  const clip = [...document.querySelectorAll('body *')].filter((e) => vis(e) && e.children.length === 0 && e.textContent.trim().length > 1).filter((e) => { const cs = getComputedStyle(e); return (e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible') || (e.scrollHeight > e.clientHeight + 2 && cs.overflowY !== 'visible' && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll'); }).map((e) => ({ n: name(e), t: e.textContent.trim().slice(0, 30), sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight }));
  const pageOver = document.documentElement.scrollWidth > vw + 1;
  return { n: all.length, small: small.map((i) => i.n + ' "' + i.t + '" ' + i.w + 'x' + i.h), covered: items.filter((i) => i.covered).map((i) => i.n + ' "' + i.t + '"'), offs: offs.map((i) => i.n + ' "' + i.t + '" ' + i.l + ',' + i.tp + ' ' + i.w + 'x' + i.h), overl: overl.slice(0, 12), clip: clip.slice(0, 10), pageOver };
})()`;
const out = {};
const W = (typeof SWEEPW !== 'undefined' && SWEEPW) || [[740, 360], [915, 412]];
const LANGS = ['en', 'ru', 'it'];
for (const [w, h] of W) for (const lang of LANGS) {
  const key = `${w}-${lang}`;
  const r = {};
  const fresh = async (st, ns) => { await view(w, h, false, true); await load(`au${w}${lang}${ns}${Date.now()}`, st); if (lang !== 'en') { const u = await ev('location.href'); await send('Page.navigate', { url: u + (u.includes('?') ? '&' : '?') + 'lang=' + lang }); await sleep(2500); } await settle(700); };
  // home: the default scene, one-step chain
  await fresh({ shapes: [], steps: [{ type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }] }, 'h');
  r.home = await ev(MEASURE); await shot(`${key}-home`);
  await fresh({ shapes: [], steps: CHAIN }, 'c');
  r.chain3 = await ev(MEASURE); await shot(`${key}-chain3`);
  for (const k of ['tools', 'display', 'more']) { await ev(`Phone.open('${k}')`); await settle(700); r['sheet-' + k] = await ev(MEASURE); await shot(`${key}-sheet-${k}`); await ev('Phone.close(true)'); await settle(300); }
  await ev(`Phone.open('edit')`); await settle(700); r['sheet-edit'] = await ev(MEASURE); await shot(`${key}-sheet-edit`); await ev('Phone.close(true)'); await settle(300);
  await ev(`Phone.open('chain')`); await settle(800); r['sheet-chain'] = await ev(MEASURE); await shot(`${key}-sheet-chain`); await ev('Phone.close(true)'); await settle(300);
  await ev(`Phone.open('edit', { params: true })`); await settle(700); r['sheet-numbers'] = await ev(MEASURE); await shot(`${key}-sheet-numbers`); await ev('Phone.close(true)'); await settle(300);
  out[key] = r;
}
return out;
