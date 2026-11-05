// What the steps view's paths suites share: the steps view's state and a parked place in its run once the paths of the
// finished selection are drawn. An expression for eval in a suite:
// `const { S, parked } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'steps_paths_kit.js'), 'utf8'))({ ev, settled });`
({ ev, settled }) => {
  const S = () => ev('__cmwSteps()');
  // (parked at x: until a frame has drawn the paths of the finished selection, at most 20 s on a software renderer)
  const parked = async (x) => {
    await ev(`__cmwSteps({ park: ${x} }), 1`);
    await settled({ max: 20000, until: `(() => { const p = __cmwSteps().paths; return !!p.src && p.ready && p.heads > 0 && Math.abs(p.T - p.src.T) < 1e-9; })()` });
    return (await S()).paths;
  };
  return { S, parked };
}
