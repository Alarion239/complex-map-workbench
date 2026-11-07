// What the steps view's per-plane key suites share (steps_plane_key_cmd.js on a laptop, steps_phone_key_cmd.js on a phone):
// the page they open (example 1 in the steps view), parking the thread and T, the pane's legend, and the sweep over every
// surface, place of T and plane that checks the key's kind and caption. An expression for eval in a suite:
// `const K = eval(fs.readFileSync(...))` (the suite's own view, go, ev, settled and sleep are used; call view() first).
({
  PLANE: ['z', 'w₁', 'w₂'],
  START_WAIT: 120000,   // how long the page may take to start up, ms
  START_POLL: 500,      // how often the start-up wait looks, ms
  // opens example 1 in the steps view (in `lang` when given); -> the number of planes
  open: async function (ns, port, lang) {
    this.lang = lang || 'en';
    await go(`http://localhost:${port}/test.html?view=steps&ns=${ns}${Date.now() % 1e7}${lang ? '&lang=' + lang : ''}`);
    await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps', max: 30000 });
    // (a slow runner is still starting up when that wait ends: wait for the hooks the suites call, as long as it takes)
    for (let t0 = Date.now(); Date.now() - t0 < this.START_WAIT && !(await ev('typeof __cmwSteps === "function" && typeof __cmwLegend === "function" && typeof __cmwExample === "function"').catch(() => false)); ) await sleep(this.START_POLL);
    await ev(`(__cmwExample(1), 1)`);
    await settled({ until: '__cmwSteps().planes.length > 1', max: 15000 });
    await ev(`(__cmwSteps({ surf: 'plane' }), 1)`);
    return ev('__cmwSteps().planes.length');
  },
  next: () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))'),
  legend: async () => JSON.parse(await ev('JSON.stringify(__cmwLegend())')),
  // T at plane T, the thread parked at plane i (settled); -> the legend
  park: async function (T, i) {
    await ev(`(__cmwSteps({ T: ${T} }), __cmwSteps({ go: ${i}, now: true }), 1)`);
    await settled({ until: `!__cmwSteps().moving && __cmwSteps().i === ${i}`, max: 15000 });
    return this.legend();
  },
  // what the key shows on the surface (plane, sphere, land) with T at plane T and the thread at plane i: on a plane up to T the
  // style's key, past T the hue ring with the plane its colour is carried from, on the Landscape the height key
  // (in another language than English only the kind is checked: the captions are translated)
  expectKey: function (ok, name, surf, T, i, lg) {
    if (this.lang && this.lang !== 'en') {
      const kind = surf === 'land' ? '3d' : surf === 'sphere' && i <= T ? 'sphere' : 'color';
      ok(`${name}: the key's kind`, lg.kind === kind && !!lg.caption, lg);
    } else if (surf === 'land') ok(`${name}: the height key`, lg.kind === '3d' && lg.caption === 'height log |F|', lg);
    else if (i > T) ok(`${name}: the hue ring, colour carried from ${this.PLANE[T]}`, lg.kind === 'color' && lg.caption === `colour carried from ${this.PLANE[T]}`, lg);
    else ok(`${name}: the style's key, no carried line`, lg.kind === (surf === 'sphere' ? 'sphere' : 'color') && /^arg and \|/.test(lg.caption || ''), lg);
  },
  // every surface, place of T and plane: park, check the key, then `more(name, lg)` for what a suite adds
  sweep: async function (ok, info, nPl, more) {
    for (const surf of ['plane', 'sphere', 'land']) {
      await ev(`(__cmwSteps({ surf: '${surf}' }), 1)`);
      for (let T = 0; T < nPl; T++) {
        for (let i = 0; i < nPl; i++) {
          const lg = await this.park(T, i), name = `${surf}, T at plane ${T}, plane ${i}`;
          info[name] = { lg };
          this.expectKey(ok, name, surf, T, i, lg);
          if (more) await more(name, lg);
        }
      }
    }
  },
})
