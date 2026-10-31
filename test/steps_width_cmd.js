// The steps view's plane stays in its column (#497, behind ?view=steps): with a long chain the thread under the plane
// fits or scrolls its own steps, and never widens the pane. With 3 and 5 steps, on a phone (360, 390) and a laptop
// (1024, 1440), in en and ru:
// - the pane's right edge is inside its column (the page, or the stage beside the right panel), and the page does not
//   scroll sideways;
// - › and the plane's own controls (the phone's keys; the laptop's zoom stack, colour key and speed) are what
//   elementFromPoint finds at their centres.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ns = 'svw' + Date.now();
const MOB = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, CUBE = { type: 'pown', params: { n: 3 }, on: true }, SIN = { type: 'sin', params: {}, on: true };
const CHAINS = { 3: [MOB, CUBE, SIN], 5: [MOB, CUBE, SIN, CUBE, MOB] };
const open = async (w, h, mobile, lang, n) => {
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'h1', kind: 'halfplane', a: [0, 0], b: [1, 0], ci: 0, visible: true }], steps: CHAINS[n], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
  await view(w, h, false, mobile);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  const k = `${ns}${w}${lang}${n}`;
  await ev(`localStorage.setItem('complex-map-workbench-v1:${k}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${k}&lang=${lang}&view=steps` }); await sleep(2500); await settle(600);
};
// (what the page shows at the centre of each control that is shown: the control itself, or the thing covering it)
const probe = () => ev(`(() => {
  const ph = document.documentElement.classList.contains('ph'), pane = document.getElementById('paneL').getBoundingClientRect();
  const props = document.getElementById('propsPanel'), pr = props && props.getClientRects().length ? props.getBoundingClientRect() : null;
  const col = Math.min(document.documentElement.clientWidth, pr && pr.left > pane.left ? pr.left : Infinity);
  const sel = ph ? ['#svStrip .sv-next', '#svStrip .sv-prev', '#paneL .ph-sph', '#paneL .ph-dsp'] : ['#svStrip .sv-next', '#svStrip .sv-prev', '#svStrip .sv-speed', '#paneL .viewstack button', '#leftLegend'];
  const hit = {};
  for (const q of sel) {
    const el = document.querySelector(q);
    if (!el || !el.getClientRects().length) { hit[q] = 'missing'; continue; }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, at = document.elementFromPoint(x, y);
    hit[q] = at && (at === el || el.contains(at)) ? true : { x: Math.round(x), y: Math.round(y), at: at ? (at.id || at.className || at.tagName) : null };
  }
  return { paneR: Math.round(pane.right), col: Math.round(col), pageW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth, hit };
})()`);
for (const [w, h, mobile] of [[360, 780, true], [390, 844, true], [1024, 768, false], [1440, 900, false]]) {
  for (const lang of ['en', 'ru']) {
    for (const n of [3, 5]) {
      await open(w, h, mobile, lang, n);
      const p = await probe(), tag = `${w} ${lang} ${n} steps`;
      info[tag] = { paneR: p.paneR, col: p.col };
      ok(`${tag}: the plane stays in its column`, p.paneR <= p.col + 1, p);
      ok(`${tag}: the page does not scroll sideways`, p.pageW <= p.vw + 1, p);
      for (const [q, v] of Object.entries(p.hit)) ok(`${tag}: ${q} is shown and on top at its centre`, v === true, v);
    }
  }
}
info.checks = 'steps view: the plane in its column with 3 and 5 steps, phone 360/390 and desk 1024/1440, en and ru';
return { pass: fails.length === 0, fails, info };
