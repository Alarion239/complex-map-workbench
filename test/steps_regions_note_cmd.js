// The regions' note in the steps view names the plane whose phase colours the regions: the colour plane.
// - colour plane z: the ⋯ pop-up's note says "phase of z", on a phone the Display sheet's too;
// - colour plane w₁ (set on w₁, the view back on z): both say "phase of w₁";
// - the note follows the language (Russian).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
// (ms to let a pop-up or a sheet finish opening before its note is read)
const POP_FLOOR = 400, SHEET_FLOOR = 500;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svrn' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's2', kind: 'circle', c: [0.3, 0.2], r: 0.8, ci: 0, visible: true }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
const toPlane = async (i) => {
  await ev(`document.querySelector('#svStrip .sv-plane[data-i="${i}"]').click(); 1`);
  await settled({ max: 15000, until: `__cmwSteps().stage === ${i} && !__cmwSteps().moving` });
};
const open = async (w, h, touch, lang, T) => {
  await view(w, h, false, touch);
  await loadView('steps', ns, st, { lang });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
  if (T) { await toPlane(T); await ev(`document.querySelector('.sv-cp').click(); 1`); await settled({}); await toPlane(0); }
  else { await ev(`document.querySelector('.sv-cp').click(); 1`); await settled({}); }
  const s = await ev('__cmwSteps()');
  ok(`set up: the colour plane is w${T || 0 ? '₁' : ''}${T ? '' : 'z'}`.replace('wz', 'z'), s.T === T && s.stage === 0, { T: s.T, stage: s.stage });
};
const note = () => ev(`(() => { const n = document.querySelector('#regionsBox > .lbl'); return n ? n.textContent : null; })()`);
const desk = async (lang, T) => {
  await open(1440, 900, false, lang, T);
  await ev(`document.querySelector('.pane-head .opts-btn').click(); 1`);
  await settled({ floor: POP_FLOOR });
  const t = await note();
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`);
  return t;
};
const t0 = await desk('en', 0);
ok('colour plane z: the ⋯ pop-up says phase of z', /phase of z,/.test(t0 || ''), t0);
const t1 = await desk('en', 1);
ok('colour plane w₁: the ⋯ pop-up says phase of w₁', /phase of w₁,/.test(t1 || ''), t1);
const r1 = await desk('ru', 1);
ok('in Russian it names w₁ too', /фазе w₁/.test(r1 || ''), r1);
await open(390, 800, true, 'en', 1);
await ev(`document.querySelector('.ph-dsp').click(); 1`);
await settled({ floor: SHEET_FLOOR });
const p1 = await note();
ok('colour plane w₁: the phone Display sheet says phase of w₁', /phase of w₁,/.test(p1 || ''), p1);
info.notes = { t1, r1, p1 };
return { pass: fails.length === 0, fails, info };
