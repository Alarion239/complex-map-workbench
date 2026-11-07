// The classic deformation's test controls (the M key, the digit keys and the play key are gone; the page's hooks are not).
// Used by a command file for a CDP daemon: const { morphKey, mainView, morphPlayKey } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'morph_keys.js'), 'utf8'))({ ev, settled });
// Each waits for its own effect: morphKey for the deformation to be open (or closed), mainView and morphPlayKey for the page to be quiet.
({ ev, settled }) => ({
  morphKey: async () => {
    const want = !(await ev('__cmwMorph().open'));
    await ev(`__cmwMorph({ open: ${want} }); 1`);
    await settled({ until: `__cmwMorph().open === ${want}` });
  },
  mainView: async (m) => { await ev(`__cmwSetMain(${JSON.stringify(m)}); 1`); await settled(); },
  morphPlayKey: async () => { await ev('__cmwMorph({ togglePlay: true }); 1'); await settled(); },
})
