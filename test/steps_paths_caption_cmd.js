// The steps view's paths figure caption (Export, Figure, paths), the Strip to disk example, plane 1:
// - on the Plane surface the caption names no sphere and no north pole (the picture is drawn on the plane), and the
//   sentence naming the paths follows the caption's sentence after a space ("... arg f. Curves are the paths ...");
// - on the Sphere surface the phase portrait caption still names the Riemann sphere.
// The caption text is read from the figure module's own caption builder (no typesetting, so MathJax is not needed).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=pathscap${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.__cmwFig' });
// (the examples menu's entries are tried by index up to this many)
const MAX_EXAMPLES = 80;
const names = await ev(`(() => { const out = []; for (let i = 0; i < ${MAX_EXAMPLES}; i++) { try { __cmwExample(i); } catch (e) { break; } const l = document.querySelector('#examplesBtn .exlabel'); out.push(l ? l.textContent : ''); } return out; })()`);
await ev(`__cmwExample(${names.findIndex((n) => /^Strip to disk/.test(n))}); 1`); await settled({});
await adopted();
await ev(`__cmwSteps({ go: 1, now: true, surf: 'plane' }); 1`); await settled({ max: 30000 });
const sentence = (await ev(`__cmwSvPaths().then((r) => r && r.sentence)`)) || '';
info.sentence = sentence.slice(0, 80);
ok('the paths sentence is there', /^Curves are the paths/.test(sentence), sentence);
const capOf = (view, body) => ev(`__cmwFig.captionFor({ for: 'article' }, ${JSON.stringify(view)}, ${JSON.stringify(body)})`);
const plane = await capOf('svPaths', { info: { svPaths: true, sentence } });
info.plane = plane;
ok('Plane surface: the caption names no sphere and no north pole', !/Riemann sphere|north pole/.test(plane), plane);
ok('Plane surface: the paths sentence follows after a space', /\. Curves are the paths/.test(plane) && !/\.Curves/.test(plane), plane);
await ev(`__cmwSteps({ go: 1, now: true, surf: 'sphere' }); 1`); await settled({ max: 30000 });
const sphere = await capOf('xyL', { info: {} });
info.sphere = sphere;
ok('Sphere surface: the phase portrait caption names the Riemann sphere', /Riemann sphere/.test(sphere), sphere);
return { pass: !fails.length, fails, info };
