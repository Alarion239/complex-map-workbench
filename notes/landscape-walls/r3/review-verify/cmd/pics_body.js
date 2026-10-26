const out = [];
const C = [];
C.push({ id: 'user', sheets: false, dark: false, mesh: 1920, T0: 0.05, Tr: 0.2, nPlay: 10, gap: 0, orbit: false, tag: 'V-' });
C.push({ id: 'user', sheets: false, dark: true, mesh: 1920, T0: 0.05, Tr: 0.2, nPlay: 10, gap: 0, orbit: true, tag: 'V-' });
C.push({ id: 'user', sheets: true, dark: false, mesh: 1920, T0: 0.05, Tr: 0.2, nPlay: 8, gap: 0, orbit: true, tag: 'V-' });
C.push({ id: 'user', sheets: false, dark: false, mesh: 240, T0: 0.05, Tr: 0.2, nPlay: 10, gap: 0, orbit: false, tag: 'V-' });
C.push({ id: 'user', sheets: true, dark: true, mesh: 240, T0: 0.05, Tr: 0.2, nPlay: 10, gap: 0, orbit: false, tag: 'V-' });
C.push({ id: 'user', sheets: false, dark: false, phone: true, mesh: 1920, T0: 0.05, Tr: 0.2, nPlay: 8, gap: 0, orbit: false, tag: 'V-' });
C.push({ id: 'user', sheets: false, dark: false, mesh: 1920, T0: 0.05, Tr: 0.2, nPlay: 6, gap: 0, orbit: false, tag: 'V-', page: 'base.html' });
for (const c of C) { const r = await cap(c); out.push({ nm: r.nm, rect: r.rect, shots: r.shots.map((s) => [s[0].split('/').pop(), ...s.slice(1)]), logs: r.logs }); }
await view(1440, 900, false, false);
return out;
