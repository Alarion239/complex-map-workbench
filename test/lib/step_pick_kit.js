// Picking a step on the steps view's thread: its chip (or the whole-map chip for F), pressed as a pointer does, and the
// selection asserted, so that no check reads the Inspector of a step that was not chosen. An expression for eval in a suite:
// `const { selectStep } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'step_pick_kit.js'), 'utf8'))({ ev, settled, ok });`
({ ev, settled, ok }) => {
  const selectStep = async (k) => {
    const sel = k === 'F' ? '#svStrip .sv-wholemap' : `#svStrip .sv-step[data-k="${k}"] .sv-fchip`;
    const hit = await ev(`(() => { const c = document.querySelector(${JSON.stringify(sel)}); if (!c) return false; c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); c.click(); return true; })()`);
    await settled({ max: 10000, until: `__cmwSteps().sel === ${JSON.stringify(k)} && !!document.querySelector('#propsPanel .iform')` });
    const got = await ev('__cmwSteps().sel');
    ok(`the chip of ${k === 'F' ? 'F' : 'step ' + k} selects it`, hit && got === k, { hit, got });
  };
  return { selectStep };
}
