// The plane's note (the sentence a plane draws on paper, here the Cauchy style's "drawn on z, where its curve lies: colour from z"
// with the colour plane T past z) stands clear of the plane's buttons on a phone: its box, as drawn, meets none of the
// visible buttons of the pane (the rail of Sphere, Display options, Fit view and the globe key) and lies inside the pane, and its words
// are centred in that box (the box is centred in the room left of the rail). At 360 x 640
// and 320 x 568, in English, Russian and Italian, light and dark, touch.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const GAP = 4;   // the note stands at least this far from a button, CSS px
const STATE = { shapes: [{ id: 's1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }],
  steps: [{ type: 'custom', params: { expr: 'z+\\frac{1}{z}', cut: 180 }, on: true }, { type: 'custom', params: { expr: 'z^4+z', cut: 180 }, on: true }],
  srcView: { cx: 0, cy: 0, s: 110 }, nextId: 50, pattern: 'checker', dc: 'cauchy' };
const measure = (src = '__cmwSteps().note') => ev(`(() => {
  const pane = document.getElementById('paneL').getBoundingClientRect(), n = ${src};
  if (!n) return { note: null };
  const box = [pane.left + n.x, pane.top + n.y, pane.left + n.x + n.w, pane.top + n.y + n.h];
  const btns = [...document.querySelectorAll('#paneL button, #plotL button, #toastHost .toast')].filter((b) => b.getClientRects().length).map((b) => { const r = b.getBoundingClientRect(); return { name: b.id || b.className, r: [r.left, r.top, r.right, r.bottom] }; })
    .filter(({ r }) => r[2] > r[0] && r[3] > r[1]);
  const hit = btns.filter(({ r }) => box[0] < r[2] + ${GAP} && box[2] > r[0] - ${GAP} && box[1] < r[3] + ${GAP} && box[3] > r[1] - ${GAP}).map(({ name, r }) => name + ' ' + r.map(Math.round).join(','));
  return { note: box.map(Math.round), centred: typeof n.tx === 'number' && Math.abs(n.tx - (n.x + n.w / 2)) <= 1, tx: n.tx, pane: [pane.left, pane.top, pane.right, pane.bottom].map(Math.round), hit, inPane: box[0] >= pane.left && box[2] <= pane.right && box[1] >= pane.top && box[3] <= pane.bottom, n: btns.length };
})()`);
for (const [w, h] of [[360, 640], [320, 568]]) {
  for (const lang of ['en', 'ru', 'it']) {
    for (const dark of [false, true]) {
      const tag = `${w} x ${h} ${lang}${dark ? ' dark' : ''}`;
      await view(w, h, dark, true);
      const ns = 'noterail' + w + lang + (dark ? 'd' : 'l') + (Date.now() % 100000);
      await load(ns, STATE);
      await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}&lang=${lang}${dark ? '&theme=dark' : ''}`);
      await settled({ max: 30000, until: 'window.MathJax && !!window.__cmwSteps && __cmwSteps().planes.length > 1' });
      await ev(`__cmwSelect('s1'); 1`);
      await ev(`(__cmwSteps({ T: 2, go: 2, now: true }), 1)`);
      await settled({ max: 20000, until: '!__cmwSteps().moving && __cmwSteps().T === 2 && __cmwSteps().i === 2 && !!__cmwSteps().note' });
      const m = await measure();
      info[tag] = m;
      ok(`${tag}: the note is drawn`, !!m.note, m);
      if (!m.note) continue;
      ok(`${tag}: the note stands in the pane`, m.inPane, m);
      ok(`${tag}: the note's words are centred in its box`, m.centred, m);
      ok(`${tag}: the note is clear of the pane's buttons (${m.n} on screen)`, m.hit.length === 0 && m.n >= 3, m);
      // the GPU-preparing note (the page's own words, in this language) with a message standing over the plane's foot
      await ev(`__cmwToast('Colour plane: z', 'Undo'); 1`);
      await settled({ max: 10000, until: `document.documentElement.classList.contains('ph-toast-on') && !!document.querySelector('#toastHost .toast')` });
      const g = await measure(`__cmwPaneNote('Preparing the GPU… (first time only; shaders left: {n})', { n: 19 })`);
      info[tag + ' gpu'] = g;
      ok(`${tag}: the GPU note is drawn`, !!g.note, g);
      if (g.note) {
        ok(`${tag}: the GPU note stands in the pane`, g.inPane, g);
        ok(`${tag}: the GPU note's words are centred in its box`, g.centred, g);
        ok(`${tag}: the GPU note is clear of the pane's buttons and the message (${g.n} on screen)`, g.hit.length === 0 && g.n >= 4, g);
      }
    }
  }
}
return { pass: fails.length === 0, fails, info };
