// The figure the steps view writes (the state of a link, a scene and a save) holds no key that nothing reads: no hcap, no spin
// and no v6. A link written by an older build that still carries them opens as the same link without them: the same place on the
// chain and the same settings.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const zlib = process.mainModule.require('zlib');
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const DEAD_KEYS = ['hcap', 'spin', 'v6'];
const b64u = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const linkOf = (s) => '1.' + b64u(zlib.deflateRawSync(Buffer.from(JSON.stringify({ v: 1, s }))));
// A link opens in a second load (openFigure writes the state and reloads): the kit's reloaded(old, ...) waits for the document
// that load brings, with its toast and the steps view
const OPEN_MS = 30000;
const READY = `(() => { const t = document.body && document.body.innerText || ''; return t.includes('Opened the figure from the link.') && typeof __cmwSteps === 'function' && __cmwSteps().on && !__cmwSteps().moving; })()`;
// what a link opens to: the figure the view then writes, less the keys that are not part of the comparison (the camera is
// written fresh)
const openedFigure = async (state, tag) => {
  const old = await ev('performance.timeOrigin');
  await go(`${BASE}/test.html?ns=ldead${tag}${Date.now()}&view=steps#cmw=${linkOf(state)}`);
  await reloaded(old, READY, { limitMs: OPEN_MS });
  await settled({ max: 60000 });
  const f = await ev('__cmwFigureState()');
  delete f.figCam;
  return f;
};
await view(1440, 900, false, false);
await go(`${BASE}/test.html?ns=ldead${Date.now()}&view=steps`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
const fig = await ev('__cmwFigureState()');
info.keys = Object.keys(fig).length;
for (const k of DEAD_KEYS) ok(`the written figure holds no ${k}`, !(k in fig), fig[k]);
// an older link: the dead keys are in it, with values off the old defaults
const oldLink = { ...fig, hcap: 3.5, spin: true, v6: true };
const withKeys = await openedFigure(oldLink, 'a');
const without = await openedFigure(fig, 'b');
const same = JSON.stringify(withKeys) === JSON.stringify(without);
ok('an older link with hcap, spin and v6 opens as the link without them', same, same ? null : { withKeys, without });
for (const k of DEAD_KEYS) ok(`the figure an older link opens to holds no ${k}`, !(k in withKeys), withKeys[k]);
return { pass: fails.length === 0, fails, info };
