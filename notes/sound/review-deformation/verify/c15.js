// Esc, then a layout change with the pointer still: does the tone stay stopped "until the pointer moves"?
const th = 170 * Math.PI / 180, Z = [1.2 * Math.cos(th), 1.2 * Math.sin(th)];
const r = {};
await loadS([{ type: 'custom', params: { expr: 'z^5', cut: 180 }, on: true }]);
await soundOn('phase');
let p = await W('L', ...Z); await rest(p); await settle(1900); await takeL();
// a) Esc mid-play, wait for the end, then M closes the transport (pointer never moves)
await recStart(); await act('m'); await key('m'); await sleep(700); await act('esc'); await key('Escape'); const tEsc = await ev('performance.now()');
await sleep(1800); await act('m-close'); const tClose = await ev('performance.now()'); await key('m'); await sleep(1200);
let L = await takeL(); await recStop('v15a');
r.a = { setsEscToClose: L.vs.filter((v) => v[0] > tEsc && v[0] < tClose).length, setsAfterClose: L.vs.filter((v) => v[0] > tClose).length,
  gatesAfterClose: L.gate.filter((g) => g[0] > tClose).map((g) => [Math.round(g[0] - tClose), g[1]]).slice(0, 4), rest: (await S_()).rest };
// b) Esc while resting (no transport), then a view switch Phase -> Landscape
await move(p[0] + 4, p[1]); await sleep(60); await move(p[0], p[1]); await settle(600); await takeL();
await key('Escape'); const tE2 = await ev('performance.now()'); await sleep(400);
await ev(`__cmwSetMain('land')`); await sleep(1200);
L = await takeL(); r.b = { setsAfterEsc: L.vs.filter((v) => v[0] > tE2).length, gatesOn: L.gate.filter((g) => g[0] > tE2 && g[1]).length, rest: (await S_()).rest, cues: cueNames(L) };
await ev(`__cmwSetMain('phase')`); await sleep(600);
return r;
