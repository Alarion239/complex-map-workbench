// The number of layers the All sheets glide draws is the number of members its inverse has at a point (landMembers): a finite family's count,
// a ROOTPOW 'log' family's 1 / |beta.re| (rounded up unless it is an integer). A count that does not exist (an infinite family) or is over
// LAND_MEMBERS_MAX is not clamped silently: the layers hook (__cmwLandSeamMiss) says so in membersFail.
// - z^2 and z^3 (the Roots example's family): their members are counted and nothing is reported;
// - 9 members (over the cap of 8) and z^i near its end (a thousand): membersFail names the reason (the controls: a count of 1 or a clamp would say nothing).
// An exactly infinite count has no glide frame: beta.re is 0 only at u = 1, the still frame.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const LOAD_MAX_MS = 60000;
const MEMBERS_MAX = 8;   // (LAND_MEMBERS_MAX)
// z^p, p = 1 + (n - 1) u, has 1 / |beta.re| = p members (rounded up unless p is an integer); z^i at u close to 1 has the huge count 1 / |beta.re| with
// beta.re near 0 (exactly 0, infinitely many members, is the still frame at u = 1)
const CASES = [
  { tag: 'z^2 (p 1.5 at u .5: 2 members)', steps: [{ type: 'pown', params: { n: 2 }, on: true }], u: 0.5, layers: 2, fail: null },
  { tag: 'z^3 (p 2 at u .5: exactly 2 members)', steps: [{ type: 'pown', params: { n: 3 }, on: true }], u: 0.5, layers: 2, fail: null },
  { tag: 'z^9 (p 8.99 at u .999: 9 members, over the cap)', steps: [{ type: 'pown', params: { n: 9 }, on: true }], u: 0.999, layers: MEMBERS_MAX, fail: 'over the cap' },
  { tag: 'z^i (u .999: about a thousand members, over the cap)', steps: [{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true }], u: 0.999, layers: null, fail: 'over the cap' },
];
await view(1440, 900, false, false);
for (const c of CASES) {
  const ns = 'members' + Date.now();
  await loadView('steps', ns, { shapes: [], steps: c.steps, sheets: true, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: LOAD_MAX_MS, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`); await settled({ max: LOAD_MAX_MS });
  await ev(`__cmwSteps({ x: ${c.u} }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
  const r = JSON.parse(await ev('JSON.stringify((() => { const c = __cmwLandCarry(), m = __cmwLandSeamMiss(); return { path: c && c.path, layers: c && c.layers, membersFail: m && m.membersFail }; })())'));
  info[c.tag] = r;
  ok(`${c.tag}, u=${c.u}: the glide is drawn by the exact inverse path`, r.path === 'inverse', r);
  if (c.layers !== null) ok(`${c.tag}, u=${c.u}: ${c.layers} layers`, r.layers === c.layers, r);
  ok(`${c.tag}, u=${c.u}: the member count ${c.fail ? 'is reported as ' + c.fail : 'is not reported as failing'}`, c.fail ? !!r.membersFail && r.membersFail.reason === c.fail : r.membersFail === null, r);
}
return { pass: fails.length === 0, fails, info };
