// What the Repeat suites share: pressing a control and picking a menu item as a pointer does, typing into the Repeat row's N
// field, and the chain's repeats as a string. An expression for eval in a suite:
// `const { press, pickItem, typeN, chain } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'repeat_kit.js'), 'utf8'))({ ev, settled });`
({ ev, settled }) => {
  const press = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); e.click(); return true; })()`);
  const pickItem = (label) => ev(`(() => { const b = [...document.querySelectorAll('#popHost .menu .mi')].find((x) => x.querySelector('.mi-label').textContent === ${JSON.stringify(label)}); if (!b || b.disabled) return false; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); b.click(); return true; })()`);
  // (the row's N field: typed and changed, as a user does; the row shows for a selected step of the block)
  const typeN = async (text) => { await ev(`(() => { const f = document.querySelector('.insp-repeat .rep-n'); f.focus(); f.value = ${JSON.stringify(text)}; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`); await settled({}); };
  const chain = async () => (await ev('__cmwP()')).steps.map((s) => s.type + (s.repeat ? `[${s.repeat.n}/${s.repeat.len}]` : '')).join(',');
  return { press, pickItem, typeN, chain };
}
