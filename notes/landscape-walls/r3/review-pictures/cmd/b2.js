const out = [];
const C = [];
const P = { T0: 0.3, Tr: 1, nPlay: 10, gap: 0 };
for (const [id, list] of Object.entries({
  tan: [[0, 0, 240], [1, 0, 240], [0, 0, 1920], [1, 1, 240]],
  sec: [[0, 0, 240], [1, 0, 1920], [0, 1, 240]],
  loglog: [[0, 0, 240], [1, 0, 240], [0, 0, 1920], [0, 1, 240]],
  expinv: [[0, 0, 240], [1, 0, 240], [0, 0, 1920]],
  z15tan: [[0, 0, 240], [1, 0, 240], [0, 0, 1920], [1, 1, 240]],
})) for (const [dark, phone, mesh] of list) C.push(Object.assign({ id, dark: !!dark, phone: !!phone, mesh }, P));
for (const c of C) { const r = await cap(c); out.push({ nm: r.nm, rect: r.rect, shots: r.shots.map((s) => [s[0].split('/').pop(), ...s.slice(1)]), logs: r.logs }); }
await view(1440, 900, false, false);
return out;
