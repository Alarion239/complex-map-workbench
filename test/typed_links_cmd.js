// A formula typed into a step's field where links are slow (#1547, option C). Every link lands LINK_MS after it began
// (test/lib/late_links.js, installed before every page this suite opens, as KHR_parallel_shader_compile on a GPU
// machine), and the page counts its links (__lateLinks.links). The slow-links path (GLR.slowLinks: ANGLE's Direct3D 11,
// which runs FXC at link time) is forced on by ?slowlinks, or off by ?slowlinks=0. The steps view opens on one custom
// step, z^2+1, and each formula is typed into its field a character at a time, CHAR_MS apart, as ci/glprof_typed.js
// types it, then committed (its change, then blur).
// - on the slow path, the links from the first keystroke until everything has landed: only the plane drawn links per
//   keystroke (its colour plot's program, once per prefix that is a new formula); the glide's prestart and the warm-up
//   wait until the edit is committed and run once, and the Landscape's warm-up waits until a Landscape has been drawn.
//   A formula of a dozen characters costs at most MAX_LINKS. Before #1547 a pause of 300 ms started them all for every
//   prefix of the formula;
// - on the slow path, no Landscape program is started for the typed formula while no Landscape has been drawn; once one
//   has been drawn (the steps view's Landscape, and back to the plane), the next edit warms the Landscape again;
// - a glide started GLIDE_AFTER_MS after the last keystroke, the field still focused (no commit: the idle wait commits
//   it): at its start the glide's programs of the typed formula are all started and linked (but for the last links
//   landing), as on the fast path, and the glide runs to its plane;
// - on the fast path (?slowlinks=0) nothing changes: the prestart and the warm-up run in the pauses of the typing (more
//   links than on the slow path), and the Landscape is warmed for the typed formula without being drawn.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the exact shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// ms a link reads not complete (WARP's FXC: 0.2 to 0.5 s for a program of 13-27 KB); ms between two characters; the
// links one typed formula may cost on the slow path (#1547's bar); the glide's start after the last keystroke; the wait
// without a keystroke that commits a typed edit (TYPED_COMMIT_MS)
const LINK_MS = 400, CHAR_MS = 450, MAX_LINKS = 20, GLIDE_AFTER_MS = 2000, COMMIT_MS = 1000;
const READY_MS = 60000, QUIET_MS = 90000, SETTLE_MS = 2000;
const START = 'z^2+1';
const SUM10 = 'sin(z)+cos(2z)+exp(z/3)+log(z+2)+z^5+1/(z-1)+sqrt(z)+tan(z/2)+sinh(z)+z^2*exp(-z)';
// (short: a formula of a dozen characters, which #1547's bar of MAX_LINKS is for)
const FORMULAS = [{ label: 'z^3-2z+1', expr: 'z^3-2z+1', short: true }, { label: 'exp(sin z)', expr: 'exp(sin(z))', short: true }, { label: 'a 10-term sum', expr: SUM10 }];
const state = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }], steps: [{ type: 'custom', params: { expr: START, cut: 180 }, on: true }] };
const FIELD = `document.querySelector('input[data-pkey="expr"]')`;
const setField = (text, change) => `(() => { const i = ${FIELD}; if (!i) return false; i.focus(); i.value = ${JSON.stringify(text)}; i.dispatchEvent(new Event('input', { bubbles: true }));${change ? " i.dispatchEvent(new Event('change', { bubbles: true })); i.blur();" : ''} return true; })()`;
// (nothing links, the warm-up has gone through its groups, and a glide of the chain is ready)
const QUIET = '__cmwWarm().phase === "done" && GLR.pendingLinks === 0 && !GLR.compiling && __cmwSteps().ready.ready';
// the Landscape's programs started for the current chain (landTF, land, floor in any map mode) and its static one
const LAND = `GLR.landProgs().filter((s) => /^(landTF|land|floor)\\|/.test(s) && s.split(' ')[0].split('|')[1] === GLR.chainKey || /^landNrm\\|/.test(s)).map((s) => s.replace('|' + GLR.chainKey, ''))`;
// in the page: every program that begins linking is recorded (name and map mode), sampled every few ms
const WATCH = `(() => {
  const w = window.__tlWatch = { seen: new Set(), list: [] };
  const look = () => { for (const p of GLR.pending()) if (!w.seen.has(p.id)) { w.seen.add(p.id); const f = p.id.split('|'); w.list.push(f[0] + (f.length > 2 ? '|' + f[2] : '')); } };
  w.timer = setInterval(look, 4);
  return 1;
})()`;
const UNWATCH = '(() => { const w = window.__tlWatch; clearInterval(w.timer); const by = {}; for (const n of w.list) by[n] = (by[n] || 0) + 1; return by; })()';
const loaded = 'typeof __cmwSteps === "function" && typeof __cmwWarm === "function" && !!window.GLR && GLR.ok && __cmwSteps().on';

