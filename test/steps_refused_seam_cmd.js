// A chain the GPU refuses (its uniform slots pass the cap, #1928) draws the GL status card in the middle of the plane. The plane has
// no picture then, so the seam of a multivalued step it carries (the cut's line, its handle and its θ chip) is not drawn over the card's
// words (#2330). In the steps view: a chain of Möbius steps one past the page's slot cap, then a square root (cut 180°); parked on the
// root's plane (the last), which carries the root's cut, at 390 × 844 and 360 × 640, in en and ru.
// The rows read what is over the card: the box of each seam piece the plane keeps (the handle and the chip: __cmwCutHandles, which
// reads empty when none is drawn) against the card's box (__cmwNoteBox), in the same px; control: the card is there, whole, with its words.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the i18n shard (ci/browser_shards.js). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const READY = "typeof __cmwSteps === 'function' && !!window.GLR";
const open = async (tag, steps, lang) => {
  const ns = tag + Date.now();
  await seed(ns, { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', shapes: [], steps });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps${lang ? '&lang=' + lang : ''}`);
  await settled({ max: 60000, until: READY });
};
await view(1200, 800, false, false);
await open('rfsb', [{ type: 'pown', params: { n: 2 }, on: true }]);
const defs = await ev("Funcs.defaults('mobius')");
const rootDefs = await ev("Funcs.defaults('root')");
// one Möbius step over the live cap: the cap for the page's GPU limit, over the slots one Möbius step takes
const nSteps = await ev(`(() => { const st = { type: 'mobius', params: Funcs.defaults('mobius'), on: true }; const per = GLChain.build([st], [Funcs.build(st)]).slots; const vecs = Math.min(GLR.gl.getParameter(GLR.gl.MAX_FRAGMENT_UNIFORM_VECTORS), GLR.gl.getParameter(GLR.gl.MAX_VERTEX_UNIFORM_VECTORS)); return Math.floor((vecs - GLChain.OTHER_UNIFORM_VECS) / per) + 1; })()`);
const steps = Array.from({ length: nSteps }, () => ({ type: 'mobius', params: defs, on: true })).concat([{ type: 'root', params: rootDefs, on: true }]);
R.nSteps = nSteps;
// what is over the card: the seam pieces the plane keeps, in the pane's CSS px (page px less the canvas's corner), against the card's box
const READ = `(() => {
  const c = document.querySelector('#overlayL').getBoundingClientRect(), card = __cmwNoteBox();
  const pieces = __cmwCutHandles().map((h) => ({ step: h.step, x0: h.x - c.left - 8, x1: h.x - c.left + 84, y0: h.y - c.top - 11, y1: h.y - c.top + 11 }));
  const hit = card ? pieces.filter((p) => p.x0 < card.x + card.w && p.x1 > card.x && p.y0 < card.y + card.h && p.y1 > card.y) : [];
  return { card, pieces, hit, error: String(GLR.frameStatus().error) };
})()`;
const park = async (lang, w, h) => {
  const plane = nSteps + 1;
  const label = `${lang} ${w}x${h}`;
  await view(w, h, false, true);
  await open('rfs' + lang, steps, lang);
  await ev(`__cmwSteps({ go: ${plane}, now: true }); 1`);
  await settled({ only: true, max: 30000, until: '!!GLR.frameStatus().error' });
  await sleep(600);
  const g = await ev(READ);
  R[label] = g;
  ok(`${label}: the plane is refused and its card is drawn (control)`, !!g.error && !!g.card && g.card.w > 100 && g.card.h > 20, g);
  ok(`${label}: no piece of the seam (its handle, its θ chip) lies over the card's words (over it: ${JSON.stringify(g.hit)})`, !!g.card && g.hit.length === 0, g);
};
// control (the read sees a seam when the chain draws): the same square root after two Möbius steps, under the cap, has its handle and chip
{
  await view(390, 844, false, true);
  await open('rfsc', [{ type: 'mobius', params: defs, on: true }, { type: 'mobius', params: defs, on: true }, { type: 'root', params: rootDefs, on: true }], 'en');
  await ev('__cmwSteps({ go: 3, now: true }); 1');
  await settled({ only: true, max: 30000, until: '__cmwCutHandles().length > 0' });
  const g = await ev(READ);
  R.control = g;
  ok('control: a chain under the cap draws no card and keeps its seam pieces (the handle and chip)', !g.error && g.pieces.length > 0, g);
}
for (const [lang, w, h] of [['en', 390, 844], ['ru', 390, 844], ['en', 360, 640], ['ru', 360, 640]]) await park(lang, w, h);
return { pass: fails.length === 0, fails, results: R };
