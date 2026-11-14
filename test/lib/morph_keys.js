// The classic deformation's test controls (the M key, the digit keys and the play key are gone; the page's hooks are not).
// Used by a command file for a CDP daemon: const { morphKey, mainView, morphPlayKey } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'morph_keys.js'), 'utf8'))({ ev, settled });
// Each waits for its own effect: morphKey for the deformation to be open (or closed), mainView and morphPlayKey for the page to be quiet,
// playAdv(n) until the play has advanced n steps (a wrap counts from 0), playWrapped() until it has wrapped, playEnded() until it stopped.
({ ev, settled }) => ({
  morphKey: async () => {
    const want = !(await ev('__cmwMorph().open'));
    await ev(`__cmwMorph({ open: ${want} }); 1`);
    await settled({ until: `__cmwMorph().open === ${want}` });
  },
  mainView: async (m) => { await ev(`__cmwSetMain(${JSON.stringify(m)}); 1`); await settled(); },
  morphPlayKey: async () => { await ev('__cmwMorph({ togglePlay: true }); 1'); await settled(); },
  playAdv: async (n) => {
    await ev('window.__pl = { last: __cmwMorph().T, adv: 0, wraps: 0 }; 1');
    await settled({ only: true, max: 20000, until: `(() => { const p = window.__pl, T = __cmwMorph().T; if (T >= p.last) p.adv += T - p.last; else { p.adv += T; p.wraps++; } p.last = T; return p.adv >= ${n}; })()` });
  },
  playWrapped: async () => {
    await ev('window.__pl = { last: __cmwMorph().T, wraps: 0 }; 1');
    await settled({ only: true, max: 20000, until: `(() => { const p = window.__pl, T = __cmwMorph().T; if (T < p.last) p.wraps++; p.last = T; return p.wraps >= 1; })()` });
  },
  playEnded: async () => { await settled({ only: true, max: 20000, until: '!__cmwMorph().playing' }); },
})
