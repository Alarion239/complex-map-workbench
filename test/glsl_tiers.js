// The GLSL test pages' tiers and parts (glsl-test.html, glsl-test-adv.html, glsl-inverse-test.html; their make_*.py
// put this file first). ?tier=core|deep|all (default all) keeps the chains of that tier; ?parts=n&part=i keeps the
// chains with hash(name) mod n = i, so adding or removing a chain never moves another one to a different part.
//   core: every hand-written chain (catalog defaults, natural paths, regressions, errors, d/dz, the special functions,
//         series, recurrences, repeats, ...) and a fixed eighth of each random family, chosen by name: what every pull
//         request runs, also on Windows, where Direct3D 11 compiles each program on the CPU
//   deep: the rest of the random families, and the chains in SLOW (measured slowest on Windows): the nightly run, a
//         push to main, a run by hand and the label glsl-deep (ci/README.md, GLSL tiers)
// The pages report R.partition = 'hash', R.tier and R.chainMs (each chain's milliseconds, for SLOW).
window.GLSLTiers = (() => {
  // FNV-1a over the name's UTF-16 code units: the same on every platform and in every browser
  function hashName(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  const partOf = (name, n) => hashName(name) % n;
  // the random families of each page (their chains are made by a seeded generator): deep but for an eighth by name
  // (the adv page's chains are cheap, a few minutes for all of them on Windows: all core)
  const RANDOM = {
    glsl: /^(rand |multi#|dmulti#|cut |sheet )/,
    inverse: /^(rand#|rand-rational#)/,
  };
  const SAMPLE = 8;
  // chains measured slowest on Windows (WARP) that are not the only core chain of their kind: always deep
  const SLOW = new Set([]);
  function tierOf(page, name) {
    if (SLOW.has(name)) return 'deep';
    const r = RANDOM[page];
    if (r && r.test(name)) return partOf('sample ' + name, SAMPLE) === 0 ? 'core' : 'deep';
    return 'core';
  }
  const qs = new URLSearchParams(location.search);
  const TIER = ['core', 'deep', 'all'].includes(qs.get('tier')) ? qs.get('tier') : 'all';
  const PARTS = Math.max(1, +qs.get('parts') || 1), PART = Math.max(0, +qs.get('part') || 0);
  // ?legacy=1: the parts by the chain's index and every chain, as before this file (ci/glsl.js, against a reference
  // that predates it, runs both sides so: the same chains on both)
  const LEGACY = qs.get('legacy') === '1';
  // the chain named name, the i-th of the page's list, runs on this page load
  const keep = (page, name, i) => (LEGACY ? i % PARTS === PART % PARTS
    : partOf(name, PARTS) === PART % PARTS && (TIER === 'all' || tierOf(page, name) === TIER));
  // the adv page's sections that are not chains: in core, keys only (direct and compile are most of its Windows time)
  const SECTIONS_CORE = ['keys', 'main'];
  const section = (s) => LEGACY || TIER !== 'core' || SECTIONS_CORE.includes(s);
  return { hashName, partOf, tierOf, keep, section, TIER: LEGACY ? 'all' : TIER, PARTS, PART, LEGACY, SLOW, SAMPLE };
})();
