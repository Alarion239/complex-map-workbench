const H = process.argv[2] || require("path").resolve(__dirname, "../..");
const C = require(H + '/proto/core.js');
const CSS = 386;
for (const opt of ['sung', 'ring']) for (const fn of C.FUNCS) {
  const g = C.gesture(fn, 'deform'); const ppu = CSS / (2 * fn.view[2]);
  const gates = [];
  const out = { eng: (c) => { if (c.k === 'hv' && c.gate != null) gates.push(`${c.gate ? 'on' : 'off'}@t=${(c.at / 5).toFixed(2)}`); }, voice: (c) => { if (c.gate != null) gates.push(`${c.gate ? 'on' : 'off'}@t=${(c.at / 5).toFixed(2)}`); }, drone() {} };
  const ss = new C.Session(out, opt, {}); ss.start(0, fn, g);
  for (let u = 0; u <= g.dur + 1e-9; u += 1 / 60) ss.frame(u, g.at(u), ppu);
  console.log(opt, fn.id, gates.join(' '));
}
