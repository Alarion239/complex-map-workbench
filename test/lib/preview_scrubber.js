// The export dialog's video preview scrubber, driven by the keyboard (export_deform_classic_cmd.js, export_deform_cmd.js). An expression
// for eval in a suite: `const { scrubberKeys } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'preview_scrubber.js'), 'utf8'))({ ev, key, settled, pvState })`,
// where pvState() is the suite's read of the preview ({ i, n, playing, seek: [value, max, text] }).
// scrubberKeys(): with the preview paused, the scrubber is put on its middle frame by an input event, as a drag does (a loop
// that happens to be paused on its last frame has no frame for Right to go to), then Right, End and Home are sent to it; each
// key's wait ends when the preview shows the frame the key names, or after KEY_WAIT_MS. Answers the states { mid, k0, k1, k2, k3 }
// (k0: on the middle frame; k1, k2, k3: after Right, End and Home) for the suite's own checks, which name the frames they expect.
({ ev, key, settled, pvState }) => {
  const KEY_WAIT_MS = 3000;
  const STATE = '__cmwFig.dialog().preview.state()';
  const onFrame = (i) => settled({ until: `${STATE}.i === ${i}`, max: KEY_WAIT_MS, only: true });
  const scrubberKeys = async () => {
    const mid = Math.floor((await pvState()).seek[1] / 2);
    await ev(`(() => { const sk = document.getElementById('xfPvSeek'); sk.focus(); sk.value = String(${mid}); sk.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
    await onFrame(mid); const k0 = await pvState();
    await key('ArrowRight'); await onFrame(mid + 1); const k1 = await pvState();
    await key('End'); await onFrame(k1.n - 1); const k2 = await pvState();
    await key('Home'); await onFrame(0); const k3 = await pvState();
    return { mid, k0, k1, k2, k3 };
  };
  return { scrubberKeys };
}
