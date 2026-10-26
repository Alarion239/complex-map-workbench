globalThis.__mesh = [1920, 240]; globalThis.__noOrbit = false; globalThis.__views = [[1440, 900, false]];
const out = [];
const PAGES = globalThis.__pages || ['test.html', 'base/test.html'];
const VIEWS = globalThis.__views || [[1440, 900, false]];
const MESH = globalThis.__mesh || [1920, 240];
const DARK = !!globalThis.__dark;
for (const [vw, vh, mobile] of VIEWS) for (const meshN of MESH) for (const page of PAGES) {
  await view(vw, vh, DARK, mobile);
  const tag = `${vw} m${meshN}`;
  if (!globalThis.__noOrbit) {
    await ld(page, 'pf' + Date.now(), { meshN, shapes: [], steps: [{ type: 'tan', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: false, height: 're' });
    await settle(1200); await ev('__cmwSetMain("land")'); await settle(2500);
    const r = await ev(`(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return [b.left + b.width * 0.5, b.top + b.height * 0.5, b.width]; })()`);
    const fp = ev('await (async () => await __qa.frames(2400))()', 30000);
    await drag(r[0] - r[2] * 0.3, r[1], r[0] + r[2] * 0.3, r[1] + 10, 140, 16);
    out.push({ page, tag, what: 'mouse-orbit tan Re', ...(await fp) });
  }
  for (const sh of (globalThis.__sh || [false, true])) {
    await ld(page, 'pfp' + sh + Date.now(), { meshN, shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [sq, sn], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: sh, height: 'im' });
    await settle(1500); await ev('__cmwSetMain("land")'); await settle(1500);
    await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(1200);
    await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(900);
    const play = await ev('await (async () => await __qa.frames(3000))()', 30000);
    await ev('__cmwMorph({ playing: false })');
    out.push({ page, tag, what: `play sin √z Im${sh ? ' AllSh' : ''}`, ...play });
  }
}
await view(1440, 900, false, false);
return { lines: out.map((r) => `${r.page.padEnd(15)} ${r.tag.padEnd(10)} ${r.what.padEnd(24)} fps ${r.fps} p50 ${r.p50} p95 ${r.p95} max ${r.max}`), logs: logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 6) };
