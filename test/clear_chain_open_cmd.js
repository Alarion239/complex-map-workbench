// "Clear chain" never leaves the chain head while the Inspector floats in (#566, from #540). At 1024 × 768 in the classic view,
// in en, ru and it: opening the Inspector (a step card clicked) makes it float over the stage, first drawn off the right edge
// and moved in a render later. Every animation frame (and a 16 ms timer) for 6 s after the click, the head's and the button's rectangles are
// sampled: the button is inside the head (within a pixel) and the head holds its content (no scroll width past its box) in
// every frame, and the page settles to the same at the end. A command file for a CDP daemon (test/cdp_kit README); prints
// { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
for (const lang of ['en', 'ru', 'it']) {
  await view(1024, 768, false, false);
  await nav(`http://localhost:${PORT}/test.html?ns=clrchain-${lang}-${Date.now()}&lang=${lang}`); await settle(3000);
  const has = await ev(`!!document.querySelector('#pipeline .ftile') && !!document.getElementById('clearChain') && !document.getElementById('clearChain').hidden`);
  ok(`${lang}: the start chain has a step and a Clear chain button`, has, has);
  if (!has) continue;
  // (the sampler: from the click, every frame for 2 s)
  await ev(`window.__cc = null; (() => {
    const out = [], t0 = performance.now(), head = document.querySelector('.pipe-head'), btn = document.getElementById('clearChain');
    const sample = () => {
      const t = performance.now() - t0, h = head.getBoundingClientRect(), b = btn.getBoundingClientRect(), shown = btn.getClientRects().length > 0;
      const p = document.getElementById('propsPanel'), pb = p && p.getClientRects().length ? p.getBoundingClientRect() : null;
      out.push({ t: Math.round(t), shown, outside: shown && (b.left < h.left - 1 || b.right > h.right + 1 || b.top < h.top - 1 || b.bottom > h.bottom + 1), over: head.scrollWidth - head.clientWidth, hr: Math.round(h.right), br: Math.round(b.right), panel: pb ? Math.round(pb.left) + '..' + Math.round(pb.right) : null, notitle: head.classList.contains('notitle') });
      if (t < 6000) { requestAnimationFrame(sample); } else window.__cc = out;
    };
    document.querySelector('#pipeline .ftile').click();
    requestAnimationFrame(sample);
    const iv = setInterval(() => { if (window.__cc) clearInterval(iv); else if (performance.now() - t0 < 6000) sample0(); }, 16);
    function sample0() { const t = performance.now() - t0, h = head.getBoundingClientRect(), b = btn.getBoundingClientRect(), shown = btn.getClientRects().length > 0; out.push({ t: Math.round(t), shown, outside: shown && (b.left < h.left - 1 || b.right > h.right + 1 || b.top < h.top - 1 || b.bottom > h.bottom + 1), over: head.scrollWidth - head.clientWidth, hr: Math.round(h.right), br: Math.round(b.right), panel: null, notitle: head.classList.contains('notitle'), src: 'timer' }); }
  })(); 1`);
  let s = null;
  for (let i = 0; i < 120 && !(s = await ev('window.__cc')); i++) await sleep(100);
  ok(`${lang}: the sampler finished`, !!s, null);
  if (!s) continue;
  const bad = s.filter((f) => f.outside || f.over > 1);
  info[lang] = { frames: s.length, badFrames: bad.length, firstBad: bad[0] || null, lastBadT: bad.length ? bad[bad.length - 1].t : null, last: s[s.length - 1], timeline: s.filter((f, i) => i % 8 === 0).map((f) => [f.t, f.outside ? 1 : 0, f.over, f.hr, f.br, f.notitle ? 1 : 0]) };
  ok(`${lang}: the button is inside the head in every frame of the open (${bad.length} of ${s.length} frames are not)`, bad.length === 0, { first: bad[0], last: bad[bad.length - 1] });
  const end = s[s.length - 1];
  ok(`${lang}: at the end the head holds its controls`, !end.outside && end.over <= 1, end);
  // (and its heading is whole or hidden, never a cut word)
  const t = await ev(`(() => { const h = document.querySelector('.pipe-head'), t = h.querySelector(':scope > h2'), r = t.getBoundingClientRect(); return { hidden: h.classList.contains('notitle'), cut: t.scrollWidth - t.clientWidth, w: Math.round(r.width) }; })()`);
  ok(`${lang}: the heading is whole or hidden at the end`, t.hidden || t.cut <= 1, t);
}
return { pass: fails.length === 0, fails, info };
