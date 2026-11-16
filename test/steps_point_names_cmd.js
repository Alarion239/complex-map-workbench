// A point carries its own plane's name (#1703), behind ?view=steps: on zeta (w₁ = ζ(z)), a point drawn on z is z₀ and a point
// drawn on w₁ is w₁,₁ (the plane's name, a comma, then its number, which the points of all planes share):
//  - the plane the point lies on writes the name at it: z₀ on z, w₁,₁ on w₁ (the other plane's point, carried there, has primes
//    or is a preimage ring: z₀′ on w₁, w₁,₁₍₁₎ on z);
//  - the left panel's rows, grouped by plane, give the same names.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svpn' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true,
  shapes: [{ id: 'sa', kind: 'point', p: [0.4, 0.3], ci: 1, visible: true, stage: 0, num: 0 }, { id: 'sb', kind: 'point', p: [1.0, 0.5], ci: 2, visible: true, stage: 1, num: 1 }],
  steps: [{ type: 'zeta', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
await view(1280, 800, false, false);
await go(`http://localhost:${PORT}/gl-helpers.html`);
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && typeof __cmwLabelsPlaced === 'function'` });
const quiet = (extra) => settled({ max: 20000, until: `(() => { const s = __cmwSteps(); return !s.anim && !s.play${extra ? ' && (' + extra + ')' : ''}; })()` });
// (the labels drawn on the plane shown, waited for: the plane's frame comes after the glide lands)
const labelsOn = async (k, wants) => {
  await ev(`__cmwSteps({ go: ${k}, now: true })`); await quiet();
  const w = await settled({ max: 20000, only: true, until: `${JSON.stringify(wants)}.every((t) => __cmwLabelsPlaced().some((q) => q.text === t))` });
  ok(`plane ${k}: the labels ${wants.join(', ')} come`, w.ok, w);
  return ev(`__cmwLabelsPlaced().map((q) => q.text)`);
};
// (the preimage ring is placed after the point drawn on z: waited for as well, so the checks on it read the rings that are there)
const l0 = await labelsOn(0, ['z₀', 'w₁,₁₍₁₎']);
ok('on z: the point drawn on z is z₀', l0.includes('z₀'), l0);
ok('on z: the preimage ring of the point drawn on w₁ is named w₁,₁₍₁₎', l0.includes('w₁,₁₍₁₎'), l0);
ok('on z: no name of a z point for the point drawn on w₁ (z₁)', !l0.some((t) => /^z₁/.test(t)), l0);
const l1 = await labelsOn(1, ['w₁,₁', 'z₀′']);
ok('on w₁: the point drawn on w₁ is w₁,₁', l1.includes('w₁,₁'), l1);
ok('on w₁: the point drawn on z, carried there, is z₀′', l1.includes('z₀′'), l1);
ok('on w₁: no name of a z point for the point drawn on w₁ (z₁)', !l1.some((t) => /^z₁/.test(t)), l1);
const rows = await ev(`[...document.querySelectorAll('#shapeList > *')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
info.rows = rows;
ok('the panel lists z₀ under "In z" and w₁,₁ under "In w₁"', rows.length === 4 && rows[0] === 'In z' && /^z₀/.test(rows[1]) && rows[2] === 'In w₁' && /^w₁,₁/.test(rows[3]), rows);
// (the rows' buttons are named by it: a screen reader says "Hide w 1 comma 1", not "w 11")
const aria = await ev(`[...document.querySelectorAll('#shapeList .eye, #shapeList .more')].map((b) => b.getAttribute('aria-label'))`);
info.aria = aria;
ok('the rows\' buttons are named "Hide w₁,₁" and "More actions for w₁,₁", and none by a z name for it', aria.includes('Hide w₁,₁') && aria.includes('More actions for w₁,₁') && !aria.some((a) => /z₁/.test(a)), aria);
return { pass: fails.length === 0, fails, info };
