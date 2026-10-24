// view switch re-pick: does the rest come back to the point under the pointer?
const th = 170 * Math.PI / 180, Z = [1.2 * Math.cos(th), 1.2 * Math.sin(th)];
await loadS([{ type: 'custom', params: { expr: 'z^5', cut: 180 }, on: true }]);
await soundOn('phase');
const p = await W('L', ...Z); await rest(p); await settle(1900); await takeL();
const r = { p, rest0: (await S_()).rest };
// static: no transport
await ev(`__cmwSetMain('land')`); await sleep(700); r.landRest = (await S_()).rest;
await ev(`__cmwSetMain('phase')`); await sleep(1200); const s1 = await S_(); r.backRest = s1.rest; r.backScr = s1.rest ? await W('L', s1.rest.z[0], s1.rest.z[1]) : null;
r.elAt = await ev(`(() => { const e = document.elementFromPoint(${p[0]}, ${p[1]}); return e.id || e.tagName; })()`);
r.layout = await ev('__cmwLayout()');
// during a play
await key('m'); await sleep(600); await ev(`__cmwSetMain('land')`); await sleep(700); await ev(`__cmwSetMain('phase')`); await sleep(1500);
const s2 = await S_(); r.playRest = s2.rest; r.playScr = s2.rest ? await W('L', s2.rest.z[0], s2.rest.z[1]) : null;
const L = await takeL(); r.cues = cueNames(L);
await key('m'); await settle(800);
return r;