const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lateLinkMs = ${LINK_MS};\n` + fs.readFileSync(path.join(DIR, '..', 'lib', 'late_links.js'), 'utf8') });
// a fresh page on the slow path (slow true) or the fast one, settled; -> whether the hook says the path is on
const open = async (slow) => {
  const ns = 'tl' + Date.now();
  await seed(ns, state);
  await go(`${BASE}/test.html?ns=${ns}&lang=en&view=steps&slowlinks${slow ? '' : '=0'}`);
  await settled({ max: READY_MS, until: loaded });
  await settled({ max: QUIET_MS, only: true, until: QUIET });
  return ev('typeof __cmwSlowLinks === "function" ? __cmwSlowLinks().on : null');
};
// the formula typed (no commit); -> { ms: from the first keystroke to the last, gap: the longest pause between two }
const typeIn = async (expr) => {
  await settled({ max: 30000, only: true, until: `!!${FIELD}` });
  await ev(setField('', false));
  const t0 = Date.now();
  let t = t0, gap = 0;
  for (let n = 1; n <= expr.length; n++) { await sleep(CHAR_MS); await ev(setField(expr.slice(0, n), false)); gap = Math.max(gap, Date.now() - t); t = Date.now(); }
  return { ms: Date.now() - t0, gap };
};
// one formula typed and committed on a settled page: { links, by (programs begun, by name and map mode), land, ms }
const typed = async (expr) => {
  const l0 = await ev('__lateLinks.links');
  await ev(WATCH);
  const { ms, gap } = await typeIn(expr);
  await ev(setField(expr, true));
  // (quiet twice, SETTLE_MS apart: the idle job's meshes reserve their programs in an idle moment after the first)
  let q = await settled({ max: QUIET_MS, only: true, until: QUIET });
  await sleep(SETTLE_MS);
  q = q.ok ? await settled({ max: QUIET_MS, only: true, until: QUIET }) : q;
  const by = await ev(UNWATCH);
  return { links: (await ev('__lateLinks.links')) - l0, by, land: await ev(LAND), ms, gap, quiet: q.ok };
};
try {
  await view(1440, 900, false, false);
  logs(true);
  // the slow path: each formula typed on a fresh page
  info.slow = {};
  for (const f of FORMULAS) {
    const on = await open(true);
    ok('control: the slow path is on (?slowlinks)', on === true, on);
    const r = await typed(f.expr);
    info.slow[f.label] = r;
    // (the plane drawn follows every keystroke: its colour plot's program (color, map mode 0) links once per prefix that is
    // a new formula, and so a long formula's count grows with its length, whatever waits for the commit; every other
    // program begins once, for the formula committed; a pause in the typing as long as the commit's wait (a loaded
    // machine) commits the prefix typed, and is not judged here)
    const again = r.gap < COMMIT_MS ? Object.keys(r.by).filter((k) => k !== 'color|m0' && r.by[k] > 1) : [];
    ok(`slow path, ${f.label} typed: only the plane drawn links per keystroke; the prestart and the warm-up run once, for the committed formula`, r.quiet && again.length === 0, Object.assign({ again }, r));
    if (f.short) ok(`slow path, ${f.label} typed at ${CHAR_MS} ms per character: at most ${MAX_LINKS} links`, r.quiet && r.links <= MAX_LINKS, r);
    ok(`slow path, ${f.label} typed: no Landscape program started while no Landscape has been drawn`, r.land.length === 0, r.land);
  }
  const late = await ev('window.__lateLinks || null');
  ok('control: the links were late (links made, and status polls that found one not complete)', !!late && late.links > 0 && late.early > 0, late);
  // the slow path: the Landscape drawn once (and back to the plane), then an edit warms it for the new formula
  {
    await open(true);
    await ev("__cmwSteps({ surf: 'land' }), 1");
    const r1 = await settled({ max: QUIET_MS, until: `__cmwSteps().main === 'land' && ${QUIET}` });
    const drawn = await ev(LAND);
    await ev("__cmwSteps({ surf: 'plane' }), 1");
    const r2 = await settled({ max: QUIET_MS, until: `__cmwSteps().main !== 'land' && ${QUIET}` });
    await ev(setField('z^3-2z+1', true));
    const r3 = await settled({ max: QUIET_MS, only: true, until: QUIET });
    const after = await ev(LAND);
    info.landOpened = { drawn, after, waits: [r1.ok, r2.ok, r3.ok] };
    ok('slow path: the Landscape drawn starts its programs', r1.ok && drawn.some((s) => /^landTF\|/.test(s)), info.landOpened);
    ok('slow path: once a Landscape has been drawn, an edit warms it for the new formula (landTF, land, floor and landNrm started)', r2.ok && r3.ok && ['landTF', 'land', 'floor', 'landNrm'].every((n) => after.some((s) => s.startsWith(n + '|'))), info.landOpened);
  }
  // a glide GLIDE_AFTER_MS after the last keystroke, the field still focused, on each path: the glide's programs at its start
  info.glide = {};
  for (const slow of [true, false]) {
    await open(slow);
    await typeIn('z^3-2z+1');
    await sleep(GLIDE_AFTER_MS);
    const at = await ev('(() => { const p = __cmwSteps().ready.parts.programs || { done: 0, total: 0, pending: 0 }; return { done: p.done, total: p.total, pending: p.pending, left: p.total - p.done - (p.pending || 0), focused: document.activeElement === ' + FIELD + ' }; })()');
    await ev('window.__tlRec0 = __cmwSteps().glide; __cmwSteps({ go: 1 }), 1');
    const g = await settled({ max: QUIET_MS, only: true, until: '!__cmwSteps().moving && __cmwSteps().x === 1 && __cmwSteps().glide !== window.__tlRec0' });
    const rec = await ev('(() => { const g = __cmwSteps().glide; return g ? { path: g.path, b: g.b, reason: g.reason || null } : null; })()');
    info.glide[slow ? 'slow' : 'fast'] = { at, glide: rec, wait: g.ok };
    ok(`${slow ? 'slow' : 'fast'} path: ${GLIDE_AFTER_MS} ms after the last keystroke, the glide's programs of the typed formula are all started`, at.total > 1 && at.left === 0, at);
    ok(`${slow ? 'slow' : 'fast'} path: that glide runs to its plane and draws its frames`, g.ok && !!rec, { rec, wait: g });
  }
  // (as ready as on the fast path: its programs linked at its start but for the last links landing (LINK_MS after the
  // prestart, which the commit's wait starts COMMIT_MS after the last keystroke). The glide's inverse program is no part
  // of the prestart, on either path: whether the glide's frames are the inverse pass's or the carried mesh's depends on
  // when that one lands, so its frames are not compared)
  {
    const s = info.glide.slow.at;
    ok(`slow path: the glide ${GLIDE_AFTER_MS} ms after the last keystroke finds its programs linked, as the fast path does (at most two still landing)`, s.left === 0 && s.done >= s.total - 2, info.glide);
  }
  // the fast path: the prestart and the warm-up run in the typing's pauses, as before #1547
  {
    const on = await open(false);
    ok('control: the fast path is on (?slowlinks=0)', on === false, on);
    const r = await typed('z^3-2z+1');
    info.fast = r;
    const slow = info.slow['z^3-2z+1'];
    ok('fast path, z^3-2z+1 typed: the prestart ran in the pauses (more links than on the slow path, and mode-1 programs begun more than once each)', r.quiet && r.links > slow.links && Object.keys(r.by).some((k) => /\|m1$/.test(k) && r.by[k] > 1), { fast: r, slow: slow.links });
    ok('fast path, z^3-2z+1 typed: the Landscape is warmed for it without being drawn', ['landTF', 'land', 'floor'].every((n) => r.land.some((s) => s.startsWith(n + '|'))), r.land);
  }
  const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
  ok('no console errors', exc.length === 0, exc.slice(0, 4));
} finally {
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
}
return { pass: fails.length === 0, fails, info };
