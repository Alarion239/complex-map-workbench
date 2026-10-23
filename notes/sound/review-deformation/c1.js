// z^5 on X's Phase plane (main 'phase'): A plain play; B Esc mid-play; C pause mid-play; D switch view mid-play; E loop wrap
await loadS([{ type: 'custom', params: { expr: 'z^5', cut: 180 }, on: true }]);
await soundOn('phase');
const th = 170 * Math.PI / 180, Z = [1.2 * Math.cos(th), 1.2 * Math.sin(th)];
let p = await W('L', ...Z); await rest(p); await settle(1900); await takeL();
// A
await recStart(); await act('m'); await key('m'); await sleep(3200);
OUT.A = { s: await S_(), st: await ST() }; const LA = await takeL(); await recStop('c1A');
OUT.A.cues = cueNames(LA); OUT.A.nvs = LA.vs.length; OUT.A.gates = LA.gate.map((g) => g[1]).join('');
// B: Esc mid-play (close then reopen with M)
await key('m'); await settle(2000); await rest(p); await settle(1900); await takeL();
await recStart(); await act('m'); await key('m'); await sleep(700); await act('esc'); await key('Escape'); const tEsc = await ev('performance.now()'); await sleep(1500);
const LB = await takeL(); await recStop('c1B');
OUT.B = { st: await ST(), cues: cueNames(LB), setsAfterEsc: LB.vs.filter((v) => v[0] > tEsc).length, gatesAfterEsc: LB.gate.filter((g) => g[0] > tEsc - 5).map((g) => [Math.round(g[0] - tEsc), g[1]]).slice(0, 8) };
// C: pause mid-play
await key('m'); await settle(2000); await rest(p); await settle(1900); await takeL();
await recStart(); await act('m'); await key('m'); await sleep(800); await act('pause'); await ev(`document.getElementById('morphPlay').click()`); await sleep(2400);
const LC = await takeL(); await recStop('c1C'); OUT.C = { st: await ST(), cues: cueNames(LC), nvs: LC.vs.length };
// D: switch view mid-play (phase -> land -> phase)
await key('m'); await settle(2000); await rest(p); await settle(1900); await takeL();
await recStart(); await act('m'); await key('m'); await sleep(600); await act('land'); await ev(`__cmwSetMain('land')`); await sleep(700); await act('phase'); await ev(`__cmwSetMain('phase')`); await sleep(1500);
const LD = await takeL(); await recStop('c1D'); OUT.D = { st: await ST(), cues: cueNames(LD), nvs: LD.vs.length, s: await S_() };
// E: loop on, across a wrap
await key('m'); await settle(2000); await ev(`__cmwSet('loop', true); 1`); p = await W('L', ...Z); await rest(p); await settle(1900); await takeL();
await recStart(); await act('m'); await key('m'); await sleep(6500);
const LE = await takeL(); await recStop('c1E'); OUT.E = { st: await ST(), cues: cueNames(LE), nvs: LE.vs.length, s: await S_() };
await key('m'); await ev(`__cmwSet('loop', false); 1`);
OUT.logs = logs().filter((l) => /EXC|error/i.test(l.t)).slice(0, 5);
return OUT;
