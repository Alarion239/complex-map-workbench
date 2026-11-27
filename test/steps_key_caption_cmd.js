// The colour key's caption under the ring keeps clear of the ring's −i label (#2522): in the steps view on plane z, with the
// unit circle selected under z + 1/z, for each phase style (Cauchy, Enhanced, Phase, Modulus, Classic, Grid), in en, ru and
// it, on a desktop (1440 x 900) and on a phone (390 x 844, touch). The caption's ink box (__cmwLegend().capBox) and the −i
// label's (labelBox) do not meet, and the caption starts at least 2 px right of the label; it ends inside the key, and is
// narrowed (capK < 1) only where it would not fit otherwise: for no style but Cauchy's, whose caption is narrowed to the room
// right of −i (to about 0.97 in English and 0.8 in Italian). «integrale di Cauchy» ran over −i before, and «Cauchy integral»
// and «интеграл Коши» stood less than 2 px from it.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const CIRCLE = [{ id: 's1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }];
const STYLES = ['cauchy', 'enhanced', 'phase', 'modulus', 'classic', 'grid'];
const KEY_W = 136;       // the key's width, px (LEG.W)
const KEY_PAD = 8;       // room kept at its right edge, px
const GAP = 2;           // the least room between the caption and the −i label, px
const SLACK = 0.5;       // rounding, px
const MIN_K = 0.75;      // the least a caption is narrowed to: the Italian Cauchy caption needs about 0.8
for (const [layout, w, h, touch] of [['desktop', 1440, 900, false], ['phone', 390, 844, true]]) for (const lang of ['en', 'ru', 'it']) for (const dc of STYLES) {
  const tag = `${layout} ${lang} ${dc}`;
  await view(w, h, false, touch);
  const ns = 'kc' + Date.now();
  await load(ns, { shapes: CIRCLE, steps: [{ type: 'custom', params: { expr: 'z+\\frac{1}{z}', cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 110 }, nextId: 50, pattern: 'checker', dc });
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}&lang=${lang}`);
  await settled({ until: 'window.MathJax && !!window.__cmwSteps && __cmwSteps().planes.length > 0', max: 30000 });
  await ev(`(__cmwSelect('s1'), __cmwSteps({ T: 0, go: 0, now: true }), 1)`);
  await settled({ until: '!__cmwSteps().moving', max: 15000, floor: 400 });
  const k = await ev('__cmwLegend()');
  info[tag] = { caption: k.caption, capK: k.capK, capBox: k.capBox, labelBox: k.labelBox };
  ok(`${tag}: the key draws the ring and a caption (control)`, k.ring && !!k.labelBox && !!k.capBox && !!k.caption, k);
  if (!k.labelBox || !k.capBox) continue;
  const c = k.capBox, l = k.labelBox;
  const meets = c.x0 < l.x1 - SLACK && c.x1 > l.x0 + SLACK && c.y0 < l.y1 - SLACK && c.y1 > l.y0 + SLACK;
  ok(`${tag}: the caption «${k.caption}» does not meet the ring's −i label`, !meets, { capBox: c, labelBox: l });
  ok(`${tag}: the caption starts at least ${GAP} px right of the −i label`, c.x0 >= l.x1 + GAP - SLACK, { x0: c.x0, label: l.x1 });
  ok(`${tag}: the caption ends inside the key`, c.x1 <= KEY_W - KEY_PAD + SLACK, c.x1);
  if (dc !== 'cauchy') ok(`${tag}: the caption is drawn at its own width (not narrowed)`, k.capK === 1, k.capK);
  else ok(`${tag}: the Cauchy caption is narrowed no more than it needs, to at least ${MIN_K} of its width`, k.capK >= MIN_K && k.capK <= 1, k.capK);
}
return { pass: fails.length === 0, fails: fails.slice(0, 60), info };
