const R = '<project>/work/xvr-final-snap';
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
const C = CX.C; let A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : undefined), display: (n) => n });
const item = (v) => CX.fmtExact(C(v.re === 0 ? 0 : v.re, v.im === 0 ? 0 : v.im)).replace(/\s+/g, '');
const show = (s) => { const v = s.vals || {}; const o = {}; for (const k in v) { const x = v[k]; o[k] = k === 'ast' ? Expr.toTex(x).s : Array.isArray(x) ? x.map(item).join(', ') : x && typeof x === 'object' && 're' in x ? item(x) : x; } return s.type + (Object.keys(o).length ? JSON.stringify(o) : ''); };
const list = process.argv.slice(2).length ? process.argv.slice(2) : ['\\sin(z^2+1)', '\\frac{2z+1}{z-1}', 'e^{iz}+e^{-iz}', 'z^{i}', '(z-a)^3', '\\sqrt{1-z^2}', '\\log\\frac{1+z}{1-z}', 'z^2+\\sin z', '\\frac{1}{z}+z',
 'sin z', '\\sin z', 'sin(z)', 'tg z', 'e^z', 'exp z', 'log z', 'ln z', 'sqrt z', '\\sqrt[3]{z}', 'z^3', 'z^{i}', '1/z', '2z+1', '(z-1)/(z+1)', 'z+1/z', 'conj z', '\\bar z', '\\bar{z}', '\\frac12(z+\\frac1z)', 'z^a', 'z+a', 'az+1', '\\frac{az+1}{z+a}', '\\log(-z)', 'sin 2z', 'sin(2z)', 'e^{2z}', '\\cos z/2', 'z^2', 'z^{1/2}', 'z^{0.5}', 'arcsin z', 'sh z', 'ch z', 'th z', 'arctg z', 'z', '3', 'z^2+1', 'z^3+2z', '(z-1)^2(z+2)', '\\frac{z^2-a}{z+1}', '|z|', '\\sin z + z', '\\log(z^z)', 'cot z', '1/(1+e^{-z})', 'e^{z^2}', '\\cosh z'];
for (const q of list) {
  let b; try { b = Funcs.build({ type: 'custom', params: { expr: q, cut: 180 }, on: true }); } catch (e) { console.log(q, 'ERR', e.message); continue; }
  if (b.error) { console.log(q.padEnd(26), 'error:', b.error); continue; }
  console.log(q.padEnd(26), b.rec ? (b.rec.partial ? 'PARTIAL ' : '') + b.rec.steps.map(show).join('  →  ') + '   groups:' + JSON.stringify(b.rec.groups.map(g => [g.from, g.to])) : 'not recognized');
}
