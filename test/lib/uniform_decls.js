// The uniforms a program's two GLSL stages declare, read from their sources, and the check over every program of GLR._src.DEFS that a name
// with a texture unit is a sampler and that a name has one type (test/gl_uniform_units_cmd.js). An expression for eval in a suite:
// `const { DECLS, STATIC } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'uniform_decls.js'), 'utf8'))`.
// - DECLS: a page expression for { decls(src): name -> [types] of one stage (comments dropped; a declaration may list several names and
//   arrays), clashes(vs, fs): the names the two stages declare with two types, units(vs, fs, U): the names with a texture unit in U that
//   a stage declares as other than a sampler };
// - STATIC(modes): a page expression over every program of GLR._src.DEFS in each of the map modes `modes` (a mode a program is not
//   built for throws in programSources and is passed over): { names: the programs, built: those read in some mode, bad: what clashes and
//   units found, as 'name/mode finding' }
(() => {
  const DECLS = `(() => {
    const decls = (src) => {
      const m = {};
      const s = src.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ' ').replace(/\\/\\/[^\\n]*/g, ' ');
      for (const d of s.matchAll(/\\buniform\\s+(?:(?:highp|mediump|lowp)\\s+)?(\\w+)\\s+([^;]+);/g)) {
        for (const n of d[2].split(',')) { const name = n.trim().replace(/\\[.*$/, '').replace(/\\s*=.*$/, ''); (m[name] = m[name] || []).push(d[1]); }
      }
      return m;
    };
    const clashes = (vs, fs) => {
      const a = decls(vs), b = decls(fs), bad = [];
      for (const n of new Set([...Object.keys(a), ...Object.keys(b)])) { const types = new Set([...(a[n] || []), ...(b[n] || [])]); if (types.size > 1) bad.push(n + ': ' + [...types].join(' / ')); }
      return bad;
    };
    const units = (vs, fs, U) => {
      const bad = [];
      for (const src of [vs, fs]) for (const [n, types] of Object.entries(decls(src))) if (n in U && types.some((t) => !/sampler/.test(t))) bad.push(n + ': ' + types.join(' / ') + ' (unit ' + U[n] + ')');
      return bad;
    };
    return { decls, clashes, units };
  })()`;
  const STATIC = (modes) => `(() => {
    const T = ${DECLS}, bad = [], built = [];
    for (const n of Object.keys(GLR._src.DEFS)) for (const mode of ${JSON.stringify(modes)}) {
      let s;
      try { s = GLR._src.programSources(n, mode); } catch (e) { continue; }
      built.push(n);
      for (const c of T.clashes(s[0], s[1])) bad.push(n + '/' + mode + ' ' + c);
      for (const c of T.units(s[0], s[1], GLR._src.SAMPLER_UNITS)) bad.push(n + '/' + mode + ' ' + c);
    }
    return { names: Object.keys(GLR._src.DEFS), built: [...new Set(built)], bad: [...new Set(bad)] };
  })()`;
  return { DECLS, STATIC };
})()
