const POW5 = [{ type: 'custom', params: { expr: 'z^5', cut: 180 }, on: true }];
await loadS(POW5); await soundOn('land'); await ev(`Sound.set({ events: false }); __cmwSet('loop', true); 1`);
const b = await ev(`(() => { const r = document.elementFromPoint(400, 450).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
const p = [b[0] + b[2] * 0.42, b[1] + b[3] * 0.55]; await rest(p); await settle(1900); await takeL();
await recStart(); await act('m-open'); await key('m'); await sleep(3200); await act('m-close'); await key('m'); await sleep(1200);
const L = await takeL(); await recStop('v10');
return { cues: L.cue.map((c) => c[1]), sets: L.vs.length, glides: L.vs.filter((v) => v[3]).map((v) => v[3]) };
