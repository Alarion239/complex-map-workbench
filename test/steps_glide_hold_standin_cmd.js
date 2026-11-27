// A glide held on its plane while its programs link (svLinkHold, the Play gate) shows the plane's picture: on a cold load
// with the chain's programs held linking (?glhold, GLR.holdLinks), the colour plane z at rest is drawn from the colour
// plot's stand-in (colourStandIn), and ▶ holds the glide z -> w₁ at u = 0 with the gate's Cancel ("Preparing the glide…").
// The chain z², then a Möbius step; a disc on z; Everywhere; the plane; 1200 x 800. The pane's reads are standin_kit.js's
// (hue: the share in a colour; unlike: the share unlike its corner pixel; apart: the share of 16 px blocks of two looks
// more than 40 levels apart in a channel).
// - control: at rest, held, the pane is the stand-in's colour plot (hue over HUE_MIN), still pending;
// - control: ▶ pressed, the gate holds the play: ▶ busy, the thread at 0, links still pending;
// - while the gate holds it, the pane is the picture it showed at rest: at most APART_MAX of its blocks apart from it, at
//   two reads HOLD_READS ms after the gate shows (the held frame is the steps view's moving frame, which draws the plane's
//   plot with its stand-in as renderColor does at rest);
// - the links released, the play goes on and reaches plane 2, with no error in the console.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js names.
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'standin_kit.js'), 'utf8'));
// (the bounds: HUE_MIN, the stand-in's plot is coloured over nearly all the pane (0.96 measured) and an empty pane
// about 0.003; APART_MAX, the held frame is the same picture as at rest; HOLD_READS, two reads inside the hold)
const HUE_MIN = 0.5, APART_MAX = 0.02, HOLD_READS = [1000, 3000];
const loaded = "typeof __cmwSteps === 'function' && !!window.GLR";
await view(1200, 800, false, false);
const ns = 'ghs' + Date.now();
await seed(ns, { steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'mobius', params: { a: '1', b: '1', c: '0', d: '1' }, on: true }],
  shapes: [{ kind: 'disc', c: [0.3, 0.2], r: 0.8, id: 's1' }], sv: { at: 0, T: 0, scope: 'all', surf: 'plane' } });
if (!(await go(`http://localhost:${PORT}/test.html?ns=${ns}&glhold&view=steps`))) throw new Error('no load event');
await settled({ max: 30000, panes: false, until: loaded });
const si = await settled({ only: true, max: 30000, panes: false, until: "!!__cmwStandIn() && __cmwStandIn().end !== null" });
await sleep(500);
const rest = await K.look();
info.rest = { wait: si, hue: +rest.hue.toFixed(3), unlike: +rest.unlike.toFixed(3), pending: await ev('GLR.frameStatus().pending'), standIn: await ev('__cmwStandIn()') };
ok(`control: at rest, the links held, plane z is the stand-in's colour plot (hue over ${HUE_MIN}), still pending`, si.ok && rest.hue > HUE_MIN && info.rest.pending === true, info.rest);
await ev('__cmwSteps({ play: true }), 1');
const gate = await settled({ only: true, max: 10000, panes: false, until: '!!document.querySelector(".sv-play[aria-busy]")' });
info.gate = { wait: gate, x: await ev('__cmwSvX()'), links: await ev('GLR.pendingLinks'), desc: await ev('document.querySelector(".sv-play").getAttribute("aria-description")') };
ok('control: ▶ pressed, the gate holds the glide: ▶ busy, the thread at 0, links pending', gate.ok && info.gate.x === 0 && info.gate.links > 0, info.gate);
info.held = [];
let t = 0;
for (const at of HOLD_READS) {
  await sleep(at - t); t = at;
  const h = await K.look();
  const r = { at, hue: +h.hue.toFixed(3), unlike: +h.unlike.toFixed(3), apart: +K.apart(rest, h).toFixed(3), x: await ev('__cmwSvX()'), busy: await ev('!!document.querySelector(".sv-play[aria-busy]")') };
  info.held.push(r);
  ok(`held ${at} ms after the gate shows, the pane is plane z's picture at rest: at most ${APART_MAX * 100} % of its ${K.BLOCK} px blocks apart`, r.busy && r.x === 0 && r.apart <= APART_MAX, r);
}
await ev('GLR.holdLinks(false), 1');
const end = await settled({ only: true, max: 60000, panes: false, until: '__cmwSvX() === 2 && !__cmwSteps().play' });
info.end = { wait: end, x: await ev('__cmwSvX()') };
ok('the links released, the play goes on and reaches plane 2', end.ok, info.end);
const errs = (await logs()).filter((e) => (e.t === 'EXC' || e.t === 'error' || e.t === 'log-error') && !/Failed to load resource|favicon/.test(e.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
