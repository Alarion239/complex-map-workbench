// A landscape phone is a landscape phone whatever its width (#295): src/phone.js sync() gives :root.ph.ph-land to every
// coarse-pointer landscape viewport at most 500 px tall and below 1024 px wide, 568 to 767 px included (they took the portrait
// layout: 184 of 360 px for the planes, a sheet showing only its head). Portrait phones keep :root.ph without ph-land.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ST = { shapes: [], steps: [{ type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }] };
const probe = () => ev(`(() => { const r = document.documentElement, q = (id) => { const e = document.getElementById(id); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }; }; return { ph: r.classList.contains('ph'), land: r.classList.contains('ph-land'), iw: innerWidth, ih: innerHeight, L: q('paneL'), R: q('paneR') }; })()`);
// (the phone layout is entered once the app has initialised, which a slow runner takes a while over: wait for it, then probe)
const waitPh = async () => { for (let i = 0; i < 40; i++) { if (await ev(`document.documentElement.classList.contains('ph')`)) break; await sleep(250); } await settle(600); };
const open = async (w, h) => { await view(w, h, false, true); await load('pl' + w + 'x' + h + '-' + Date.now(), ST); await waitPh(); };

// landscape phones, below and above 768 px: the landscape layout
for (const [w, h] of [[740, 360], [667, 375], [736, 414], [568, 320], [812, 375]]) {
  await open(w, h);
  const p = await probe(); info[`${w}x${h}`] = p;
  ok(`${w}×${h}: a landscape phone gets ph-land`, p.ph && p.land, p);
  // the planes side by side, each most of the height under the top bar
  ok(`${w}×${h}: the planes sit side by side`, p.L && p.R && p.R.l >= p.L.r - 2 && Math.abs(p.L.t - p.R.t) <= 2, p);
  ok(`${w}×${h}: the planes have at least 60 % of the height`, p.L && (p.L.b - p.L.t) >= 0.6 * h, p);
  // a sheet opens beside them, with its content on screen
  await ev(`Phone.open('tools')`); await settle(800);
  const sh = await ev(`(() => { const e = document.querySelector('.ph-sheet .ph-sb:not([hidden])'); const b = e && e.getBoundingClientRect(); return b && { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), h: Math.round(b.height) }; })()`);
  ok(`${w}×${h}: an open sheet shows its content (at least 100 px of it, inside the screen)`, sh && sh.h >= 100 && sh.b <= h + 1 && sh.r <= w + 1, sh);
  await ev('Phone.close(true)'); await settle(300);
}
// portrait phones: ph, not ph-land
for (const [w, h] of [[360, 740], [390, 844], [412, 915], [320, 568]]) {
  await open(w, h);
  const p = await probe();
  ok(`${w}×${h}: a portrait phone has ph and no ph-land`, p.ph && !p.land, p);
}
// [#348] the panel's sections follow the phone layout, not a 767 px query: on a phone a summary is a toggle and a Tab stop
// and a closed section stays closed; off it every section is open and its summary is a heading (tabindex -1)
// (ev does not wait for a promise: the probe leaves its answer on window, and the check polls for it)
const secs = async () => {
  await ev(`window.__sec = null; (async () => { const ds = [...document.querySelectorAll('details.psec')]; const d = ds[0]; if (!d) { window.__sec = { n: 0 }; return; }
    const s = d.querySelector(':scope > summary'); const tab = s.getAttribute('tabindex'); d.open = false;
    await new Promise((r) => setTimeout(r, 120)); const closed = !d.open; d.open = true; await new Promise((r) => setTimeout(r, 60));
    window.__sec = { n: ds.length, tab, closed, heads: ds.filter((x) => { const q = x.querySelector(':scope > summary'); return q && q.getAttribute('tabindex') === '-1'; }).length }; })(), 1`);
  for (let i = 0; i < 20; i++) { await sleep(100); const r = await ev('window.__sec'); if (r) return r; }
  return null;
};
for (const [w, h] of [[812, 375], [915, 412], [740, 360]]) {
  await open(w, h);
  const q = await secs(); info[`sec${w}x${h}`] = q;
  ok(`${w}×${h}: the panel sections are a phone's (a toggle and a Tab stop, a closed one stays closed)`, q && q.n > 0 && q.heads === 0 && q.tab !== '-1' && q.closed, q);
}
// a rotation keeps them a phone's: 375×812 to 812×375 and back
await open(375, 812);
await view(812, 375, false, true); await settle(900);
const rot = await secs(); info.secRot = rot;
ok('375×812 turned to 812×375: the sections stay a phone\'s', rot && rot.heads === 0 && rot.closed, rot);
await view(375, 812, false, true); await settle(900);
const back = await secs();
ok('… and back to 375×812', back && back.heads === 0 && back.closed, back);
// [#462] the right-hand tool column takes the whole height, the header and the tour's strip end where it begins, and nothing
// in it is under anything else: every control of the header, the tour strip (the × included) and the column answers
// elementFromPoint at its centre, and More's label sits under its dots; in the default view and in ?view=steps
for (const [w, h] of [[740, 360], [915, 412]]) {
  for (const v of ['', '&view=steps']) {
    await view(w, h, false, true); await load('pc' + w + v.length + '-' + Date.now(), ST);
    if (v) { await send('Page.navigate', { url: `${U}?ns=pcs${w}-${Date.now()}${v}` }); }
    await waitPh();
    await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); Tour.start({ chapter: 'basics' }); return 1; })()`); await settle(1800);
    const g = await ev(`(() => { const hit = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((e) => { const q = e.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2, t = document.elementFromPoint(x, y); return { sel, x: Math.round(x), y: Math.round(y), ok: !!t && (t === e || e.contains(t)) }; });
      const col = document.getElementById('secDraw').getBoundingClientRect(), sm = document.querySelector('#secDraw > .tool-more > summary'), sl = sm.querySelector('.ic-slot').getBoundingClientRect(), lb = sm.querySelector('.tm-label').getBoundingClientRect();
      return { col: [Math.round(col.left), Math.round(col.top), Math.round(col.right), Math.round(col.bottom)], vw: innerWidth, vh: innerHeight, more: [Math.round(sl.bottom), Math.round(lb.top)],
        hits: [].concat(hit('#hdrMoreBtn'), hit('#viewSwitch > button'), hit('.tour-strip .ts-x'), hit('.tour-strip .ts-next'), hit('#secDraw .tool'), hit('#secDraw > .tool-more > summary'), hit('#secDraw > .ph-undo')) }; })()`);
    const tag = `${w}×${h}${v ? ' steps' : ''}`;
    info['col' + tag] = g;
    ok(`${tag}: the tool column runs the whole height (top to bottom of the screen)`, g.col[1] <= 1 && g.col[3] >= h - 1 && g.col[2] >= w - 1, g.col);
    ok(`${tag}: the tour's × is on the strip (and the strip's controls are found)`, g.hits.some((x) => x.sel === '.tour-strip .ts-x'), g.hits);
    const bad = g.hits.filter((x) => !x.ok);
    ok(`${tag}: every control of the header, the tour strip and the column is what is under its centre`, !bad.length, bad);
    ok(`${tag}: More's label is under its dots, not beside them`, g.more[1] >= g.more[0] - 2, g.more);
    await ev('Tour.stop(), 1'); await settle(400);
  }
}
// a laptop-sized window below 768 px with a mouse (no coarse pointer) keeps the portrait layout, and 1024 px wide is no phone
await view(700, 360, false, false); await load('plm' + Date.now(), ST); await settle(1200);
const m = await probe(); ok('700×360 with a mouse: ph, no ph-land (not a phone landscape)', m.ph && !m.land, m);
await view(1280, 800, false, false); await load('pld' + Date.now(), ST); await settle(1200);
const d = await probe(); ok('1280×800: no phone layout', !d.ph && !d.land, d);
const dq = await secs(); info.sec1280 = dq;
ok('1280×800: the panel sections are always open, their summaries headings', dq && dq.n > 0 && dq.heads === dq.n && !dq.closed, dq);
return { pass: fails.length === 0, fails, info };
