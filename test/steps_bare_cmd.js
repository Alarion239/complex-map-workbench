// The steps view's bare mode (__cmwSteps({ bare: true }), a comparison mode for suites and tools): the colour layer
// alone, so the shapes' outlines are drawn in no frame, moving or parked, with Inside regions on (the masked frames) or
// off. The outlines are GLR.drawLines calls: they are counted over the glide's frame at x = 0.5 and the parked frame at
// x = 1 of the default example (exp, then a Möbius map), for each of Inside regions and Everywhere. Without bare every
// one of those frames draws them (the negative control: the count is above 0 where bare makes it 0).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ready = () => settled({ max: 60000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });

await view(1440, 900, false, false);
await go(`${BASE}/test.html?ns=bare${Date.now()}&lang=en&view=steps`);
await ready();
await settled({ max: 120000, until: '__cmwSteps().ready.ready' });
// (every outline the left pane draws goes through GLR.drawLines: counted from here)
await ev(`window.__dl = 0; (() => { const d = GLR.drawLines; GLR.drawLines = function (...a) { window.__dl++; return d.apply(this, a); }; })(); 1`);

// the number of outline draws of the frame at thread place x, once that frame is drawn
const outlines = async (x) => {
  await ev(`__cmwSteps({ x: ${x === 0.5 ? 0.45 : 0.55} }), 1`);
  await settled({ max: 60000, until: `!__cmwSteps().anim` });
  await ev(`window.__dl = 0, 1`);
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  await settled({ max: 60000, until: `(() => { const s = __cmwSteps(), g = s.glide; return ${x === 1 ? 's.x === 1' : `!!g && Math.abs(g.b + g.u - ${x}) < 1e-9`} && !s.anim; })()` });
  await settled({ max: 20000, until: 'GLR.pendingLinks === 0' });
  return ev('window.__dl');
};

for (const scope of ['in', 'all']) {
  for (const bare of [false, true]) {
    await ev(`__cmwSteps({ scope: '${scope}', bare: ${bare} }), 1`);
    for (const x of [0.5, 1]) {
      const n = await outlines(x);
      info[`${scope} bare ${bare} x ${x}`] = n;
      if (bare) ok(`bare, ${scope === 'in' ? 'Inside regions' : 'Everywhere'}, x = ${x}: no outline is drawn`, n === 0, n);
      else ok(`not bare, ${scope === 'in' ? 'Inside regions' : 'Everywhere'}, x = ${x}: the outlines are drawn (the negative control)`, n > 0, n);
    }
  }
}
return { pass: fails.length === 0, fails, info };
