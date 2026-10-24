// node make_corpus.js <analysis.json> <res_corpus.json> <out corpus.json>
const fs = require('fs');
const [AN, BR, OUT] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(AN, 'utf8'));
let br = {};
try { br = JSON.parse(fs.readFileSync(BR, 'utf8')); } catch (e) {}
const lamps = (s) => (s ? s.split(',').filter(Boolean) : []);
const bshort = (r) => r && !r.err ? {
  path: r.paths, pathAfterPan: r.pathsAfterPan, renderMs: r.time, panFrames: r.pan, settleAfterPanMs: r.settleMs,
  sphereMesh: r.sm, paramFrames: r.param || undefined, paramSettleMs: r.paramSettleMs, morphRenderMs: r.morphTime, morphFrames: r.morph, lampsInApp: r.lamps,
} : (r ? { err: r.err } : undefined);
const entries = rows.map((r) => ({
  id: r.id, tex: r.tex, plain: r.plain || undefined, kind: r.kind,
  catalog: r.chain === null ? null : r.chain.map((s) => (s.params && Object.keys(s.params).length ? { type: s.type, params: s.params } : { type: s.type })),
  branches: r.note || undefined,
  today: r.today.err ? { error: r.today.err } : { inverse: r.today.ops, naturalPath: r.today.nat, lamps: lamps(r.today.props), cutsDrawn: r.today.cutsDrawn },
  plainToday: r.plainToday ? { sameAst: r.plainToday.sameAst, inverse: r.plainToday.ops, naturalPath: r.plainToday.nat, valuesEqual: r.plainToday.values ? r.plainToday.values.bad === 0 : null } : undefined,
  catalogPath: r.catalog && !r.catalog.identity ? { inverse: r.catalog.ops, naturalPath: r.catalog.nat.split(' | '), lamps: r.catalog.props.split(' | ').map(lamps), cutsDrawn: r.catalog.cutsDrawn } : undefined,
  values: r.values ? { points: r.values.n, mismatches: r.values.bad, maxRel: r.values.maxRel } : undefined,
  browser: (br['f_' + r.id] || br['k_' + r.id]) ? { formula: bshort(br['f_' + r.id]), catalog: bshort(br['k_' + r.id]) } : undefined,
}));
const doc = {
  about: 'Formula-recognition audit corpus (notes/formula-recognition/AUDIT.md). v15 work copy work/xvr, 2026-10-24. kind: exact = the formula is this catalog chain as written (z once, same branches on the formula cut 180, sheet 0); identity = equal as a function to the chain but written differently (z more than once, or an algebraic identity) -- values were checked, recognising it needs a proof per pattern; trap = looks like a simpler map but is exactly the chain given (e.g. sqrt(z^2) is not z); none = no catalog chain.',
  sharedNumber: { a: 0.7, note: 'shared numbers are real sliders; the corpus evaluates a = 0.7' },
  valuesChecked: '328 points: 300 random in [-3,3]^2 and pairs 1e-7 either side of the real and imaginary axes (the default cut and the inverse-trig cuts); mismatch = relative difference > 1e-9 or one side undefined',
  fields: { today: 'what the app does with the formula as a custom step now: inverse ops (Inverse.stepOps) or INEL reason (then the SphereMesh forward fallback), natural path kind (Funcs customNat), lamps lit, branch cuts drawn', catalogPath: 'the same for the catalog chain', browser: 'headless Chrome (ANGLE Metal), 1440x900: shape paths, render ms (__cmwTime), rAF frames while panning the w-plane and while dragging the shared number, SphereMesh settle, deformation at t = 0.5' },
  entries,
};
fs.writeFileSync(OUT, JSON.stringify(doc, null, 1));
console.log('entries', entries.length, 'with browser', entries.filter((e) => e.browser).length);
