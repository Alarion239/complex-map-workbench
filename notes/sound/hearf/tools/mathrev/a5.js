const H = process.argv[2] || require("path").resolve(__dirname, "../..");
const C = require(H + '/proto/core.js');
for (const CSS of [386, 309, 320]) for (const fn of C.FUNCS) {
  const g = C.gesture(fn, 'deform'); const ppu = CSS / (2 * fn.view[2]);
  const notes = [], pings = [];
  const out = { eng: (c) => { if (c.k === 'cue' && c.wet === 0.18) notes.push(c.at); else if (c.k === 'cue') pings.push(c.at); }, voice() {}, drone() {} };
  const ss = new C.Session(out, 'harp', {}); ss.start(0, fn, g);
  let phi0 = null, phi1, nearT = [];
  for (let u = 0; u <= g.dur + 1e-9; u += 1 / 60) { const p = g.at(u); const fr = ss.frame(u, p, ppu); if (phi0 === null) phi0 = fr.probe.phi; phi1 = fr.probe.phi; if (fr.nearInside) nearT.push(p.t); }
  // strings: count distinct note events (one per string pluck at same time)
  const ev = [...new Set(notes.map((t) => t.toFixed(4)))];
  console.log(CSS, fn.id, 'arg change (turns)', (phi1 - phi0).toFixed(3), 'harp note events', ev.length, 'pings', pings.length, 'near-inside t range', nearT.length ? nearT[0].toFixed(2) + '-' + nearT[nearT.length - 1].toFixed(2) : '-', '|', ss.info);
}
