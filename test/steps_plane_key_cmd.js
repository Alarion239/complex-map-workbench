// The steps view's key on each surface, read from the pane's legend (__cmwLegend: kind and caption) with the thread parked at each
// plane of example 1, for each place of T (the colour plane). The pane draws its own key: on plane T the style's key, named
// after the map its colour is read from; on every other plane, before T and past it, the hue ring with the line saying which
// plane its colour is carried from; on the Landscape the height key, whatever T is. The classic views' key under the image (keyUnder) has no steps
// counterpart; this key is what a reader reads a colour by. A plane that draws no carried hue keeps its own key: the Cauchy style's
// plane z with T elsewhere is paper, and its key stays the reason alone (test/steps_cauchy_cmd.js and steps_cauchy_parts_cmd.js), and a plane
// before a d/dz step shows shapes only and has no key. The key follows T in the frame it moves in.
// A command file for a CDP daemon:  <runner> test/steps_plane_key_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'plane_key_kit.js'), 'utf8'));
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const nPl = await K.open('planekey', PORT);
ok('example 1 has three planes', nPl === 3, nPl);
await K.sweep(ok, info, nPl);
// moving T re-reads the key in the frame it moves in (no wait for the thread)
await ev(`(__cmwSteps({ surf: 'plane' }), 1)`);
await K.park(2, 2);
await ev(`(__cmwSteps({ T: 1 }), 1)`); await K.next();
const moved = await K.legend();
ok('plane 2 after T moves from plane 2 to plane 1: the key is already the carried line', moved.caption === 'colour carried from w₁', moved);
await ev(`(__cmwSteps({ T: 2 }), 1)`); await K.next();
const back = await K.legend();
ok('and back to T at plane 2: the plane\'s own key', /^arg and \|w₂\|$/.test(back.caption || ''), back);
// a plane before a d/dz step draws no colour (shapes only), so it carries no hue ring: its key is none, where the planes with a
// colour of their own on either side of T read "colour carried from" the colour plane (z, exp, d/dz, z^2 with T at the last plane)
{
  const ns = 'planekeyddz' + Date.now();
  await loadView('steps', ns, { shapes: [], steps: [{ type: 'exp', params: {}, on: true }, { type: 'deriv', params: {}, on: true }, { type: 'pown', params: { n: 2 }, on: true }] });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && typeof __cmwLegend === "function" && __cmwSteps().planes.length === 4' });
  await ev(`(__cmwSteps({ T: 3 }), 1)`);
  for (const [i, kind] of [[0, 'color'], [1, null], [2, 'color']]) {
    await ev(`(__cmwSteps({ go: ${i}, now: true }), 1)`);
    await settled({ max: 20000, until: `!__cmwSteps().moving && __cmwSteps().i === ${i}` });
    const lg = await ev('__cmwLegend()');
    info[`ddz plane ${i}`] = lg;
    ok(`z, exp, d/dz, z^2 with T at w₃, plane ${i}: ${kind ? 'the carried hue ring' : 'no key (shapes only)'}`, lg.kind === kind && (!kind || lg.caption === 'colour carried from w₃'), lg);
  }
}
return { pass: !fails.length, fails, info };
