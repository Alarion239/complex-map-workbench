CASES.user2x = Object.assign({}, CASES.user, { morphSecs: 0.8 });
const out = [];
const C = [
  { id: 'user2x', sheets: false, dark: false, T0: 0.05, Tr: 0.2, nPlay: 8, gap: 0, orbit: false },
  { id: 'user2x', sheets: true, dark: false, T0: 0.05, Tr: 0.2, nPlay: 8, gap: 0, orbit: false },
  { id: 'user', sheets: false, dark: true, mesh: 1920, T0: 0.05, Tr: 0.2, nPlay: 8, gap: 0, orbit: false },
  { id: 'user', sheets: false, dark: false, phone: true, mesh: 1920, T0: 0.05, Tr: 0.2, nPlay: 10, gap: 0, orbit: false },
  { page: 'base/test.html', id: 'user', sheets: false, dark: false, mesh: 1920, T0: 0.05, Tr: 0.2, nPlay: 8, gap: 0, orbit: false },
];
for (const c of C) { const r = await cap(c); out.push({ nm: r.nm, rect: r.rect, shots: r.shots.map((s) => [s[0].split('/').pop(), ...s.slice(1)]), logs: r.logs }); }
await view(1440, 900, false, false);
return out;
