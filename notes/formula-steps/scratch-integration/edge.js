const { split, setA } = require('./symtext.js');
const C = CX.C;
// an undefined name (the palette before the slider exists): value 0
Expr.setNames({ get: (n) => undefined, display: (n) => n });
for (const q of ['z^a', 'az+1', '(z-a)^3', 'z+a']) { const b = Funcs.build({ type: 'custom', params: { expr: q, cut: 180 }, on: true }); console.log('undefined a:', q, b.error || (b.rec ? b.rec.steps.map((s) => s.type).join('>') : 'not recognized')); }
const { split: sp2, setA: s2 } = require('./symtext.js');
Expr.setNames({ get: (n) => (n === 'a' ? 1 : undefined), display: (n) => n });
for (const q of ['\\frac{z^2-a}{z+1}', '\\frac{az+1}{z+a}']) { const b = Funcs.build({ type: 'custom', params: { expr: q, cut: 180 }, on: true }); console.log('a = 1:', q, b.error || (b.rec ? b.rec.steps.map((s) => s.type).join('>') : 'not recognized')); }
Expr.setNames({ get: (n) => (n === 'a' ? 0.7 : undefined), display: (n) => n });
const deep = '\\sin(\\sin(\\sin(\\sin(\\sin(\\sin(\\sin(\\sin(\\sin(\\sin(\\sin(\\sin(z))))))))))))';
const b = Funcs.build({ type: 'custom', params: { expr: deep, cut: 180 }, on: true }); console.log('12 sines:', b.rec ? b.rec.steps.length + ' steps' : 'not recognized');
const t0 = process.hrtime.bigint(); for (let i = 0; i < 200; i++) split('\\log\\frac{1+z}{1-z}'); console.log('split cost ms/call', Number(process.hrtime.bigint() - t0) / 1e6 / 200);
