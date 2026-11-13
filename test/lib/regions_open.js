// The regions suites' front (regions_phase_cmd.js, regions_phase_classic_cmd.js): a command file evaluates this file's
// text, `eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'regions_open.js'), 'utf8'))`, and calls the function it
// gives with the kit's helpers: ({ U, ev, send, go, sleep, settled }) => { DISC, STATE, openSaved, popFit }.
//   DISC, STATE(o)       a unit disc under exp, and a saved state around it with the fields of o set
//   openSaved(ns, st, lang)
//                        the app with the saved state st written straight to its storage (not the kit's load(), which
//                        sets a seeded pattern through the test hook): what a user's own saved work does; lang, when
//                        given, is the page's language
(({ U, ev, send, go, sleep, settled }) => {
  const DISC = { id: 's1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true };
  const STATE = (o) => Object.assign({
    v3: true, v4: true, shapes: [DISC], steps: [{ type: 'exp', params: {}, on: true }], nextId: 50, focus: 0,
    rightMode: 'image', srcView: { cx: 0, cy: 0, s: 80 },
  }, o);
  const openSaved = async (ns, st, lang) => {
    await send('Page.navigate', { url: `${U}/gl-helpers.html` }); await sleep(350);
    await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
    await go(`${U}/test.html?ns=${ns}${lang ? `&lang=${lang}` : ''}`);
    await settled({ only: true, max: 60000, until: `typeof __cmwRegions === 'function'` });
    await settled({ floor: 800 });
  };
  const popFit = async (lang, o) => {
    await openSaved(`rgph-fit-${lang}-${Date.now() % 1000000}`, STATE({}), lang);
    if (o.prep) { await ev(o.prep); await settled({ floor: 800 }); }
    await ev(`document.querySelector(${JSON.stringify(o.btn)}).click()`);
    await settled({ floor: 500, until: `!!document.querySelector(${JSON.stringify(o.pop)})` });
    const fit = await ev(`(() => {
      const p = document.querySelector(${JSON.stringify(o.pop)});
      if (!p || !p.querySelector('#regionsBox')) return null;
      const out = [p, ...p.querySelectorAll('*')]
        .filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1
          && getComputedStyle(e).overflowX !== 'visible')
        .map((e) => (e.id || e.className || e.tagName) + ' ' + e.scrollWidth + '/' + e.clientWidth);
      return { out, pw: Math.round(p.getBoundingClientRect().width) };
    })()`);
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`);
    await settled({ floor: 300 });
    return fit;
  };
  return { DISC, STATE, openSaved, popFit };
})
