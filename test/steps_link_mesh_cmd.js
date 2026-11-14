// A link carries the mesh quality the Mesh slider set: in the steps view the slider is moved, the figure the view writes is
// made into a link and reopened, and the mesh is the one set (not the default). Controls: a link without meshN opens at
// the default mesh, and a link written by an older build (no v3 flag) opens at the default mesh whatever meshN it holds.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const zlib = process.mainModule.require('zlib');
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const DEFAULT_MESH = 240;
// the Mesh slider's position (0..1000, a log scale): well above the default's
const MESH_POS = 700;
const b64u = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const linkOf = (s) => '1.' + b64u(zlib.deflateRawSync(Buffer.from(JSON.stringify({ v: 1, s }))));
// A link opens in a second load (openFigure writes the state and reloads): the kit's reloaded(old, ...) waits for the document
// that load brings, with its toast and the steps view
const READY = `(() => { const t = document.body && document.body.innerText || ''; return t.includes('Opened the figure from the link.') && typeof __cmwSteps === 'function' && __cmwSteps().on && !__cmwSteps().moving; })()`;
const meshAfter = async (state, tag) => {
  const old = await ev('performance.timeOrigin');
  await go(`${BASE}/test.html?ns=lmesh${tag}${Date.now()}&view=steps#cmw=${linkOf(state)}`);
  await reloaded(old, READY, { limitMs: 30000 });
  return ev('__cmwFigureState().meshN');
};
await view(1440, 900, false, false);
await go(`${BASE}/test.html?ns=lmesh${Date.now()}&view=steps`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
// the slider lives in the pane's options pop-up: opened the way a pointer does, then moved as one
await ev(`(() => { if (!document.getElementById('meshRange')) { const b = document.querySelector('#leftFoot .opts-btn:not(.pat-btn)'); if (b) b.click(); } })(), 1`);
await settled({ max: 5000 });
const set = await ev(`(() => { const e = document.getElementById('meshRange'); if (!e) return null; e.value = ${MESH_POS}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return +e.value; })()`);
await settled({ max: 60000 });
ok('the Mesh slider is in the options', Number.isFinite(set), set);
const fig = await ev('__cmwFigureState()');
const M = fig && fig.meshN;
info.written = M;
ok('the slider moved the mesh off the default', Number.isFinite(M) && M > DEFAULT_MESH, M);
const got = await meshAfter(fig, 'a');
info.opened = got;
ok('a link opens with the mesh the slider set', got === M, { want: M, got });
const { meshN, ...noMesh } = fig;
const dflt = await meshAfter(noMesh, 'b');
ok('a link without meshN opens at the default mesh', dflt === DEFAULT_MESH, dflt);
const { v3, ...old } = fig;
const oldGot = await meshAfter({ ...old, v3: undefined }, 'c');
ok('an older link (no v3) opens at the default mesh', oldGot === DEFAULT_MESH, oldGot);
return { pass: fails.length === 0, fails, info };
