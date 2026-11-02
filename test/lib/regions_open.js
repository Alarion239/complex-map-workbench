// The regions suites' front (regions_phase_cmd.js, regions_phase_classic_cmd.js): a command file evaluates this file's
// text, `eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'regions_open.js'), 'utf8'))`, and calls the function it
// gives with the kit's helpers: ({ U, ev, send, nav, sleep, settled }) => { DISC, STATE, openSaved }.
//   DISC, STATE(o)       a unit disc under exp, and a saved state around it with the fields of o set
//   openSaved(ns, st)    the app with the saved state st written straight to its storage (not the kit's load(), which
//                        sets a seeded pattern through the test hook): what a user's own saved work does
(({ U, ev, send, nav, sleep, settled }) => {
  const DISC = { id: 's1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true };
  const STATE = (o) => Object.assign({ v3: true, v4: true, shapes: [DISC], steps: [{ type: 'exp', params: {}, on: true }], nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 80 } }, o);
  const openSaved = async (ns, st) => {
    await send('Page.navigate', { url: `${U}/gl-helpers.html` }); await sleep(350);
    await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
    await nav(`${U}/test.html?ns=${ns}`);
    for (let i = 0; i < 200 && !(await ev(`typeof __cmwRegions === 'function'`)); i++) await sleep(100);
    await settled({ floor: 800 });
  };
  return { DISC, STATE, openSaved };
})
