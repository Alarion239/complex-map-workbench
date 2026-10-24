await loadS([{ type: 'custom', params: { expr: 'z^2', cut: 180 }, on: true }], { shapes: [{ id: 1, kind: 'disk', cx: 0.6, cy: 0.5, r: 0.35, visible: true }] });
await soundOn(null);
await ev(`__cmwMorph({ open: true }); __cmwMorph({ playing: false }); __cmwMorph({ T: 0.6 }); 1`); await sleep(1500);
const b = await ev(`(() => { const p = __cmwW2S('R', 0.6, 0.5); return p; })()`);
await move(b[0] + 2, b[1]); await sleep(60); await move(b[0], b[1]); await sleep(400);
const f = await shot('v9_merged_t06');
const ro = await ev(`(() => { const el = document.querySelector('#readouts, .readouts, #readout'); return el ? el.textContent.slice(0, 300) : [...document.querySelectorAll('[id*=ead]')].map((e) => e.id + ':' + e.textContent.slice(0, 80)).join(' | '); })()`);
return { f, ro, s: await S_(), hAt: await ev(`__cmwSound({ hAt: [0.6, 0.6, 0.5] })`) };
