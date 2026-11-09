// The regions' note in the steps view names the plane whose phase colours the regions: the colour plane.
// - colour plane z: the ⋯ pop-up's note says "phase of z", on a phone the Display sheet's too;
// - colour plane w₁ (set on w₁, the view back on z): both say "phase of w₁";
// - the note follows the language (Russian);
// - on the Landscape under Plaster, which draws the relief with no phase colours, the note does not say the regions are coloured
//   by phase (under Tiles it does).
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
// the Landscape's Colouring is in the foot's Display options; the note is in the head's ⋯ pop-up
const PAINT_FLOOR = 300;
const landNote = async (paint) => {
  await open(1440, 900, false, 'en', 0);
  await ev(`(__cmwSteps({ surf: 'land', go: 0, now: true }), 1)`);
  await settled({ max: 15000, until: '!__cmwSteps().moving' });
  await ev(`(document.getElementById('landPaint') || document.querySelector('#leftFoot .opts-btn').click(), document.querySelector('#landPaint button[data-v="${paint}"]').click(), 1)`);
  await settled({ floor: PAINT_FLOOR });
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 1`);
  await ev(`document.querySelector('.pane-head .opts-btn').click(); 1`);
  await settled({ floor: POP_FLOOR });
  const text = await ev(`(() => { const n = document.querySelector('#regionsBox > .lbl'); return n && !n.hidden && n.offsetParent !== null ? n.textContent : ''; })()`);
  return { text, phase: await ev('__cmwState().view.D.phase'), checked: await ev(`(() => { const b = document.querySelector('#landPaint button.on'); return b ? b.dataset.v : null; })()`) };
};
const lt = await landNote('tiles');
ok('Landscape under Tiles: the note says the regions are coloured by phase', lt.phase === true && /phase of z,/.test(lt.text), lt);
const lp = await landNote('plaster');
ok('Landscape under Plaster is set up: no phase colouring', lp.phase === false, lp);
ok('Landscape under Plaster: the note does not say the regions are coloured by phase', !/phase/i.test(lp.text), lp);
info.notes = { t1, r1, p1, lt, lp };
return { pass: fails.length === 0, fails, info };
