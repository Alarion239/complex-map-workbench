// The Stack's open key at 320 px tall (568 x 320 and 600 x 320, in en, ru and it), a disc of a cubic's plane selected: part of the Stack
// picture shows beside the key (the plane's points whose topmost element is the picture's canvas); where the key reaches the readout, the
// readout gives way whole and is back once the key folds; and the key's marks take no more rows than in en (the Russian strand mark is short
// enough to stand in its row's room). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const SETTLE_MAX = 20000, SLACK = 0.5;
const M3 = [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }];
const tapAt = async (x, y) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const measure = () => ev(`(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
  const plot = document.getElementById('plotL'), k = plot.querySelector('.ld-key'), ro = document.getElementById('leftReadout'), p = r(plot);
  let n = 0, seen = 0, minX = Infinity, maxX = -Infinity;
  for (let x = p[0] + 4; x < p[2]; x += 8) for (let y = p[1] + 4; y < p[3]; y += 8) {
    n++; const e = document.elementFromPoint(x, y);
    if (e && e.tagName === 'CANVAS') { seen++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  }
  const its = [...k.querySelectorAll('.ld-it')], tops = [...new Set(its.map((e) => Math.round(e.getBoundingClientRect().top)))], rows = tops.length, boxes = its.map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), e.textContent]; });
  return { key: r(k), ro: ro && ro.getClientRects().length ? r(ro) : null, roVis: ro ? getComputedStyle(ro).visibility : '', plot: p, share: seen / n, seen, n, rows, boxes, hidden: Math.max(k.scrollHeight - k.clientHeight, k.scrollWidth - k.clientWidth), cls: k.className };
})()`);
const meets = (a, b) => !!a && !!b && a[0] < b[2] - SLACK && a[2] > b[0] + SLACK && a[1] < b[3] - SLACK && a[3] > b[1] + SLACK;
const rowsBy = {};
for (const [w, h, lang] of [[568, 320, 'en'], [568, 320, 'ru'], [568, 320, 'it'], [600, 320, 'en'], [600, 320, 'ru']]) {
  const tag = `${w}x${h} ${lang}`;
  await view(w, h, false, true);
  const ns = 'sks' + w + lang + (Date.now() % 1000000);
  await load(ns, { shapes: [{ id: 'd', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 }], steps: M3, srcView: { cx: 1.1, cy: 0, s: 70 } });
  await go(`${U}?ns=${ns}&view=steps&lang=${lang}`);
  await settled({ max: SETTLE_MAX, until: `typeof __cmwSteps === 'function' && !!window.Phone && Phone.isOn() && __cmwSteps().ready.ready` });
  await ev(`(__cmwSelect('d'), 1)`);
  await settled({ max: SETTLE_MAX, until: `typeof __cmwLookDown === 'function' && !!__cmwLookDown() && !!document.querySelector('.ph-ctx.in')` });
  await ev(`(__cmwSteps({ surf: 'stack' }), 1)`);
  await settled({ max: SETTLE_MAX, floor: 600, until: `__cmwSteps().surf === 'stack' && typeof __cmwStack === 'function' && !!__cmwStack().drawn` });
  const closed = await measure();
  await ev(`(document.querySelector('#plotL .ld-key > button.ld-ttl').click(), 1)`);
  await settled({ max: 5000, floor: 400, until: `document.querySelector('#plotL .ld-key > button.ld-ttl').getAttribute('aria-expanded') === 'true'` });
  const m = await measure();
  info[tag] = { closedShare: closed.share, openShare: m.share, key: m.key.map(Math.round), ro: m.ro && m.ro.map(Math.round), plot: m.plot.map(Math.round), roVis: m.roVis, rows: m.rows, boxes: m.boxes, cls: m.cls };
  ok(`${tag}: the Stack's key unfolded leaves part of the Stack picture in view beside it`, m.share >= 0.2, { share: m.share, closed: closed.share });
  // (where the open key reaches the readout, the readout gives way whole: hidden, not left half under the key)
  ok(`${tag}: the readout under the open key is hidden, not half covered`, !meets(m.key, m.ro) || m.roVis === 'hidden', { key: m.key, ro: m.ro, vis: m.roVis });
  rowsBy[tag] = m.rows;
  await ev(`(document.querySelector('#plotL .ld-key > button.ld-ttl').click(), 1)`);
  await settled({ max: 5000, floor: 400, until: `document.querySelector('#plotL .ld-key > button.ld-ttl').getAttribute('aria-expanded') === 'false'` });
  ok(`${tag}: the readout is back once the key folds`, (await measure()).roVis !== 'hidden', 0);
  if (lang !== 'en') ok(`${tag}: the key's marks take no more rows than in en`, m.rows <= rowsBy[`${w}x${h} en`], { rows: m.rows, en: rowsBy[`${w}x${h} en`] });
  ok(`${tag}: the Stack's key unfolded shows all it holds`, m.hidden <= 1, m.hidden);
}
return { pass: fails.length === 0, fails: fails.slice(0, 40), info };
