// A phone plane's keys are the plane's one view stack (.viewstack): Sphere, Display options and Fit view, and on the Stack the Tilt key,
// are its buttons, placed by the room the plane leaves them (data-keys, phone.css), and there is no second column of keys (.ph-col) and no
// second Sphere key (.ph-sph): one Sphere path, the stack's own. In the steps view, on the flat plane and on the Stack (a disc of a cubic's
// plane selected), in en at 568 x 320, 600 x 320, 640 x 360, 667 x 375, 740 x 360 and a portrait phone (390 x 844), and in ru and it at
// 568 x 320, 600 x 320 and 390 x 844: the stack holds the keys it should, no key lies on another control (the readout, the colour key
// and the Look down key, the construction chip), each key is the topmost element at its centre, the readout has no line cut, and the
// keys stand 8 px from each other. The Sphere key switches the plane's surface and back; on the Landscape, where the sphere does not
// exist, it stays in its place, aria-disabled, and a press says why in a message and changes nothing.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const SLACK = 0.5, SETTLE_MAX = 20000, GAP = 8;
const M3 = [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }];
const meets = (a, b) => a.l < b.r - SLACK && a.r > b.l + SLACK && a.t < b.b - SLACK && a.b > b.t + SLACK;
// the plane's keys (the stack's buttons that show), the controls a key must not lie on, the readout's overflow, the stray elements
const geometry = () => ev(`(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const plot = document.getElementById('plotL');
  const keys = [...plot.querySelectorAll(':scope > .viewstack .vbtn')].filter(shown).map((e) => {
    const b = r(e), top = document.elementFromPoint((b.l + b.r) / 2, (b.t + b.b) / 2);
    return { id: e.id || e.className.replace(/\\s+/g, '.'), ...b, w: b.r - b.l, onTop: !!top && (top === e || e.contains(top)), over: top && !(top === e || e.contains(top)) ? (top.id || top.className || top.tagName) + '' : '' };
  });
  const others = [];
  for (const [name, sel] of [['readout', '.chip.readout'], ['colour key', '#leftLegend'], ['Look down key', '.ld-key'], ['construction chip', '.draft-chip.cm-on']]) for (const e of plot.querySelectorAll(':scope > ' + sel)) if (shown(e)) others.push({ name, ...r(e) });
  const ro = plot.querySelector(':scope > .chip.readout'), cut = ro && shown(ro) ? Math.max(0, ro.scrollWidth - ro.clientWidth) : 0;
  return { cls: document.documentElement.className, plot: r(plot), keys, others, cut, strays: document.querySelectorAll('.ph-col, .ph-sph').length, keysAttr: plot.dataset.keys || '' };
})()`);
const check = async (tag, want) => {
  const g = await geometry();
  info[tag] = { keysAttr: g.keysAttr, keys: g.keys.map((k) => `${k.id} [${Math.round(k.l)}, ${Math.round(k.t)}, ${Math.round(k.r)}, ${Math.round(k.b)}]`) };
  ok(`${tag}: no second key column and no second Sphere key (.ph-col, .ph-sph)`, g.strays === 0, g.strays);
  for (const id of want) ok(`${tag}: the stack holds the ${id} key`, g.keys.some((k) => k.id === id || (id === 'ph-dsp' && /ph-dsp/.test(k.id)) || (id === 'ph-tilt' && /ph-tilt/.test(k.id))), g.keys.map((k) => k.id));
  if (!want.includes('ph-tilt')) ok(`${tag}: the Tilt key is not shown off the Stack`, !g.keys.some((k) => /ph-tilt/.test(k.id)), g.keys.map((k) => k.id));
  for (const k of g.keys) {
    ok(`${tag}: ${k.id} stands inside the plane`, k.t >= g.plot.t - SLACK && k.l >= g.plot.l - SLACK && k.r <= g.plot.r + SLACK && k.b <= g.plot.b + SLACK, { key: k, plot: g.plot });
    ok(`${tag}: ${k.id} is the topmost element at its centre`, k.onTop, k.over);
    for (const o of g.others) ok(`${tag}: ${k.id} lies on no ${o.name}`, !meets(k, o), { key: k, [o.name]: o });
  }
  for (let i = 0; i < g.keys.length; i++) for (let j = i + 1; j < g.keys.length; j++) ok(`${tag}: ${g.keys[i].id} and ${g.keys[j].id} do not overlap`, !meets(g.keys[i], g.keys[j]), [g.keys[i], g.keys[j]]);
  // (each key's neighbour in its row or its column stands GAP px away: the groups' gap)
  for (const a of g.keys) for (const b of g.keys) {
    if (a === b) continue;
    const rowNb = a.t < b.b - SLACK && b.t < a.b - SLACK && b.l >= a.r - SLACK, colNb = a.l < b.r - SLACK && b.l < a.r - SLACK && b.t >= a.b - SLACK;
    if (!rowNb && !colNb) continue;
    const d = rowNb ? b.l - a.r : b.t - a.b, near = g.keys.every((c) => c === a || c === b || !(rowNb ? (c.t < a.b - SLACK && a.t < c.b - SLACK && c.l >= a.r - SLACK && c.l < b.l - SLACK) : (c.l < a.r - SLACK && a.l < c.r - SLACK && c.t >= a.b - SLACK && c.t < b.t - SLACK)));
    if (near) ok(`${tag}: ${a.id} and the key after it in its ${rowNb ? 'row' : 'column'} (${b.id}) stand ${GAP} px apart`, Math.abs(d - GAP) <= SLACK, { gap: d });
  }
  ok(`${tag}: the readout has no line cut`, g.cut <= 1, g.cut);
  return g;
};
const flat = async (w, h, lang) => {
  await view(w, h, false, true);
  const ns = 'psk' + w + lang + (Date.now() % 1000000);
  await load(ns, { shapes: [{ id: 'd', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 }], steps: M3, srcView: { cx: 1.1, cy: 0, s: 70 } });
  await go(`${U}?ns=${ns}&view=steps&lang=${lang}`);
  await settled({ max: SETTLE_MAX, until: `typeof __cmwSteps === 'function' && !!window.Phone && Phone.isOn() && __cmwSteps().ready.ready` });
  await ev(`(document.querySelectorAll('.toast-x').forEach((b) => b.click()), 1)`);
};
const toStack = async () => {
  await ev(`(__cmwSelect('d'), 1)`);
  await settled({ max: SETTLE_MAX, until: `typeof __cmwLookDown === 'function' && !!__cmwLookDown() && !!document.querySelector('.ph-ctx.in')` });
  await ev(`(__cmwSteps({ surf: 'stack' }), 1)`);
  await settled({ max: SETTLE_MAX, floor: 600, until: `__cmwSteps().surf === 'stack' && typeof __cmwStack === 'function' && !!__cmwStack().drawn` });
};
const SIZES = [[568, 320, 'en'], [600, 320, 'en'], [640, 360, 'en'], [667, 375, 'en'], [740, 360, 'en'], [390, 844, 'en'], [568, 320, 'ru'], [600, 320, 'ru'], [390, 844, 'ru'], [568, 320, 'it'], [600, 320, 'it'], [390, 844, 'it']];
for (const [w, h, lang] of SIZES) {
  await flat(w, h, lang);
  await check(`${w}x${h} ${lang} the plane`, ['leftSph', 'leftFit', 'ph-dsp']);
  await toStack();
  await check(`${w}x${h} ${lang} the Stack`, ['leftSph', 'leftFit', 'ph-dsp', 'ph-tilt']);
}
// ---- the one Sphere path: the stack's key switches the surface and back; on the Landscape it stays, disabled, and says why
{
  await flat(568, 320, 'en');
  const surf = () => ev(`__cmwSteps().surf`);
  const press = async () => { await ev(`(document.getElementById('leftSph').click(), 1)`); await settled({ max: 3000, floor: 300, until: 'true' }); };
  ok('Sphere: the key starts on the plane', (await surf()) === 'plane', await surf());
  await press();
  await settled({ max: 5000, until: `__cmwSteps().surf === 'sphere'` });
  ok('Sphere: a press shows the sphere', (await surf()) === 'sphere', await surf());
  ok('Sphere: the key shows it pressed', await ev(`document.getElementById('leftSph').getAttribute('aria-pressed') === 'true'`), 0);
  await press();
  await settled({ max: 5000, until: `__cmwSteps().surf === 'plane'` });
  ok('Sphere: a second press goes back to the plane', (await surf()) === 'plane', await surf());
  await ev(`(__cmwSteps({ surf: 'land' }), 1)`);
  await settled({ max: SETTLE_MAX, floor: 400, until: `__cmwSteps().surf === 'land'` });
  await ev(`(document.querySelectorAll('.toast-x').forEach((b) => b.click()), 1)`);
  await settled({ max: 3000, until: `!document.querySelector('.toast')` });
  const k = await ev(`(() => { const b = document.getElementById('leftSph'); return { dis: b.getAttribute('aria-disabled') === 'true', shown: b.getClientRects().length > 0, why: document.getElementById('leftSphWhy').textContent }; })()`);
  ok('Sphere: on the Landscape the key stays in its place, aria-disabled, with its reason', k.dis && k.shown && k.why.length > 0, k);
  await ev(`(document.getElementById('leftSph').click(), 1)`);
  await settled({ max: 3000, until: `!!document.querySelector('.toast')` });
  const t = await ev(`(() => { const e = document.querySelector('.toast'); return e ? e.textContent : ''; })()`);
  ok('Sphere: a press on the Landscape says why in a message', t.length > 0 && t.indexOf((await ev(`document.getElementById('leftSphWhy').textContent`)).slice(0, 20)) >= 0, t);
  ok('Sphere: a press on the Landscape changes nothing', (await surf()) === 'land', await surf());
  await ev(`(document.getElementById('leftSph').click(), 1)`);
  await settled({ max: 1500, floor: 300, until: 'true' });
  ok('Sphere: a second press replaces the message, it does not stack another', (await ev(`document.querySelectorAll('.toast').length`)) === 1, await ev(`document.querySelectorAll('.toast').length`));
}
return { pass: fails.length === 0, fails: fails.slice(0, 80), info };
