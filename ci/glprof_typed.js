'use strict';
// The typed-formula walk of ci/glprof.js (--walk typed): how long a custom formula takes to link on this machine's
// shader compiler, the way a person meets it. The steps view opens on one custom step; per formula of CORPUS:
//   pasted: the field set at once, the links that edit starts (the programs of the plane drawn, the glide's prestarts and the
//           Landscape's warm-ups); then the first glide on the plane and on the globe (its links, and the time from
//           the glide's start to its first exact frame: the inverse pass drawing it, not the carried mesh)
//   typed:  the same formula typed into the field one character at a time, `type-ms` apart (every speed of SPEEDS), the
//           links of every prefix the page compiles on the way and the ones of the final formula
// The five-Möbius case is also the chain of five custom steps (each field set at once).
// Each variant runs in a browser of its own with its own program cache (the variants share no program), cold first
// and then warm, as glprof's passes do. Per step the result carries { longMs, long }: the longest main-thread task
// (and how many tasks over 50 ms) from the step's start until its links landed; a glide step also firstS: seconds
// from the start of the glide to its first exact frame (null: none before the glide ended).
// A pass stops opening new formulas once it has spent its budget (the cold pass notes what it left out, the warm pass
// leaves out the same), so the walk's length is bounded on a slow compiler.
const fs = require('fs');

const FRAC = (f) => `((${f}-0.5)/(1-0.5(${f})))`;
// five Möbius maps (z -> (z-0.5)/(1-0.5z)) composed in one formula
const MOEBIUS5 = [1, 2, 3, 4, 5].reduce((f) => FRAC(f), 'z');
const MOEBIUS_STEP = '(z-0.5)/(1-0.5z)';
const CORPUS = [
  { label: 'exp(sin z)', expr: 'exp(sin(z))' },
  { label: 'log(z^2+1)', expr: 'log(z^2+1)' },
  { label: 'sin(z)/z', expr: 'sin(z)/z' },
  { label: 'z^3-2z+1', expr: 'z^3-2z+1' },
  { label: 'sum of 10 terms', expr: 'sin(z)+cos(2z)+exp(z/3)+log(z+2)+z^5+1/(z-1)+sqrt(z)+tan(z/2)+sinh(z)+z^2*exp(-z)' },
  { label: '10 logs', expr: 'log(z-1)+log(z+1)+log(z-i)+log(z+i)+log(z-2)+log(z+2)+log(z-2i)+log(z+2i)+log(z-3)+log(z+3)' },
  { label: 'five Moebius maps, one formula', expr: MOEBIUS5 },
  { label: 'five Moebius maps, five steps', steps: [1, 2, 3, 4, 5].map(() => MOEBIUS_STEP) },
  { label: 'gamma(z)*zeta(z)', expr: 'gamma(z)*zeta(z)' },
];
const START = 'z^2+1';
// (the quiet time a step waits with no link open: the page starts a step's later links (the glide's prestarts, the Landscape's
// warm-ups) seconds after its first)
const QUIET_S = 3;

// the page side: the main-thread long tasks from the first script on; __gpLong(t0) the longest one (ms) that ended
// after t0 (performance.now()) and how many there were
const PROBE = `(() => {
  const lt = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* none */ }
  window.__gpLong = (t0) => { let m = 0, n = 0; for (const [s, d] of lt) if (s + d >= t0) { n++; m = Math.max(m, d); } return { longMs: Math.round(m), long: n }; };
})();`;

const savedState = (exprs) => ({ v3: true, v4: true, shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }],
  steps: exprs.map((expr) => ({ type: 'custom', params: { expr, cut: 180 }, on: true })), nextId: 50, focus: 0, rightMode: 'image' });
const FIELD = `document.querySelector('input[data-pkey="expr"]')`;
const setField = (text, change) => `(() => { const i = ${FIELD}; if (!i) return false; i.focus(); i.value = ${JSON.stringify(text)}; i.dispatchEvent(new Event('input', { bubbles: true }));${change ? " i.dispatchEvent(new Event('change', { bubbles: true })); i.blur();" : ''} return true; })()`;
// the glide's first exact frame: the plane's last frame between two planes is a new record drawn by the inverse pass;
// the globe's, the inverse pass between two planes, past the start (the plane's record of an earlier glide is told apart by identity)
const exactNow = (globe) => (globe
  ? '(() => { const g = __cmwSvGlobe(0, 0); return g.path === "inverse" && g.b !== g.a && g.u > 0; })()'
  : '(() => { const g = __cmwSteps().glide; return !!g && g !== window.__gpRec0 && g.path === "inverse"; })()');

