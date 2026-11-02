// The page both phase-key suites open: a rect shape and a recurrence step, saved under a fresh namespace, at width w, in language lang
// ('' is English). An expression for eval in a suite: `const openApp = eval(fs.readFileSync(...))` (the kit's view, send, ev and sleep
// are the suite's own).
(() => {
  const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
  const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
  return async (lang, w) => {
    const ns = 'pk' + Date.now();
    await view(w, 800, false, false);
    await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
    const o = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's1', kind: 'rect', a: [-2, -2], b: [2, 2] }], steps: [{ type: 'recurrence', params: { u0: '0', g: 'u^2+z', N: 12, cut: 180 }, on: true }], nextId: 50, focus: 0, rightMode: 'color' };
    await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
    await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}${lang ? '&lang=' + lang : ''}` }); await sleep(2300);
    await settle(800);
  };
})()
