// the re-pick's point vs the point a pointer event at the same client position gives
const th = 170 * Math.PI / 180, Z = [1.2 * Math.cos(th), 1.2 * Math.sin(th)];
const r = {};
await loadS([{ type: 'custom', params: { expr: 'z^5', cut: 180 }, on: true }]);
await soundOn('phase');
const p = await W('L', ...Z); await rest(p); await settle(1900);
const same = async () => { await move(p[0], p[1]); await settle(300); return (await S_()).rest; };
const d = (a, b) => a && b ? +(Math.hypot(a.z[0] - b.z[0], a.z[1] - b.z[1]) * 120).toFixed(1) : null;
// 1. transport open (Phase main: no merge), then close, pointer still
await key('m'); await sleep(2200); const rOpen = (await S_()).rest; const eOpen = await same(); r.open = { repick: rOpen, event: eOpen, px: d(rOpen, eOpen) };
await key('m'); await sleep(1200); const rClose = (await S_()).rest; const eClose = await same(); r.close = { repick: rClose, event: eClose, px: d(rClose, eClose) };
// 2. Landscape -> Phase
await ev(`__cmwSetMain('land')`); await sleep(1200); const rLand = (await S_()).rest; const eLand = await same(); r.land = { repick: rLand, event: eLand, px: d(rLand, eLand) };
await ev(`__cmwSetMain('phase')`); await sleep(1200); const rPh = (await S_()).rest; const ePh = await same(); r.phase = { repick: rPh, event: ePh, px: d(rPh, ePh) };
// 3. Phase -> X -> Y (two panes)
await ev(`__cmwSetMain('xy')`); await sleep(1200); const rXY = (await S_()).rest; const eXY = await same(); r.xy = { repick: rXY, event: eXY, px: d(rXY, eXY) };
return r;
