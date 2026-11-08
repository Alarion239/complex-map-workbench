// The steps view's key on each surface, read from the pane's legend (__cmwLegend: kind and caption) with the thread parked at each
// plane of example 1, for each place of T (the colour plane). The pane draws its own key: on plane T the style's key, named
// after the map its colour is read from; on every other plane, before T and past it, the hue ring with the line saying which
// plane its colour is carried from; on the Landscape the height key, whatever T is. The classic views' key under the image (keyUnder) has no steps
// counterpart; this key is what a reader reads a colour by. The key follows T in the frame it moves in.
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
return { pass: !fails.length, fails, info };