// -> async (name, base, tag) => { pass, renderer, steps } as glprof's pass()
function typedWalk({ launch, settler, sleep, SC, cache, speeds, budgetS, filter, maxChars, stepS, log }) {
  const skipped = new Set();   // 'variant|label' left out by the cold pass's budget
  const corpus = CORPUS.filter((c) => !filter || filter.test(c.label));
  const variants = [{ ms: 0, name: 'pasted' }, ...speeds.map((ms) => ({ ms, name: `typed at ${ms} ms` }))];

  async function variantPass(name, base, tag, v) {
    const B = await launch({ cache: `${cache}-typed${v.ms}`, inject: PROBE });
    const out = { pass: name, renderer: '', steps: [] };
    const t00 = Date.now();
    let pageOff = 0, maxEnd = 0;   // (a page's programs' start times are its own clock's: each page after the first is moved past the one before)
    try {
      const open = async (exprs) => {
        if (out.steps.length) pageOff = maxEnd + 1000;
        const ns = `glprof${Date.now()}`;
        await B.nav(`${base}blank.html`);
        await B.ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(savedState(exprs)))}); 1`);
        await B.nav(`${base}test.html?glprof&view=steps&ns=${ns}`);
        await B.until('typeof GLR === "object" && typeof GLR.profile === "function" && typeof __cmwSteps === "function" && __cmwSteps().on', 120000);
      };
      await open([START]);
      out.renderer = await B.ev(`(() => { const g = document.createElement('canvas').getContext('webgl2'), x = g && g.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : ''; })()`);
      let settle = settler(B, QUIET_S);
      const mark = () => B.ev('window.__gpMark = performance.now()');
      const done = async (label, extra) => {
        const st = await settle(`typed ${v.name}: ${label}`);
        Object.assign(st, await B.ev('__gpLong(window.__gpMark || 0)'), extra);
        for (const p of st.programs) { p.t0 += pageOff; maxEnd = Math.max(maxEnd, p.t0 + Math.max(0, p.ms || 0)); }
        out.steps.push(st);
        const ms = st.programs.reduce((a, p) => a + Math.max(0, p.ms || 0), 0);
        log(`[glprof] ${tag}${name} ${st.label}: ${st.programs.length} links, ${(ms / 1000).toFixed(1)} s of link time, longest task ${st.longMs} ms${st.firstS !== undefined ? `, first exact frame ${st.firstS === null ? 'none' : st.firstS.toFixed(1) + ' s'}` : ''}${st.timedOut ? ' (TIMED OUT)' : ''}`);
        return st;
      };
      await mark();
      await done('start (the opening formula)');
      // a glide, its first exact frame timed from the statement on; then it is run to its end
      const glide = async (label, globe) => {
        await B.ev(`window.__gpRec0 = ${globe ? 'null' : '__cmwSteps().glide'}; 1`);
        await mark();
        const t1 = Date.now();
        await B.ev(SC.glide('last'));
        let firstS = null, moved = false, still = 0;
        for (;;) {
          const r = await B.ev(`(() => { try { return [${exactNow(globe)}, !!__cmwSteps().moving]; } catch (e) { return [false, false]; } })()`);
          if (r[0]) { firstS = (Date.now() - t1) / 1000; break; }
          if (r[1]) moved = true;
          still = moved && !r[1] ? still + 1 : 0;
          if (still > 10 || Date.now() - t1 > stepS * 1000) break;
          await sleep(50);
        }
        const st = await done(label, { firstS });
        await B.until(`!(${SC.moving()})`, stepS * 1000, 250).catch(() => {});
        return st;
      };
      for (const c of corpus) {
        const key = `${v.ms}|${c.label}`;
        const long = (c.expr || '').length > maxChars;
        if (v.ms && (long || c.steps)) continue;   // (typed: only what a person could type, in one field)
        if (name === 'cold' ? (Date.now() - t00) / 1000 > budgetS : skipped.has(key)) { skipped.add(key); log(`[glprof] ${tag}${name} ${c.label} (${v.name}): left out, over the ${budgetS} s budget`); continue; }
        if (c.steps) {
          await open(c.steps.map(() => 'z'));
          settle = settler(B, QUIET_S);
          await mark();
          await done(`${c.label}: start (five identity steps)`);
          await mark();
          for (let k = 0; k < c.steps.length; k++) await B.ev(`__cmwStepParam(${k}, 'expr', ${JSON.stringify(c.steps[k])})`);
          await done(`${c.label}: pasted`);
        } else {
          await B.until(`!!${FIELD}`, 30000, 100);
          await mark();
          if (!v.ms) await B.ev(setField(c.expr, true));
          else {
            await B.ev(setField('', false));
            for (let n = 1; n <= c.expr.length; n++) { await B.ev(setField(c.expr.slice(0, n), false)); await sleep(v.ms); }
            await B.ev(setField(c.expr, true));
          }
          await done(`${c.label}: ${v.ms ? `typed at ${v.ms} ms` : 'pasted'}`);
        }
        if (!v.ms) {
          await glide(`${c.label}: first glide`, false);
          await B.ev(SC.glideBack());
          await B.ev(SC.surface('sphere'));
          await mark();
          await done(`${c.label}: the globe opened`);
          await glide(`${c.label}: first glide on the globe`, true);
          await B.ev(SC.glideBack());
          await B.ev(SC.surface('plane'));
          await mark();
          await done(`${c.label}: back to the plane`);
        }
        if (c.steps) { await open([START]); settle = settler(B, QUIET_S); await mark(); await done('start again (the opening formula)'); }
      }
    } finally { await B.close(); }
    return out;
  }

  return async (name, base, tag) => {
    if (name === 'cold') for (const v of variants) fs.rmSync(`${cache}-typed${v.ms}`, { recursive: true, force: true });
    const all = { pass: name, renderer: '', steps: [] };
    let off = 0;
    for (const v of variants) {
      const r = await variantPass(name, base, tag, v);
      all.renderer = all.renderer || r.renderer;
      // (each variant's browser has its own clock: the programs' start times are moved so no two variants overlap)
      let end = off;
      for (const s of r.steps) for (const p of s.programs) { p.t0 += off; end = Math.max(end, p.t0 + Math.max(0, p.ms || 0)); }
      off = end + 1000;
      all.steps.push(...r.steps);
    }
    return all;
  };
}

module.exports = { typedWalk, CORPUS, START, MOEBIUS5, PROBE };
