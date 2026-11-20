// Figure export's filmstrip over a Number: the shown plane's picture at evenly spaced values of a Number, one frame each,
// titled with its value. The steps view on plane z coloured from w₁ = z² + c (the phase of z² + c, Everywhere), c a Number
// on a slider from −2 to 1:
// - four frames of c from −1.5 to 1.5 (past the slider's end): four pictures, each different from the others, titled
//   c = −1.5, −0.5, 0.5, 1.5, the caption naming the plane and the values; then c is back at −1 and its slider at −2 … 1;
// - the build cancelled at its second value: no figure, and c and its slider are back as they were;
// - the dialog: Filmstrip offers the planes or a Number, the Number row lists c with its slider's ends as the first and
//   last values; a figure with no Number offers it greyed with its reason.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const base = `http://localhost:${PORT}`;
// the pictures' rasters read back at this width (px), and the share of their pixels two frames must differ in by more
// than DIFF per channel to count as different pictures
const RASTER_W = 160, DIFF = 24, APART = 0.05;
const STATE = { steps: [{ type: 'custom', params: { expr: 'z^2+c', cut: 180 }, on: true }], params: [{ name: 'c', value: -1, min: -2, max: 1, step: 0.01 }], srcView: { cx: 0, cy: 0, s: 90 }, sv: { at: 0, T: 1, scope: 'all', surf: 'plane' } };
const open = async (ns, st) => {
  await view(1280, 800, false);
  await seed(ns, st);
  await go(`${base}/test.html?ns=${ns}&lang=en&view=steps`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure && __cmwSteps().planes.length === 2', max: 30000 });
  await ev("(__cmwSteps({ go: 0, now: true, T: 1, scope: 'all' }), 1)");
  await settled({ until: '__cmwSteps().i === 0 && __cmwSteps().T === 1 && !__cmwSteps().moving', max: 15000 });
};
const slider = () => ev(`(() => { const p = Params.list().find((q) => q.name === 'c'); return { value: p.value, im: p.im || 0, min: p.min, max: p.max, step: p.step }; })()`);
const AS_WAS = { value: -1, im: 0, min: -2, max: 1, step: 0.01 };
const same = (a, b) => Object.keys(b).every((k) => a[k] === b[k]);
// ---- four frames of c from −1.5 to 1.5
await open('xnf' + Date.now(), STATE);
await ev(`window.__xnf = null; Figure.build({ svPic: 'film', film: 'number', numName: 'c', numFrom: { re: -1.5, im: 0 }, numTo: { re: 1.5, im: 0 }, numN: 4, crop: 'screen' }).then(async (f) => {
  if (!f) { window.__xnf = { none: true }; return; }
  const urls = [...f.svg.matchAll(/<image\\b[^>]*?(?:xlink:)?href="(data:image\\/[^"]+)"/g)].map((m) => m[1]), px = [];
  for (const u of urls) { const im = new Image(); im.src = u; await im.decode(); const W = Math.min(${RASTER_W}, im.naturalWidth), H = Math.round(W * im.naturalHeight / im.naturalWidth), cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, W, H); px.push([...g.getImageData(0, 0, W, H).data]); }
  window.__xnf = { view: f.view, cap: String(f.captionTex || ''), titles: f.info && f.info.labs, n: urls.length, px }; }, (e) => { window.__xnf = { err: String(e) }; }); 1`);
await settled({ until: 'window.__xnf != null', max: 180000, panes: false });
const fig = await ev('window.__xnf');
const after = await slider();
// (the share of two rasters' pixels that differ by more than DIFF in a channel)
const apart = (a, b) => { let d = 0, n = 0; for (let i = 0; i + 3 < Math.min(a.length, b.length); i += 4) { n++; if (Math.abs(a[i] - b[i]) > DIFF || Math.abs(a[i + 1] - b[i + 1]) > DIFF || Math.abs(a[i + 2] - b[i + 2]) > DIFF) d++; } return n ? d / n : 0; };
const pairs = [];
if (fig && fig.px) for (let i = 0; i < fig.px.length; i++) for (let j = i + 1; j < fig.px.length; j++) pairs.push({ i, j, apart: +apart(fig.px[i], fig.px[j]).toFixed(3) });
info.film = fig && { view: fig.view, cap: fig.cap, titles: fig.titles, n: fig.n, pairs, after, err: fig.err };
ok('c from −1.5 to 1.5, four frames: the figure is built as the filmstrip over a Number, with four pictures', !!fig && !fig.err && fig.view === 'svNumFilm' && fig.n === 4, info.film);
ok('c from −1.5 to 1.5: each picture differs from every other', pairs.length === 6 && pairs.every((p) => p.apart >= APART), pairs);
ok('c from −1.5 to 1.5: the frames are titled with c\'s values −1.5, −0.5, 0.5, 1.5', !!fig && JSON.stringify(fig.titles) === JSON.stringify(['-1.5', '-0.5', '0.5', '1.5']), fig && fig.titles);
ok('c from −1.5 to 1.5: the caption names the plane and the values', !!fig && /The plane \$z\$/.test(fig.cap) && /c=-1\.5,\\,-0\.5,\\,0\.5,\\,1\.5/.test(fig.cap), fig && fig.cap);
ok('c from −1.5 to 1.5: afterwards c is back at −1 and its slider at −2 … 1 (step 0.01)', same(after, AS_WAS), after);
// ---- the build cancelled at its second value (alive false from the moment c has left −1.5 on, as a closed dialog's)
await ev(`window.__xnc = null; window.__xcut = false; Figure.build({ svPic: 'film', film: 'number', numName: 'c', numFrom: { re: -1.5, im: 0 }, numTo: { re: 1.5, im: 0 }, numN: 4, crop: 'screen', alive: () => !(window.__xcut = window.__xcut || Params.get('c') > -1) }).then((f) => { window.__xnc = { none: !f }; }, (e) => { window.__xnc = { err: String(e) }; }); 1`);
await settled({ until: 'window.__xnc != null', max: 180000, panes: false });
const cancel = await ev('window.__xnc'), after2 = await slider();
info.cancel = { cancel, after: after2 };
ok('cancelled at the second value: no figure is made', !!cancel && cancel.none === true, cancel);
ok('cancelled: c is back at −1 and its slider at −2 … 1', same(after2, AS_WAS), after2);
// ---- the dialog: the filmstrip's source, and the Number row
await ev('(Figure.open(), 1)');
await settled({ until: '!!document.querySelector("#xfSvPic")', max: 15000, panes: false });
await ev(`(document.querySelector('#xfSvPic [data-v="film"]').click(), 1)`);
await settled({ until: '!!document.querySelector("#xfFilmSrc") && !document.querySelector("#xfFilmSrc").closest(".xf-row").hidden', max: 10000, panes: false });
await ev(`(document.querySelector('#xfFilmSrc [data-v="number"]').click(), 1)`);
await settled({ until: '!!document.querySelector("#xfNum") && !document.querySelector("#xfNum").closest(".xf-row").hidden', max: 10000, panes: false });
const dlg = await ev(`(() => { const s = document.getElementById('xfNum'); return { names: s ? [...s.options].map((o) => o.textContent) : null, from: document.getElementById('xfNumFrom').value, to: document.getElementById('xfNumTo').value, n: document.getElementById('xfNumN').value, src: [...document.querySelectorAll('#xfFilmSrc [data-v]')].map((b) => b.dataset.v) }; })()`);
info.dialog = dlg;
ok('the dialog: Filmstrip offers the planes or a Number', JSON.stringify(dlg.src) === JSON.stringify(['planes', 'number']), dlg);
ok('the dialog: the Number row lists c, from its slider\'s ends, four frames', JSON.stringify(dlg.names) === JSON.stringify(['c']) && dlg.from === '-2' && dlg.to === '1' && dlg.n === '4', dlg);
// ---- no Number: the source is offered greyed, with its reason
await open('xnn' + Date.now(), Object.assign({}, STATE, { steps: [{ type: 'custom', params: { expr: 'z^2-1', cut: 180 }, on: true }], params: [] }));
await ev('(Figure.open(), 1)');
await settled({ until: '!!document.querySelector("#xfSvPic")', max: 15000, panes: false });
await ev(`(document.querySelector('#xfSvPic [data-v="film"]').click(), 1)`);
await settled({ until: '!!document.querySelector("#xfFilmSrc")', max: 10000, panes: false });
const none = await ev(`(() => { const b = document.querySelector('#xfFilmSrc [data-v="number"]'); return { off: b && b.getAttribute('aria-disabled'), why: b && b.getAttribute('aria-description'), row: !!document.getElementById('xfNum') }; })()`);
info.none = none;
ok('no Number: "A Number" is greyed with its reason, and there is no Number row', none.off === 'true' && /Add a Number/.test(none.why || '') && !none.row, none);
return { pass: fails.length === 0, fails, info };
