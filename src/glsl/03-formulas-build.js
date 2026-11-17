  // The program key of a formula: its tree without positions or spelling (z^{i} and z^i, \\frac12 and 1/2 are one key),
  // a shared number by its name, and no number's value: every number is a uniform (genCustom, genCustomPair and
  // derivPlan write constants at fill time), so changing one does not compile again. What the code is built from
  // goes in beside it: the exponents genCustom bakes in (its baked list), those the sheet code bakes in (pairBaked),
  // and d/dz's own source (build).
  function astSig(n) {
    return JSON.stringify(n, (k, x) => (k === 'pos' || k === 'len' || k === 'lit' || k === 's' || k === 'name' ? undefined
      : x && typeof x === 'object' && x.t === 'num' ? (x.param != null ? ['#', x.param] : '#')
        // ([issue #6] a recurrence's constant N is a uniform: a new N is the same program)
        : x && typeof x === 'object' && x.t === 'iter' && !Expr.depends(x.hi) ? Object.assign({}, x, { hi: '#N' }) : x));
  }
  // What the sheet code (genCustomPair) builds from the values of constant exponents without a shared number, in tree
  // order: Funcs.branchNode null (an integer, |n| <= 4096) writes the integer into cipow; any other exponent is a
  // branch node, 'n', whose value and sheet count are uniforms. An exponent with a shared number is always a branch
  // node there (paramPow), whatever its value, so the code does not depend on it and a slider never compiles again
  function pairBaked(ast) {
    const out = [];
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (!n.t) return;
      for (const k of Object.keys(n)) if (n[k] && typeof n[k] === 'object') walk(n[k]);
      if (n.t === 'pow' && Expr.depends(n) && !Expr.depends(n.b) && !hasParam(n.b)) {
        const bn = Funcs.branchNode ? Funcs.branchNode(n) : null;
        out.push(bn ? 'n' : Expr.compile(n.b)(C(0, 0)).re);
      }
    };
    walk(ast);
    return out;
  }
  // A formula recognized as catalog steps (Funcs: b.rec): each step's own plan, as functions of their own (P r j), and
  // the step as their composition; its homotopy runs the steps' own homotopies in turn, step j on [j/n, (j+1)/n]
  // (Funcs' asChain). The key holds the steps' keys only (the sheet view runs the steps too, sheetPlan; d/dz has its
  // own key part), never the spelling: z^{i} and z^i are one program, and a shared number never recompiles it.
  function recPlan(P, b, A) {
    const subs = b.rec.built.map((sb, j) => {
      const Q = `${P}r${j}`;
      const pl = stepPlan(Q, sb, A);
      if (!pl) throw new Error('GLChain: no plan for a recognized step');
      return { Q, pl };
    });
    const n = subs.length;
    let pre = '';
    for (const { Q, pl } of subs) {
      if (pl.pre) pre += pl.pre;
      pre += `vec2 ${Q}_f(vec2 z) {\n  ${pl.f}\n}\n`;
      const h = withOne(Q, pl);
      pre += `vec2 ${Q}_h(vec2 z, float t) {\n  ${h}\n}\n`;
    }
    const f = subs.map(({ Q }) => `z = ${Q}_f(z);`).join('\n  ') + '\n  return z;';
    let h = 'if (t <= 0.0) return z;\n  ';
    if (n === 1) h += `return ${subs[0].Q}_h(z, t);`;
    else {
      h += `float s = t * ${n}.0;\n  `;
      // (a sub-step whose path is its map at 1 goes through the path at min(s - j, 1), so its map is
      // written once in the path, not again for the later sub-steps)
      subs.forEach(({ Q, pl }, j) => { h += j === n - 1 ? `return ${Q}_h(z, s - ${j}.0);` : exactAt1(pl) ? `z = ${Q}_h(z, min(s - ${j}.0, 1.0));\n  if (s < ${j + 1}.0) return z;\n  ` : `if (s < ${j + 1}.0) return ${Q}_h(z, s - ${j}.0);\n  z = ${Q}_f(z);\n  `; });
    }
    // (own1 below: every sub-step's path is its map at 1, so is this one, and the shortcut that would write every map
    // again is left out)
    // (the landscape's cut kinds, GLChain cutKinds: a sub-step with such a cut, in its map or its path; a sub-step's
    // path with a principal cut of its own (hc) runs inside the formula's path, which has no local-cut form)
    const ck = subs.map(({ Q, pl }) => cutKindOf(Q, pl));
    return {
      sig: ['custom', 'rec', subs.map(({ pl }) => pl.sig)], pre, f, h, own1: subs.every(({ pl }) => exactAt1(pl)),
      cutF: ck.some((c) => c.fo), cutH: ck.some((c) => c.ho) || subs.some(({ pl }) => !!pl.hc),
      write(put) { for (const { pl } of subs) pl.write(put); },
    };
  }
  // [issue #6] Repeat × N (Funcs.repeatBuilt: b.rec runs the block's last step, then the block N − 1 times): the block's
  // steps once each, as functions of their own (P r j), and a loop whose trip count N − 1 is a uniform, so a new N (a
  // typed N, a shared number's slider) is the same program. The path runs the 1 + (N − 1) len steps in turn, each on
  // an equal part of t, as the CPU's does
  function repPlan(P, b, A) {
    const rp = b.repeat, block = rp.block;
    const subs = block.map((sb, j) => {
      const Q = `${P}r${j}`;
      const pl = stepPlan(Q, sb, A);
      if (!pl) throw new Error('GLChain: no plan for a repeated step');
      return { Q, pl };
    });
    const len = subs.length, last = subs[len - 1].Q, nc = A.cell();
    let pre = '';
    for (const { Q, pl } of subs) {
      if (pl.pre) pre += pl.pre;
      pre += `vec2 ${Q}_f(vec2 z) {\n  ${pl.f}\n}\n`;
      const h = withOne(Q, pl);
      pre += `vec2 ${Q}_h(vec2 z, float t) {\n  ${h}\n}\n`;
    }
    const passes = `int(${nc.x})`;
    const f = `z = ${last}_f(z);\n  for (int k = 0; k < ${passes}; k++) {\n    ${subs.map(({ Q }) => `z = ${Q}_f(z);`).join('\n    ')}\n  }\n  return z;`;
    const h = `if (t <= 0.0) return z;\n  if (t >= 1.0) return ${P}_f(z);\n  float s = t * (1.0 + ${nc.x} * ${len}.0);\n  if (s < 1.0) return ${last}_h(z, s);\n  z = ${last}_f(z); s -= 1.0;\n`
      + `  for (int k = 0; k < ${passes}; k++) {\n${subs.map(({ Q }) => `    if (s < 1.0) return ${Q}_h(z, s);\n    z = ${Q}_f(z); s -= 1.0;`).join('\n')}\n  }\n  return z;`;
    const ck = subs.map(({ Q, pl }) => cutKindOf(Q, pl));
    return {
      sig: ['custom', 'repeat', subs.map(({ pl }) => pl.sig)], pre, f, h,
      cutF: ck.some((c) => c.fo), cutH: ck.some((c) => c.ho) || subs.some(({ pl }) => !!pl.hc),
      write(put) { put(nc.c, rp.n - 1, 0); for (const { pl } of subs) pl.write(put); },
    };
  }
  // A step's cuts that the sheets cannot continue (inverse trig functions, the Joukowski branches, arg in a formula):
  // fo in its map, ho in its path at 0 < t < 1 (a path through the map itself inherits the map's)
  const NONSHEET_CUT = /\b(?:casin|cacos|catan|casinh|cacosh|catanh|csqrtp|cx_atanhS|cx_asinS|cx_atanS|cx_asinhS)\s*\(|vec2\(carg\(/;
  function cutKindOf(P, plan) {
    const fo = plan.cutF !== undefined ? plan.cutF : NONSHEET_CUT.test((plan.pre || '') + plan.f);
    const ho = plan.cutH !== undefined ? plan.cutH : NONSHEET_CUT.test(plan.h) || (plan.h.includes(`${P}_f(`) && fo);
    return { fo, ho };
  }

  // ---- d/dz: derivative of one step (for the exact chain rule) ----
  // {f: body of vec2 P_df(vec2 z), write} from Funcs.derivAst (exact numbers, the step's cut), or null
  function derivPlan(P, b, A) {
    if (typeof Funcs.derivAst !== 'function') return null;
    const d = Funcs.derivAst(b, { stable: true });
    if (!d || d.error) return null;
    const cut = A.cell();
    const writers = [], lines = [];
    const res = genCustom(d.ast, `${P}_d`, A, cut.x, writers, lines);
    return {
      f: `${lines.join('\n').trimStart()}\n  return ${res};`,
      write(put) { const th = d.cut * DEG; put(cut.c, th, 0); for (const w of writers) w(put, th); },
    };
  }

  // ---- whole Riemann surfaces (chainSheet): pair evaluation (cell centre zc, point z) with local cuts ----
  // Mirrors Funcs.sheetEval: every multivalued piece takes the cut opposite its input at zc and the sheet read from
  // the digits of combo (cxs0_dig). Sheet counts (radices) are uniforms, so no parameter value is baked in.
  // Custom formulas: vec4 P_s(vec4 p, inout highp int c), node by node as Funcs' pairCompile (children first).
  function genCustomPair(ast, P, A, writers, lines, theta = Math.PI) {
    let tmp = 0;
    const dep = Expr.depends;
    const rads = [];
    const constOf = (n) => Expr.compile(n)(C(0, 0));
    const pair = (ec, ew) => { const nm = `${P}_${tmp++}`; lines.push(`  vec2 ${nm}c = ${ec};`, `  vec2 ${nm}w = ${ew};`); return [`${nm}c`, `${nm}w`]; };
    const both = (fn, a) => pair(fn(a[0]), fn(a[1]));
    const UN = {
      sin: 'csin', cos: 'ccos', tan: 'ctan', sinh: 'csinh', cosh: 'ccosh', tanh: 'ctanh',
      asin: 'casin', acos: 'cacos', atan: 'catan', asinh: 'casinh', acosh: 'cacosh', atanh: 'catanh', exp: 'cexp',
      gamma: 'cx_gamma', zeta: 'cx_zeta', digamma: 'cx_digamma', zetad: 'cx_zetad',
    };
    const RECIP = { cot: 'ctan', sec: 'ccos', csc: 'csin', coth: 'ctanh' };
    // (an exponent with a shared number, z^{a}: a branch node whatever a is, its value and sheet count read when the
    // uniforms are filled; an integer a is one sheet, a digit of radix 1 that takes nothing from c, and cpow on any
    // sheet is z^a. So the code, and the key (astSig, pairBaked), do not depend on a. The price: an integer a goes
    // through cpow (exp and log, about 1e-4 relative at large |z|) where a typed integer takes cipow, in the sheet view only)
    const paramPow = (b) => {
      const vOf = () => constOf(b), intOf = (v) => v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 4096;
      return { kind: 'powc', get v() { return vOf(); }, get n() { const v = vOf(); return intOf(v) ? 1 : Funcs.sheetCount(v); } };
    };
    // a branch node: its sheet (one digit of c) and its local cut (opposite its input at the centre)
    // (the sheet numbered from the formula's own cut theta, Funcs' sheetOff: rc.y = theta)
    function node(bn, inC) {
      const rc = A.cell(), i = rads.length;
      rads.push(rc);
      writers.push((put) => put(rc.c, bn.n, theta));
      lines.push(`  float ${P}_s${i} = cxs0_dig(${rc.x}, c) + floor((${rc.y} - carg(${inC})) / (2.0 * CX_PI));`, `  float ${P}_t${i} = carg(${inC}) + CX_PI;`);
      return [`${P}_t${i}`, `${P}_s${i}`];
    }
    function g(n) {
      if (!dep(n)) {
        const cell = A.cell();
        writers.push((put) => putC(put, cell, constOf(n)));
        return [cell.v, cell.v];
      }
      switch (n.t) {
        case 'var':
          switch (n.n) {
            case 'z': return ['zc', 'zw'];
            case 'x': return both((a) => `vec2(${a}.x, 0.0)`, ['zc', 'zw']);
            case 'y': return both((a) => `vec2(${a}.y, 0.0)`, ['zc', 'zw']);
            case 'r': return both((a) => `vec2(cx_abs(${a}), 0.0)`, ['zc', 'zw']);
            case 'theta': return both((a) => `vec2(carg(${a}), 0.0)`, ['zc', 'zw']);
          }
          break;
        case 'neg': return both((a) => `-${a}`, g(n.a));
        case 'add': case 'sub': case 'mul': case 'div': {
          const a = g(n.a), b = g(n.b);
          const op = { add: (x, y) => `${x} + ${y}`, sub: (x, y) => `${x} - ${y}`, mul: (x, y) => `cmul(${x}, ${y})`, div: (x, y) => `cdiv(${x}, ${y})` }[n.t];
          return pair(op(a[0], b[0]), op(a[1], b[1]));
        }
        case 'pow': {
          const bn = !dep(n.b) && hasParam(n.b) ? paramPow(n.b) : Funcs.branchNode(n);
          if (!dep(n.b)) {
            const a = g(n.a);
            if (!bn) { const k = constOf(n.b).re; return both((x) => `cipow(${x}, ${k})`, a); }
            const v = A.cell();
            writers.push((put) => putC(put, v, bn.v));
            const [th, s] = node(bn, a[0]);
            return both((x) => `cpow(${x}, ${v.v}, ${th}, ${s})`, a);
          }
          if (!dep(n.a)) {
            const b = g(n.b);
            const cell = A.cell();
            writers.push((put) => { const base = constOf(n.a); putC(put, cell, base.re === Math.E && base.im === 0 ? C(1, 0) : CX.log(base)); });
            return both((x) => `cx_expmul(${x}, ${cell.v})`, b);
          }
          const a = g(n.a), b = g(n.b);
          const [th, s] = node(bn, a[0]);
          return pair(`cpow(${a[0]}, ${b[0]}, ${th}, ${s})`, `cpow(${a[1]}, ${b[1]}, ${th}, ${s})`);
        }
        case 'root': {
          const a = g(n.a), bn = Funcs.branchNode(n);
          const v = A.cell();
          writers.push((put) => putC(put, v, bn.s));
          const [th, s] = node(bn, a[0]);
          return both((x) => `cpow(${x}, ${v.v}, ${th}, ${s})`, a);
        }
        case 'call': {
          let a = g(n.a);
          if (n.f === 'log' || n.f === 'sqrt') {
            const [th, s] = node(Funcs.branchNode(n), a[0]);
            return both((x) => (n.f === 'log' ? `clog(${x}, ${th}, ${s})` : `cpowr(${x}, 0.5, ${th}, ${s})`), a);
          }
          if (!/^[A-Za-z_]\w*$/.test(a[0])) a = pair(a[0], a[1]);
          if (UN[n.f]) return both((x) => `${UN[n.f]}(${x})`, a);
          if (RECIP[n.f]) return both((x) => `cinv(${RECIP[n.f]}(${x}))`, a);
          switch (n.f) {
            case 'abs': return both((x) => `vec2(cx_abs(${x}), 0.0)`, a);
            case 'conj': return both((x) => `vec2(${x}.x, -${x}.y)`, a);
            case 're': return both((x) => `vec2(${x}.x, 0.0)`, a);
            case 'im': return both((x) => `vec2(${x}.y, 0.0)`, a);
            case 'arg': return both((x) => `vec2(carg(${x}), 0.0)`, a);
          }
          throw new Error(`GLChain: unknown function ${n.f}`);
        }
      }
      throw new Error(`GLChain: cannot compile '${n.t}'`);
    }
    const res = g(ast);
    return { res, rads };
  }
  // Sheet plan of one step: null (single-valued: both points through P_f), or {rads: [radix cell .x], apply: GLSL
  // statements updating vec4 p (digits already read into P_sh0..), fn: extra functions, write}
  function sheetPlan(P, b, A) {
    const v = b.vals, type = b.def.id;
    if (type === 'root' || type === 'powa' || type === 'log') {
      const rc = A.cell(), al = type === 'log' ? null : A.cell();
      const n = Math.max(2, v.n);
      const f = type === 'root' ? (x) => `cpowr(${x}, ${al.x}, th, s)` : type === 'powa' ? (x) => `cpow(${x}, ${al.v}, th, s)` : (x) => `clog(${x}, th, s)`;
      // the step's path at 0 < t < 1 on the same sheet and local cut (the deformation's sheets, Funcs' homPair): z^e
      // with e = 1 + (alpha - 1)t, log through cxs0_lh (P_h of the step, on (th, s))
      const g = type === 'root' ? (x) => `cpowr(${x}, e, th, s)` : type === 'powa' ? (x) => `cpow(${x}, e, th, s)` : (x) => `cxs0_lh(${x}, th, s, u)`;
      const ge = type === 'root' ? (t) => `float e = 1.0 + (${al.x} - 1.0) * ${t};` : type === 'powa' ? (t) => `vec2 e = vec2(1.0 + (${al.x} - 1.0) * ${t}, ${al.y} * ${t});` : (t) => `float u = 1.0 - ${t};`;
      // the sheet numbered from the step's own cut and branch (Funcs' sheetOff): rc.y = its cut
      // + 2 pi k, the digit shifted by floor((rc.y - arg c0) / 2 pi), c0 the input at the cell centre (0 by default)
      const kk = type === 'root' ? (((v.k | 0) % n) + n) % n : v.k | 0, Th = (v.cut ?? 180) * Math.PI / 180 + 2 * Math.PI * kk;
      const sOf = (s0) => `${s0} + floor((${rc.y} - carg(p.xy)) / (2.0 * CX_PI))`;
      return {
        rads: [rc.x],
        apply: (s) => `{ float s = ${sOf(s[0])}; float th = carg(p.xy) + CX_PI; p = vec4(${f('p.xy')}, ${f('p.zw')}); }`,
        homApply: (s, t) => `{ float s = ${sOf(s[0])}; float th = carg(p.xy) + CX_PI; ${ge(t)} p = vec4(${g('p.xy')}, ${g('p.zw')}); }`,
        fn: '',
        write(put) {
          if (type === 'root') { put(rc.c, n <= Funcs.SHEET_MAX ? n : 0, Th); put(al.c, 1 / n, 0); }
          else if (type === 'powa') { put(rc.c, Funcs.sheetCount(v.alpha), Th); putC(put, al, v.alpha); }
          else put(rc.c, 0, Th);
        },
      };
    }
    if (type !== 'custom') return null;
    // a recognized formula: its steps' pieces in turn (as Funcs.sheetEval), a single-valued step through its own Q_f
    if (b.rec) {
      const subs = b.rec.built.map((sb, j) => ({ Q: `${P}r${j}`, sp: sheetPlan(`${P}r${j}`, sb, A) }));
      if (!subs.some((x) => x.sp)) return null;
      let fn = '', hfn = '', body = '', hbody = '';
      const rads = [];
      const n = subs.length;
      // the path at 0 < t < 1 (the deformation's sheets): its steps' paths in turn, step q on [q/n, (q+1)/n] (recPlan,
      // Funcs' homPair): the steps before in full, step q at x - q, the steps after it only read their digits. With
      // full, every step in full, as _s does: chainSheetHom reaches the steps through _sh alone, so each step's sheet
      // function has one call site there (a shader compiler inlines every call)
      subs.forEach(({ Q, sp }, q) => {
        if (!sp) {
          body += `  p = vec4(${Q}_f(p.xy), ${Q}_f(p.zw));\n`;
          hbody += `  if (full || j > ${q}) p = vec4(${Q}_f(p.xy), ${Q}_f(p.zw));\n  else if (j == ${q} && x > ${q}.0) p = vec4(${Q}_h(p.xy, x - ${q}.0), ${Q}_h(p.zw, x - ${q}.0));\n`;
          return;
        }
        fn += sp.fn;
        hfn += sp.hfn || '';
        rads.push(...sp.rads);
        body += sp.custom ? `  ${sp.apply()}\n` : `  { float s0 = cxs0_dig(${sp.rads[0]}, c); ${sp.apply(['s0'])} }\n`;
        if (sp.custom) {
          const hom = sp.homCall ? sp.homCall(`x - ${q}.0`) : 'p = vec4(cx_nan());';
          hbody += `  if (full || j > ${q}) ${sp.apply()}\n  else if (j == ${q} && x > ${q}.0) ${hom}\n  else { ${sp.rads.map((r) => `cxs0_dig(${r}, c);`).join(' ')} }\n`;
        } else {
          hbody += `  { float s0 = cxs0_dig(${sp.rads[0]}, c);\n    if (full || j > ${q}) ${sp.apply(['s0'])}\n    else if (j == ${q} && x > ${q}.0) ${sp.homApply(['s0'], `(x - ${q}.0)`)}\n  }\n`;
        }
      });
      return {
        rads, custom: true, apply: () => `p = ${P}_s(p, c);`,
        homCall: (t, full = 'false') => `p = ${P}_sh(p, c, ${t}, ${full});`,
        fn: `${fn}vec4 ${P}_s(vec4 p, inout highp int c) {\n${body}  return p;\n}\n`,
        // (the path's function goes with chainSheetHom, into the sheet programs only: GLChain's sheetHom)
        hfn: `${hfn}vec4 ${P}_sh(vec4 p, inout highp int c, float t, bool full) {\n  float x = t * ${n}.0;\n  int j = min(${n - 1}, int(floor(x)));\n${hbody}  return p;\n}\n`,
        write(put) { for (const { sp } of subs) if (sp) sp.write(put); },
      };
    }
    const ast = b.ast || Expr.parse(v.expr);
    // no branch node: single-valued, both points go through P_f (and no uniforms are spent on a pair version)
    // (an exponent with a shared number is a node whatever its value: genCustomPair's paramPow)
    const hasNode = (n) => !!n && typeof n === 'object' && !!n.t && (!!Funcs.branchNode(n) || (n.t === 'pow' && Expr.depends(n) && !Expr.depends(n.b) && hasParam(n.b)) || ['a', 'b'].some((k) => hasNode(n[k])));
    if (!hasNode(ast)) return null;
    const writers = [], lines = [];
    const { res, rads } = genCustomPair(ast, `${P}_p`, A, writers, lines, (v.cut ?? 180) * Math.PI / 180);
    if (!rads.length) return null;
    return {
      rads: rads.map((r) => r.x),
      custom: true,
      apply: () => `p = ${P}_s(p, c);`,
      fn: `vec4 ${P}_s(vec4 p, inout highp int c) {\n  vec2 zc = p.xy, zw = p.zw;\n${lines.join('\n')}\n  return vec4(${res[0]}, ${res[1]});\n}\n`,
      write(put) { for (const w of writers) w(put); },
    };
  }

  // circle formula radius on the GPU for nesting level L (float32: rounding eps |G| / r, so larger than the CPU's)
  const GPU_REL = (L) => 1e-2 * Math.pow(3, Math.max(0, L - 1));
  const flt = (x) => { const s = String(Math.fround(x)); return /[.eE]/.test(s) ? s.replace(/e\+?/, 'e') : s + '.0'; };

  function build(steps, built) {
    const A = makeAlloc();
    const sigs = [], plans = [];
    steps.forEach((st, k) => {
      const b = built[k];
      const P = `cxs${k + 1}`;
      let plan = null;
      if (!st || st.on === false) sigs.push('off');
      else if (!b || b.error || !b.def) sigs.push('err');
      else if (b.op === 'deriv') { plan = { deriv: true }; sigs.push('deriv'); }
      else {
        try { plan = stepPlan(P, b, A); } catch (e) { plan = null; }
        sigs.push(plan ? plan.sig : 'unsupported');
      }
      plans.push(plan ? { P, k: k + 1, plan } : null);
    });
    const live = plans.filter(Boolean);
    const maps = live.filter((x) => !x.plan.deriv);
    const dks = live.filter((x) => x.plan.deriv).map((x) => x.k);

    // the exact chain rule for the first d/dz: a derivative plan for every map before it
    let exact = false;
    const dpl = [];
    if (dks.length) {
      exact = true;
      for (const x of maps) {
        if (x.k > dks[0]) break;
        let dp = null;
        try { dp = derivPlan(x.P, built[x.k - 1], A); } catch (e) { dp = null; }
        if (!dp) { exact = false; break; }
        dpl.push({ x, dp });
      }
      if (!exact) dpl.length = 0;
      for (const { x, dp } of dpl) sigs[x.k - 1] = [sigs[x.k - 1], 'd', dp.f];
      sigs[dks[0] - 1] = ['deriv', exact ? 'x' : 'c'];
    }
    // circle levels: the first d/dz 0 (exact) or 1, every later one one more
    const lev = new Map();
    dks.forEach((k, i) => lev.set(k, i === 0 ? (exact ? 0 : 1) : lev.get(dks[i - 1]) + 1));
    // sheet plans (multivalued maps); the sheet view's d/dz steps are all circle formulas, levels 1, 2, ...
    const spl = new Map();
    for (const x of maps) {
      let sp = null;
      try { sp = sheetPlan(x.P, built[x.k - 1], A); } catch (e) { sp = null; }
      if (sp) spl.set(x.k, sp);
    }

    const slots = A.slots;
    let src = `uniform vec4 uChain[${slots}];\nuniform highp int uSheetW;\n`;
    for (const { P, plan } of maps) {
      if (plan.pre) src += plan.pre;
      src += `vec2 ${P}_f(vec2 z) {\n  ${plan.f}\n}\n`;
      // at t = 1 every homotopy equals the map itself (exactly so on the CPU up to float64 rounding)
      const h = withOne(P, plan);
      src += `vec2 ${P}_h(vec2 z, float t) {\n  ${h}\n}\n`;
    }
    // a d/dz step is not a map of w: chainStep and chainHom give NaN there (callers mix chainStage(k - 1) and
    // chainStage(k) instead)
    src += 'vec2 chainStep(int i, vec2 z) {\n';
    for (const { P, k } of maps) src += `  if (i == ${k}) return ${P}_f(z);\n`;
    for (const k of dks) src += `  if (i == ${k}) return vec2(cx_nan());\n`;
    src += '  return z;\n}\n';
    src += 'vec2 chainHom(int i, vec2 z, float t) {\n';
    for (const { P, k } of maps) src += `  if (i == ${k}) return ${P}_h(z, t);\n`;
    for (const k of dks) src += `  if (i == ${k}) return vec2(cx_nan());\n`;
    src += '  return z;\n}\n';
    // chainAt(k, z, t, how): step k skipped (how 0), in full (1) or along its path at t (2), every step's
    // map and path written once. The map modes 1-3 (gl.js MAP) walk the chain in one loop through it: ANGLE's
    // Direct3D 11 back end hands the code to FXC, which inlines every call, so chainRange, chainHom and postOf each
    // carried a copy of every step (6 to 8, and more, per deformation program). A path with the t = 1 shortcut is
    // the map at t = 1 (exactly), so in full it is the path at 1 and the map is not written again; a straight-line
    // path (no shortcut: z (1 - t) + f(z) t is not f(z) where z is infinite) calls the map itself.
    src += 'vec2 chainAt(int k, vec2 z, float t, int how) {\n  if (how == 0) return z;\n';
    for (const { P, k, plan } of maps) {
      src += plan.h.startsWith('if (t == 0.0)') ? `  if (k == ${k}) return how == 1 ? ${P}_f(z) : ${P}_h(z, t);\n`
        : `  if (k == ${k}) return ${P}_h(z, how == 1 ? 1.0 : t);\n`;
    }
    for (const k of dks) src += `  if (k == ${k}) return vec2(cx_nan());\n`;
    src += '  return z;\n}\n';
    // all at once (mode 3): every step's homotopy at the same t, H_t = h_{b,t} o ... o h_{a+1,t}, through chainHom (so
    // the step functions are not inlined a second time; a d/dz gives NaN there, an off or failed step the identity)
    src += `vec2 chainHomAll(vec2 z, int a, int b, float t) {\n  for (int k = 1; k <= ${Math.max(1, steps.length)}; k++) {\n    if (k > b) break;\n    if (k > a) z = chainHom(k, z, t);\n  }\n  return z;\n}\n`;
    src += `bool chainIsDeriv(int k) {\n  return ${dks.length ? dks.map((k) => `k == ${k}`).join(' || ') : 'false'};\n}\n`;
    // the maps in (a, b] applied to a point (no d/dz inside)
    const raw = dks.length ? 'cxs0_raw' : 'chainRange';
    src += `vec2 ${raw}(vec2 z, int a, int b) {\n`;
    for (const { P, k } of maps) src += `  if (a < ${k} && b >= ${k}) z = ${P}_f(z);\n`;
    src += '  return z;\n}\n';
    const u8 = 'vec2 cxs0_u8(int j) {\n  const float h = 0.7071067811865476;\n'
      + '  if (j == 0) return vec2(1.0, 0.0);\n  if (j == 1) return vec2(h, h);\n  if (j == 2) return vec2(0.0, 1.0);\n  if (j == 3) return vec2(-h, h);\n'
      + '  if (j == 4) return vec2(-1.0, 0.0);\n  if (j == 5) return vec2(-h, -h);\n  if (j == 6) return vec2(0.0, -1.0);\n  return vec2(h, -h);\n}\n';
    if (!dks.length) src += 'vec2 chainStage(int k, vec2 z) {\n  return chainRange(z, 0, k);\n}\n';
    else {
      for (const { x, dp } of dpl) src += `vec2 ${x.P}_df(vec2 z) {\n  ${dp.f}\n}\n`;
      src += u8;
      // G_d for every d/dz step d: the exact chain rule, or (1/8r) sum G_{d-1}(z + r u_j) conj(u_j)
      dks.forEach((d, i) => {
        const p = i ? dks[i - 1] : 0;
        src += `vec2 cxs0_g${d}(vec2 z) {\n`;
        if (lev.get(d) === 0) {
          src += '  vec2 D = vec2(1.0, 0.0);\n';
          for (const { x } of dpl) src += `  D = cmul(D, ${x.P}_df(z)); z = ${x.P}_f(z);\n`;
          src += '  return D;\n}\n';
        } else {
          const inner = (e) => (p ? `cxs0_g${p}(${e})` : e);
          src += `  float r = ${flt(GPU_REL(lev.get(d)))} * (1.0 + cx_abs(z));\n  vec2 acc = vec2(0.0);\n`
            + '  for (int j = 0; j < 8; j++) {\n    vec2 u = cxs0_u8(j);\n'
            + `    vec2 g = cxs0_raw(${inner('z + r * u')}, ${p}, ${d - 1});\n`
            + '    acc += cmul(g, vec2(u.x, -u.y));\n  }\n  return acc / (8.0 * r);\n}\n';
        }
      });
      // G_k: the last d/dz at or before k, then the maps after it
      src += 'vec2 chainStage(int k, vec2 z) {\n  int base = 0;\n';
      [...dks].reverse().forEach((d, i) => { src += `  ${i ? 'else ' : ''}if (k >= ${d}) { z = cxs0_g${d}(z); base = ${d}; }\n`; });
      src += '  return cxs0_raw(z, base, k);\n}\n';
      // a range that starts at a stage point a > 0 cannot cross a d/dz (its input is a function of z, not a point)
      src += 'vec2 chainRange(vec2 z, int a, int b) {\n  if (a <= 0) return chainStage(b, z);\n'
        + `  if (${dks.map((d) => `(a < ${d} && b >= ${d})`).join(' || ')}) return vec2(cx_nan());\n  return cxs0_raw(z, a, b);\n}\n`;
    }
    // chainSheet(zc, z, b, combo): G_b(z) on surface `combo` of the cell centred at zc (see Funcs.sheetEval)
    // chainSheetRange(zc, z, a, b, combo): the steps in (a, b] from points of the w_a-plane, digits for their pieces only
    if (!dks.length && !spl.size) {
      src += 'vec2 chainSheet(vec2 zc, vec2 z, int b, int combo) {\n  return chainRange(z, 0, b);\n}\n';
      src += 'vec2 chainSheetRange(vec2 zc, vec2 z, int a, int b, int combo) {\n  return chainRange(z, a, b);\n}\n';
    }
    else {
      src += 'int cxs0_rad(float n) { return n > 0.5 ? int(n + 0.5) : 2 * uSheetW + 1; }\n'
        + '// the next sheet number from the mixed-radix digits of c (lowest first)\n'
        + 'float cxs0_dig(float n, inout highp int c) {\n  highp int r = max(cxs0_rad(n), 1);\n  highp int q = c / r;\n  highp int d = c - q * r;\n'
        + '  c = q;\n  return n > 0.5 ? float(d) : float(d - uSheetW);\n}\n';
      for (const sp of spl.values()) src += sp.fn;
      // steps in (a, b] applied to the pair p; the digits of c are read for the pieces in (d0, b] (d0 = 0 or a)
      src += 'vec4 cxs0_sraw(vec4 p, int a, int b, highp int c, int d0) {\n';
      for (const { P, k } of maps) {
        const sp = spl.get(k);
        if (!sp) { src += `  if (a < ${k} && b >= ${k}) p = vec4(${P}_f(p.xy), ${P}_f(p.zw));\n`; continue; }
        if (sp.custom) {
          src += `  if (b >= ${k} && d0 < ${k}) {\n    if (a < ${k}) ${sp.apply()}\n    else { ${sp.rads.map((r) => `cxs0_dig(${r}, c);`).join(' ')} }\n  }\n`;
        } else {
          src += `  if (b >= ${k} && d0 < ${k}) {\n    float s0 = cxs0_dig(${sp.rads[0]}, c);\n    if (a < ${k}) ${sp.apply(['s0'])}\n  }\n`;
        }
      }
      src += '  return p;\n}\n';
      if (dks.length) {
        dks.forEach((d, i) => {
          const p = i ? dks[i - 1] : 0;
          const inner = (t) => (p ? `cxs0_sg${p}(zc, ${t}, combo)` : `vec4(zc, ${t})`);
          src += `vec4 cxs0_sg${d}(vec2 zc, vec2 z, int combo) {\n`
            + `  float R = ${flt(GPU_REL(i + 1))};\n  float rc = R * (1.0 + cx_abs(zc)), rz = R * (1.0 + cx_abs(z));\n  vec2 ac = vec2(0.0), az = vec2(0.0);\n`
            + '  for (int j = 0; j < 8; j++) {\n    vec2 u = cxs0_u8(j), uc = vec2(u.x, -u.y);\n'
            + `    ac += cmul(cxs0_sraw(${inner('zc + rc * u')}, ${p}, ${d - 1}, combo, 0).zw, uc);\n`
            + `    az += cmul(cxs0_sraw(${inner('z + rz * u')}, ${p}, ${d - 1}, combo, 0).zw, uc);\n`
            + '  }\n  return vec4(ac / (8.0 * rc), az / (8.0 * rz));\n}\n';
        });
      }
      src += 'vec2 chainSheet(vec2 zc, vec2 z, int b, int combo) {\n  vec4 p = vec4(zc, z);\n  int base = 0;\n';
      [...dks].reverse().forEach((d, i) => { src += `  ${i ? 'else ' : ''}if (b >= ${d}) { p = cxs0_sg${d}(zc, z, combo); base = ${d}; }\n`; });
      src += '  return cxs0_sraw(p, base, b, combo, 0).zw;\n}\n';
      // (one call of cxs0_sraw, chainSheet's for a <= 0, else the range's: FXC inlines every call)
      src += 'vec2 chainSheetRange(vec2 zc, vec2 z, int a, int b, int combo) {\n  vec4 p = vec4(zc, z);\n  int base = a, d0 = a;\n  if (a <= 0) {\n    base = 0; d0 = 0;\n'
        + [...dks].reverse().map((d, i) => `    ${i ? 'else ' : ''}if (b >= ${d}) { p = cxs0_sg${d}(zc, z, combo); base = ${d}; }\n`).join('') + '  }\n'
        + (dks.length ? `  else if (${dks.map((d) => `(a < ${d} && b >= ${d})`).join(' || ')}) return vec2(cx_nan());\n` : '') + '  return cxs0_sraw(p, base, b, combo, d0).zw;\n}\n';
    }

    // chainSheetHom(zc, z, mode, base, a, hi, b, post, t, combo): a deformation map (gl.js map modes 1 and 3: step hi
    // at t, or the steps (a, b] at t, from the stage base, the post (b, post] in full) on surface combo, as
    // Funcs.sheetMapEval: cxs0_how says how step k is applied (0 not, 1 in full, 2 its path at t); the digits of combo
    // are read for the pieces of the steps applied, in chain order, so at t = 1 the surfaces are chainSheet's
    // (its own source, sheetHom, after the chain's: only the sheet programs take it, so every other program compiles
    // the chain as before)
    let sh = '';
    // the log's path at 0 < t < 1 on sheet s of the cut th, u = 1 - t (P_h of a log step: (z^u - 1)/u + u)
    if (spl.size) {
      sh += 'vec2 cxs0_lh(vec2 z, float th, float s, float u) {\n  if (u < 1e-6) return clog(z, th, s);\n'
        + '  if (z.x == 0.0 && z.y == 0.0) return vec2(u - 1.0 / u, 0.0);\n  return cx_expm1(clog(z, th, s) * u) * (1.0 / u) + vec2(u, 0.0);\n}\n';
      for (const sp of spl.values()) sh += sp.hfn || '';
    }
    sh += 'int cxs0_how(int k, int mode, int base, int a, int hi, int b, int post) {\n'
      + '  if (mode == 1) { if (k > base && k < hi) return 1; if (k == hi) return 2; }\n'
      + '  else if (mode == 3) { if (k > base && k <= a) return 1; if (k > a && k <= b) return 2; }\n'
      + '  if (post > b && k > b && k <= post) return 1;\n  return 0;\n}\n';
    // end > 0 (F's last step): F's digits, every live step in (base, end]; a step the map does not
    // apply yet reads its digits and does not act (Funcs.sheetMapEval's end)
    // (cxs0_dom: after a call, the least side value of z against a cut it is continued across (a path's dom: positive
    // on zc's side of its cut, where the continuation is the path itself); 1e30 where no path has one)
    let hcFns = 'float cxs0_dom = 1e30;\n';
    const shHead = sh.length;
    sh += 'vec2 chainSheetHom(vec2 zc, vec2 z, int mode, int base, int a, int hi, int b, int post, float t, int combo, int end) {\n'
      + '  vec4 p = vec4(zc, z);\n  highp int c = combo;\n  int h;\n  cxs0_dom = 1e30;\n';
    for (const { P, k, plan } of live) {
      sh += `  h = cxs0_how(${k}, mode, base, a, hi, b, post);\n`;
      if (plan.deriv) { sh += '  if (h > 0) return vec2(cx_nan());\n'; continue; }
      const sp = spl.get(k);
      if (!sp && plan.hc) {
        // (a path with a cut of its own, z^n's z^(1 + (n - 1)t): on the local cut opposite its input at the centre)
        hcFns += `vec2 ${P}_hc(vec2 z, float t, vec2 zc) {\n  ${plan.hc}\n}\n` + (plan.dom ? `float ${P}_dom(vec2 z, vec2 zc) {\n  ${plan.dom}\n}\n` : '');
        const dom = plan.dom ? ` cxs0_dom = min(cxs0_dom, ${P}_dom(p.zw, p.xy));` : '';
        sh += `  if (h == 1 || (h == 2 && t >= 1.0)) p = vec4(${P}_f(p.xy), ${P}_f(p.zw));\n  else if (h == 2 && t > 0.0) {${dom} p = vec4(${P}_hc(p.xy, t, p.xy), ${P}_hc(p.zw, t, p.xy)); }\n`;
      } else if (!sp) {
        sh += `  if (h == 1 || (h == 2 && t >= 1.0)) p = vec4(${P}_f(p.xy), ${P}_f(p.zw));\n  else if (h == 2 && t > 0.0) p = vec4(${P}_h(p.xy, t), ${P}_h(p.zw, t));\n`;
      } else if (sp.custom) {
        // (a recognized formula, which has a path: the step in full and its path through the one call of _sh)
        const dig = `else if (h == 2 || (h == 0 && ${k} > base && ${k} <= end)) { ${sp.rads.map((r) => `cxs0_dig(${r}, c);`).join(' ')} }\n`;
        sh += sp.homCall ? `  if (h == 1 || (h == 2 && t > 0.0)) ${sp.homCall('t', 'h == 1 || t >= 1.0')}\n  ${dig}` : `  if (h == 1 || (h == 2 && t >= 1.0)) ${sp.apply()}\n  else if (h == 2 && t > 0.0) p = vec4(cx_nan());\n  ${dig}`;
      } else {
        sh += `  if (h > 0) {\n    float s0 = cxs0_dig(${sp.rads[0]}, c);\n    if (h == 1 || t >= 1.0) ${sp.apply(['s0'])}\n    else if (t > 0.0) ${sp.homApply(['s0'], 't')}\n  }\n  else if (${k} > base && ${k} <= end) cxs0_dig(${sp.rads[0]}, c);\n`;
      }
    }
    sh += '  return p.zw;\n}\n';
    sh = sh.slice(0, shHead) + hcFns + sh.slice(shHead);
    // the landscape's cut kinds per live step (gl.js cutModeOf): f its map, h its path at 0 < t < 1: 'none' (no cut),
    // 'sheet' (cuts the sheets continue: chainSheetRange / chainSheetHom), 'other' (cuts they cannot: an inverse trig
    // function, a Joukowski branch, arg, a formula's path through its branch points), 'deriv' (a d/dz)
    // (sheet 0 at a cell's own centre is F's value only where every multivalued piece takes its principal branch, the
    // cut at 180 degrees and branch 0: a root on branch k or another cut angle is found by bisection, as 'other')
    const principalCut = (bb) => {
      if (!bb || !bb.def) return true;
      const id = bb.def.id, v = bb.vals || {};
      const c180 = v.cut === undefined || v.cut === 180;
      if (id === 'root') { const n = Math.max(2, v.n); return c180 && ((((v.k || 0) % n) + n) % n) === 0; }
      if (id === 'powa' || id === 'log') return c180 && !(v.k || 0);
      if (id === 'custom' && bb.rec) return c180 && bb.rec.built.every(principalCut);
      if (id === 'custom') return c180;
      return true;
    };
    const cutKinds = [];
    for (const { P, k, plan } of live) {
      if (plan.deriv) { cutKinds.push({ k, f: 'deriv', h: 'deriv' }); continue; }
      const { fo, ho } = cutKindOf(P, plan), sp = spl.get(k), pc = principalCut(built[k - 1]);
      cutKinds.push({
        k,
        f: fo ? 'other' : sp ? (pc ? 'sheet' : 'other') : 'none',
        h: ho ? 'other' : sp ? (sp.custom && !sp.homCall ? 'other' : pc ? 'sheet' : 'other') : plan.hc ? 'sheet' : 'none',
        // (a path whose cut the sheet programs continue on a triangle's centre branch and clip at the cut, dom)
        clip: !sp && !!plan.hc && !!plan.dom,
      });
    }

    // (Γ, ψ, ζ, ζ′: their library only in a chain that calls them, also from the sheet code)
    src = specialLib(src + sh) + src;
    let cache = null;
    function values() {
      if (cache) return cache;
      const vals = new Float64Array(4 * slots);
      const put = (c, re, im) => { vals[2 * c] = re; vals[2 * c + 1] = im; };
      for (const { plan } of maps) plan.write(put);
      for (const { dp } of dpl) dp.write(put);
      for (const sp of spl.values()) sp.write(put);
      return (cache = vals);
    }
    const sheetList = Funcs.sheetSteps ? Funcs.sheetSteps(steps, built) : [];
    // the inverse program's parts (SPEC 4.1), built on first use: a forward-only draw never pays for them. The steps'
    // on / off flags are taken as they are at the call (stepOps reads only the built steps).
    const onOff = steps.map((st) => (st ? { on: st.on !== false } : null));
    let inverse;
    return {
      key: JSON.stringify(['glc1', sigs]),
      source: src,
      // chainSheetHom and its helpers (the deformation's sheets, notes/v16-user5/SHEETS-DESIGN.md; standards-ok: a spec path in notes/): GLSL to put after
      // source in the programs that call it
      sheetHom: sh,
      get inverse() {
        if (inverse === undefined) {
          try { inverse = buildInverse(onOff, built); } catch (e) { inverse = { ok: false, reason: 'inverse: ' + (e && e.message), key: null }; }
        }
        return inverse;
      },
      slots,
      fill(out) { const v = values(); for (let i = 0; i < v.length; i++) out[i] = v[i]; return out; },
      // live d/dz steps (chainIsDeriv), whether the first is the exact chain rule
      derivs: dks, derivExact: exact,
      cutKinds,
      // multivalued pieces for the sheet view: steps [{k, n, node}] (n sheets, 0: a window of 2W + 1),
      // combos(W, b, a): number of surfaces of the steps in (a, b] (capped at Funcs.SHEET_MAX; total(...) uncapped)
      sheets: {
        steps: sheetList,
        combos: (W = 2, b = steps.length, a = 0) => Funcs.sheetCombos(steps, built, W, b, Funcs.SHEET_MAX, a),
        total: (W = 2, b = steps.length, a = 0) => Funcs.sheetCombos(steps, built, W, b, Infinity, a),
        // a deformation map's pieces (Funcs.sheetMapPieces: chainSheetHom reads their digits), null when it cannot be
        // drawn as sheets
        mapPieces: (map, end) => (Funcs.sheetMapPieces ? Funcs.sheetMapPieces(steps, built, map, end || 0) : null),
      },
    };
  }

  // ---- region formulas: mirror Expr.compileLevel ----
  // levelGLSL(levelAst, name) -> {source, ok}: `float name(vec2 z)`, positive inside, like Expr.compileLevel
  // (a < b gives b − a, a > b gives a − b on real parts, NaN becomes −inf; and = min, or = max, not = −).
  // Constants are baked in as literals (locals, so infinities are allowed); the formula uses the principal branch,
  // as compileLevel does. Needs LIB. levelAst may also be the formula text (parsed with allowRel).
  // On failure, ok is false and the source defines name as −1 everywhere.
  function levelGLSL(levelAst, name = 'cxLevel') {
    const fallback = { source: `float ${name}(vec2 z) { return -1.0; }\n`, ok: false };
    if (!levelAst || !/^[A-Za-z_]\w*$/.test(name)) return fallback;
    const lit = (x) => {
      if (Number.isNaN(x)) return 'cx_nan()';
      if (!Number.isFinite(x)) return x > 0 ? 'cx_inf()' : '-cx_inf()';
      const s = String(Math.fround(x));
      return /[.eE]/.test(s) ? s.replace(/e\+?/, 'e') : s + '.0';
    };
    try {
      if (typeof levelAst === 'string') levelAst = Expr.parse(levelAst, { allowRel: true });
      const vals = new Map();
      let cells = 0;
      // allocator as in build(), but every cell is a local vec2 / vec4 constant of this function
      const A = {
        cell() { const c = cells; cells += 1; const v = `${name}_k${c}`; return { c, v, x: `${v}.x`, y: `${v}.y`, slot: false }; },
        slot() { const c = cells; cells += 2; return { s: c, c, v: `${name}_k${c}`, slot: true }; },
      };
      const kinds = new Map();
      const wrap = (fn) => () => { const r = fn(); kinds.set(r.c, r.slot); return r; };
      A.cell = wrap(A.cell); A.slot = wrap(A.slot);
      const lines = [];
      let part = 0;
      function lv(n) {
        switch (n.t) {
          case 'cmp': {
            const writers = [];
            const P = `${name}_${part++}`;
            const a = genCustom(n.a, `${P}a`, A, 'CX_PI', writers, lines);
            const b = genCustom(n.b, `${P}b`, A, 'CX_PI', writers, lines);
            for (const w of writers) w((c, re, im) => vals.set(c, [re, im]), Math.PI);
            const d = `${P}d`;
            lines.push(`  float ${d} = ${n.op === '<' || n.op === '<=' ? `${b}.x - ${a}.x` : `${a}.x - ${b}.x`};`);
            lines.push(`  if (cx_isnan(${d})) ${d} = -cx_inf();`);
            return d;
          }
          case 'and': { const a = lv(n.a), b = lv(n.b); return `min(${a}, ${b})`; }
          case 'or': { const a = lv(n.a), b = lv(n.b); return `max(${a}, ${b})`; }
          case 'not': return `(-(${lv(n.a)}))`;
        }
        throw new Error($t('Combine comparisons with and / or / not'));
      }
      if (!Expr.hasBool(levelAst)) return fallback;
      const res = lv(levelAst);
      const decl = [];
      for (const [c, isSlot] of [...kinds.entries()].sort((p, q) => p[0] - q[0])) {
        const v0 = vals.get(c) || [0, 0];
        if (isSlot) {
          const v1 = vals.get(c + 1) || [0, 0];
          decl.push(`  vec4 ${name}_k${c} = vec4(${lit(v0[0])}, ${lit(v0[1])}, ${lit(v1[0])}, ${lit(v1[1])});`);
        } else decl.push(`  vec2 ${name}_k${c} = vec2(${lit(v0[0])}, ${lit(v0[1])});`);
      }
      return { source: withSpecial(`float ${name}(vec2 z) {\n${decl.join('\n')}\n${lines.join('\n')}\n  return ${res};\n}\n`), ok: true };
    } catch (e) {
      return fallback;
    }
  }

