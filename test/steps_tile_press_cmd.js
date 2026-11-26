// The glide tile is laid out off the glide's frames (#2458): the tile's layout (its formulas typeset, svTileLay's measures
// and obstacle search, the morph built) is made in an idle moment (svTileLater), not in the frame that asks for it, the
// steps view's sync, which on a press is the glide's first frame and draws its picture too (the two together are one
// long task on a slow machine). A chain of two steps whose composite is long (steps_glide_tile's TILE_CHAIN), the page at 1200 x
// 800, the thread at rest on w₁, with __cmwTile's trace of each layout and typesetting (now: made where a layout may be,
// svTileLater's job or the hook; else in a frame):
// - press: a glide from w₁ to w₂ (__cmwSteps go, played live, its frames the steps view's own, each advancing it 1/60 s
//   however long it takes to draw: clock): none of the tile's layouts and none of its typesetting runs in a frame
//   (control: the glide made at least one of each);
// - held: the thread held between z and w₁ (x 0.5, a frame asks for a new pair of planes): the tile shows within SHOW_MS,
//   and at the spot a layout made at once gives (__cmwTile(true): the same box), as the frame path laid it before.
// The page opens with ?view=steps (loadView('steps', …)).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); return !!cond; };
const READY = 'typeof __cmwSteps === "function" && !!window.GLR && typeof __cmwTile === "function"';
const SHOW_MS = 1000;
const TILE_CHAIN = [{ type: 'custom', params: { expr: 'z^2+1/z' }, on: true }, { type: 'custom', params: { expr: 'sin(z)+exp(z)/(z-1)' }, on: true }];
const BOX = '(() => { const el = document.getElementById("svTile"); if (!el || el.hidden || getComputedStyle(el).visibility === "hidden") return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; })()';

await view(1200, 800, false, false);
await loadView('steps', 'svtilepress' + Date.now(), { shapes: [], steps: TILE_CHAIN }, { lang: 'en' });
await settled({ max: 30000, until: READY });
// (every glide plays live, its frames the steps view's own: no frames drawn ahead, render-ahead's)
await ev(`__cmwSteps({ ahead: { ms: 1e9 } }), __cmwSteps({ go: 1, now: true }); 1`);
await settled({ max: 60000, until: '!__cmwSteps().moving && __cmwSteps().ready.ready' });

// ---- press: a glide from w₁ to w₂
await ev('__cmwTile(false, true), 1');
await ev(`__cmwSteps({ clock: 1000 / 60, go: 2 }); 1`);
const end = await settled({ max: 60000, until: '!__cmwSteps().moving && __cmwSteps().x === 2' });
// (a layout job the glide queued has run: its trace counts too)
await settled({ max: 5000, until: '!__cmwTile().idle' });
const trace = info.press = (await ev('__cmwTile().trace')) || [];
await ev('__cmwTile(false, false), __cmwSteps({ clock: 0 }), 1');
const inFrame = trace.filter((e) => !e.now);
ok('press: the glide ran to w₂ (control)', end.ok, end);
ok('press: the glide laid the tile out and typeset its formulas (control)', trace.some((e) => e.what === 'lay') && trace.some((e) => e.what === 'tex'), trace);
ok('press: none of the tile\'s layouts or typesetting ran in a frame of the glide', inFrame.length === 0, { inFrame, trace });

// ---- held: the thread between z and w₁ (a pair of planes not laid out yet), shown within SHOW_MS, at the spot laid out at once
await ev(`__cmwSteps({ go: 0, now: true }); 1`);
await settled({ max: 60000, until: '!__cmwSteps().moving && __cmwSteps().ready.ready' });
await ev('__cmwTile(false, true), 1');
await ev(`window.__t0 = performance.now(), __cmwSteps({ x: 0.5 }), 1`);
const shown = await settled({ max: SHOW_MS + 5000, until: `${BOX} !== null` });
const ms = await ev('performance.now() - window.__t0');
const held = await ev(BOX);
const heldTrace = (await ev('__cmwTile().trace')) || [];
const atOnce = await ev(`(__cmwTile(true), ${BOX})`);
await ev('__cmwTile(false, false), 1');
info.held = { shown: shown.ok, ms: Math.round(ms), held, atOnce, trace: heldTrace };
ok(`held: the tile shows within ${SHOW_MS} ms of the thread held between z and w₁`, shown.ok && ms <= SHOW_MS, info.held);
ok('held: at the spot a layout made at once gives', !!held && !!atOnce && held.every((v, k) => Math.abs(v - atOnce[k]) <= 1), info.held);
ok('held: its layouts ran where a layout may be, not in the frame', heldTrace.length > 0 && heldTrace.every((e) => e.now), heldTrace);

return { pass: fails.length === 0, passed: pass, fails, info };
