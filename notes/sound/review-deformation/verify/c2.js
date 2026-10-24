const th = 170 * Math.PI / 180, Z = [1.2 * Math.cos(th), 1.2 * Math.sin(th)];
// F: X -> Y ('xy'): pointer rests on X, M merges the panes
await loadS([{ type: 'custom', params: { expr: 'z^5', cut: 180 }, on: true }]);
await soundOn(null);
OUT.view0 = await ev('__cmwLayout()');
let p = await W('L', ...Z); await rest(p); await settle(1900); await takeL();
await recStart(); await act('m'); await key('m'); await sleep(1000);
const s1 = await S_(); const L1 = await takeL();
OUT.F = { layout: await ev('__cmwLayout()'), setsFirstSecond: L1.vs.length, fcN: s1.fcN, rest: s1.rest, cues: cueNames(L1) };
await act('jiggle'); await move(p[0] + 1, p[1]); await sleep(1600);
const s2 = await S_(); const L2 = await takeL(); await recStop('v2F');
OUT.F.afterMove = { sets: L2.vs.length, rest: s2.rest, run: s2.run, cues: cueNames(L2) };
await key('m'); await settle(1500);
// G: Phase view, click on the plane (no move after), then M
await ev(`__cmwSetMain('phase')`); await settle(900);
p = await W('L', ...Z); await rest(p); await settle(1900);
await click(p[0], p[1]); await settle(600); await takeL();
await key('m'); await sleep(2000);
const sG = await S_(); const LG = await takeL();
OUT.G = { sets: LG.vs.length, rest: sG.rest, fcN: sG.fcN, cues: cueNames(LG), st: await ST() };
await key('m'); await settle(1500);
return OUT;
