const K = require('./load.js');
const Gu = K.pieces({ kind: 'circle', c: [0, 0], r: 1 })[0].G;
const show = (lab, Gc, P, Q) => { const r = K.perpForm(Gc, P, Q); if (r.undef) return console.log(lab, 'undef', r.undef); const g = K.geomOf(r.G); console.log(lab, g.line ? 'LINE p=' + g.p + ' d=' + g.d : 'circle c=' + g.c.map((x) => x.toPrecision(6)) + ' r=' + g.r.toPrecision(6)); };
show('unit, 0.5 & 2     ', Gu, [0.5, 0], [2, 0]);
show('unit, 0.2 & 5     ', Gu, [0.2, 0], [5, 0]);
show('unit, 0.1 & 10    ', Gu, [0.1, 0], [10, 0]);
show('unit, 0.4 & 2.5   ', Gu, [0.4, 0], [2.5, 0]);
show('unit, .1+.2i & 2+4i', Gu, [0.1, 0.2], [2, 4]);
show('unit, .3+.4i & 1.2+1.6i', Gu, [0.3, 0.4], [1.2, 1.6]);
show('unit, .6+.8i & .6+.8i on C?', Gu, [0.6, 0.8], [0.3, 0.4]);
const Gl = K.pieces({ kind: 'line', a: [0, 0], b: [1, 2] })[0].G;
show('line 0->1+2i, -.1+.3i & .3+.1i', Gl, [-0.1, 0.3], [0.3, 0.1]);
const C2 = K.pieces({ kind: 'circle', c: [0.1, 0.1], r: 0.5 })[0].G;   // P* of 0.3+0.1i: c + r^2/(conj(P-c)) = 0.1+0.1i + 0.25/0.2 = 1.35+0.1i
show('circle c=.1+.1i r=.5, .3+.1i & 1.35+.1i', C2, [0.3, 0.1], [1.35, 0.1]);
// also: the user's sanity case, as in the hyperbolic half-plane model: C = real axis by 2 grid points
const Gr = K.pieces({ kind: 'line', a: [0, 0], b: [1, 0] })[0].G;
show('real axis, .1+.2i & .1-.2i', Gr, [0.1, 0.2], [0.1, -0.2]);
