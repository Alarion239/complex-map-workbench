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
  // ([issue #260] and Φ_M's second program: its orbit array is an indexable temporary for Direct3D 11's compiler, whose
  // cost there is not measured yet; on SwiftShader the program's pipeline takes about 3 times an iter() loop's, less
  // than Γ's)
  const SLOW = new Set(['dh near M 0.6z-0.5 N 12']);
  // chains whose program SwiftShader (Chrome's CPU WebGL2, the Linux GLSL jobs) does not finish: minutes of one core in
  // the GPU process, then the GPU process is lost and every later chain of the page errors. keep leaves them out when this
  // page's renderer is SwiftShader and lists them, each with its reason, in notRun; Windows and macOS run them (each with
  // what it did alone on SwiftShader, 4 cores). ci/glsl.js builds a reference without this set with this file, so that
  // both sides leave the same chains out. None is listed now
  const SWIFTSHADER_HANG = new Map([]);
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
  // (the renderer of a WebGL2 context, read once: SwiftShader leaves SWIFTSHADER_HANG's chains out)
  const SWIFTSHADER = (() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2'), e = gl && gl.getExtension('WEBGL_debug_renderer_info');
      const r = gl ? String(gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : '';
      const lose = gl && gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return /SwiftShader/i.test(r);
    } catch (e) { return false; }
  })();
  const notRun = [];
  // the chain named name, the i-th of the page's list, runs on this page load (a chain of SWIFTSHADER_HANG on
  // SwiftShader does not: it goes into notRun as 'name (reason)')
  const keep = (page, name, i) => {
    const mine = LEGACY ? i % PARTS === PART % PARTS
      : partOf(name, PARTS) === PART % PARTS && (TIER === 'all' || tierOf(page, name) === TIER);
    if (mine && SWIFTSHADER && SWIFTSHADER_HANG.has(name)) { notRun.push(`${name} (${SWIFTSHADER_HANG.get(name)})`); return false; }
    return mine;
  };
  // the adv page's sections that are not chains: in core, keys only (direct and compile are most of its Windows time)
  const SECTIONS_CORE = ['keys', 'main'];
  const section = (s) => LEGACY || TIER !== 'core' || SECTIONS_CORE.includes(s);
  return { hashName, partOf, tierOf, keep, section, TIER: LEGACY ? 'all' : TIER, PARTS, PART, LEGACY, SLOW, SWIFTSHADER_HANG, SWIFTSHADER, notRun, SAMPLE };
})();
