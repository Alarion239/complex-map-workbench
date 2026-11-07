// The Cauchy style's settings in the steps view: the parts control (Both / Inside / Outside, cauchyShow) and the formula note
// under it, in the style row's ⋯ pop-up on plane z.
//   a pole inside the curve (F = z + 1/z over the unit circle): the parts are enabled, the note names f₊ and f₋, a choice is saved
//   and survives a reload of the same state;
//   no pole inside (F = z² − 1): the parts are disabled with "No pole inside the curve: F inside, 0 outside";
//   the colour plane off z: the parts are disabled with the drawn-on-z reason, the plane z's title keeps the Cauchy subject, and
//   the key shrinks to one line of text.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const CIRCLE = [{ id: 's1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }];
const stateOf = (expr, extra) => Object.assign({ shapes: CIRCLE, steps: [{ type: 'custom', params: { expr, cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 110 }, nextId: 50, pattern: 'checker', dc: 'cauchy' }, extra || {});
const NO_POLE = 'No pole inside the curve: F inside, 0 outside';
// the key off z is one line of text: its canvas is at most KEY_LINE_MAX CSS px tall (the ringed key is 72)
const KEY_LINE_MAX = 30;
const OFF_Z = 'The Cauchy integral is drawn on z, where its curve lies: colour from z';
const open = async (ns, state) => {
  await view(1440, 900, false, false);
  await load(ns, state);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}`);
  await settled({ until: 'window.MathJax && !!window.__cmwSteps && __cmwSteps().planes.length > 0', max: 30000 });
  await ev(`__cmwSelect('s1'); 1`);
  await settled({ until: '!__cmwSteps().moving', max: 15000 });
};
// the style row's controls behind ⋯, read with the pop-up open and closed again
const parts = async () => {
  await ev(`document.querySelector('#leftFoot .opts-btn').click(); 1`);
  await settled({ until: '!!document.querySelector(".opts-pop")', max: 5000 });
  const r = JSON.parse(await ev(`JSON.stringify((() => { const p = document.querySelector('.opts-pop'), seg = p.querySelector('#cauchySeg'), n = p.querySelector('.foot-note'); return { seg: !!seg, buttons: seg ? [...seg.querySelectorAll('button')].map((b) => ({ v: b.dataset.v, disabled: b.disabled, tip: b.dataset.tip, desc: b.getAttribute('aria-description'), on: b.classList.contains('on') })) : [], note: n ? n.innerText : '' }; })())`));
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`);
  return r;
};
const ns = 'czp' + Date.now();
await open(ns, stateOf('z+\\frac{1}{z}'));
const a = await parts();
info.pole = a;
ok('pole inside: the parts control is there, three choices', a.seg && a.buttons.length === 3, a);
ok('pole inside: the parts are enabled', a.buttons.every((b) => !b.disabled), a);
ok('pole inside: the note names f₊ and f₋', /f₊/.test(a.note) && /f₋/.test(a.note), a);
await ev(`__cmwCauchyOpt('in', true)`);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}`);
await settled({ until: 'window.MathJax && !!window.__cmwSteps && __cmwSteps().planes.length > 0', max: 30000 });
await ev(`__cmwSelect('s1'); 1`);
await settled({ until: '!__cmwSteps().moving', max: 15000 });
const b = await parts();
ok('a reload keeps the chosen part', b.buttons.some((x) => x.v === 'in' && x.on), b);

const ns2 = 'czq' + Date.now();
await open(ns2, stateOf('z^2-1'));
const c = await parts();
info.none = c;
ok('no pole: the parts control is there and disabled with its reason', c.seg && c.buttons.every((x) => x.disabled && x.tip === NO_POLE && x.desc === NO_POLE), c);
ok('no pole: the note says F inside, 0 outside', /0 outside/.test(c.note), c);

await open('czn' + Date.now(), stateOf('\\exp\\left(\\frac{1}{z}\\right)'));
const e = await parts();
info.numeric = e;
ok('a singularity that is not a pole: the parts are disabled with a reason that says it is numeric', e.seg && e.buttons.every((x) => x.disabled && /numerically/.test(x.tip) && !/No pole/.test(x.tip)), e);
await open('czu' + Date.now(), stateOf('\\frac{1}{z-1}'));
const u = await parts();
info.undefined = u;
ok('F not finite on the curve: the parts are disabled with a reason that says so', u.seg && u.buttons.every((x) => x.disabled && /not finite/.test(x.tip) && !/No pole/.test(x.tip)), u);
await open(ns, stateOf('z+\\frac{1}{z}'));
await ev(`(__cmwSteps({ T: 1 }), 1)`);
await settled({ until: '__cmwSteps().T === 1 && !__cmwSteps().moving', max: 15000 });
await ev(`(__cmwSteps({ go: 0, now: true }), 1)`);
await settled({ until: '__cmwSteps().i === 0 && !__cmwSteps().moving', max: 15000 });
const d = await parts();
info.off = d;
ok('off z: the parts are disabled with the drawn-on-z reason', d.seg && d.buttons.every((x) => x.disabled && x.tip === OFF_Z), d);
const ti = JSON.parse(await ev('JSON.stringify(__cmwSteps().names.title)'));
ok('off z: the title of plane z keeps the Cauchy subject', /^Cauchy integral over /.test(ti.role), ti);
const h = await ev(`(() => { __cmwLegend(); const c = document.querySelector('.legend-chip canvas'); return c ? c.height / 2 : -1; })()`);
ok('off z: the key is one line of text', h > 0 && h <= KEY_LINE_MAX, h);
return { pass: !fails.length, fails, info };
