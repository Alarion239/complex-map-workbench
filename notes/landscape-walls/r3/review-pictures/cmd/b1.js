const out = [];
const C = [];
for (const dark of [false, true]) for (const sheets of [true, false]) C.push({ id: 'user', sheets, dark, T0: 0.05, Tr: 0.2, nPlay: 12, gap: 0 });
C.push({ id: 'user', sheets: true, dark: false, mesh: 1920, T0: 0.05, Tr: 0.2, nPlay: 12, gap: 0 });
C.push({ id: 'user', sheets: false, dark: false, mesh: 1920, T0: 0.05, Tr: 0.2, nPlay: 12, gap: 0 });
C.push({ id: 'user', sheets: true, dark: true, mesh: 1920, T0: 0.05, Tr: 0.2, nPlay: 12, gap: 0 });
for (const dark of [false, true]) for (const sheets of [true, false]) C.push({ id: 'user', sheets, dark, phone: true, T0: 0.05, Tr: 0.05, nPlay: 12, gap: 0 });
C.push({ id: 'user', sheets: true, dark: true, phone: true, mesh: 1920, T0: 0.05, Tr: 0.2, nPlay: 12, gap: 0 });
for (const c of C) { const r = await cap(c); out.push({ nm: r.nm, rect: r.rect, shots: r.shots.map((s) => [s[0].split('/').pop(), ...s.slice(1)]), logs: r.logs }); }
await view(1440, 900, false, false);
return out;
