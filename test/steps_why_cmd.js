// The steps view's Playback controls say, on screen, why they are off: with a d/dz in the chain Order and Paths are
// disabled, and a disabled control gets no hover, so their reasons are lines in the phone's Playback sheet and in the
// desktop's Playback popover (a touch can read them; Paths' description carries the reason too). With no d/dz no line
// shows. Phone at 360 and 390 px in en, ru and it; the popover at 1440 px.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// z → w₁ = z² → w₂ = i w₁, with a d/dz after them when asked
const chain = (deriv) => ({
  v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0,
  shapes: [{ id: 'd1', kind: 'disc', c: [0.3, 0.2], r: 1.4, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'affine', params: { a: 'i', b: '0' }, on: true }]
    .concat(deriv ? [{ type: 'deriv', params: {}, on: true }] : []),
});
const open = async (w, h, mobile, lang, st) => {
  const ns = `svwhy${w}${lang}${Date.now() % 100000}`;
  await view(w, h, false, mobile);
  await go(`${BASE}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`${BASE}/test.html?ns=${ns}&lang=${lang}&view=steps`);
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip')` });
};
// what a Playback container shows: its two controls and the line under each (the lines of the sheet follow their rows)
const PROBE = (box, why) => `(() => {
  const root = document.querySelector(${JSON.stringify(box)});
  if (!root || root.hidden) return null;
  const rb = root.getBoundingClientRect();
  const shown = (e) => !!e && e.getClientRects().length > 0 && e.getBoundingClientRect().height > 0;
  const inside = (e) => {
    const r = e.getBoundingClientRect();
    return r.left >= rb.left - 0.5 && r.right <= rb.right + 0.5
      && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  };
  const order = root.querySelector('.sv-order'), paths = root.querySelector('.sv-paths');
  const lines = [...root.querySelectorAll(${JSON.stringify(why)})].filter(shown);
  return {
    orderOff: order.getAttribute('aria-disabled') === 'true', pathsOff: paths.disabled, orderTip: order.dataset.tip, pathsTip: paths.dataset.tip,
    pathsDesc: paths.getAttribute('aria-description') || '', lines: lines.map((e) => e.textContent),
    inside: lines.every(inside),
    cut: lines.filter((e) => e.scrollHeight > e.clientHeight + 1).length,
  };
})()`;
// (an expression: the container exists and is not hidden)
const SHOWN = (sel) => `(() => { const e = document.querySelector('${sel}'); return !!e && !e.hidden; })()`;
const SHEET = PROBE('.sv-sheet', '.sv-sheet-why');
const POPOVER = PROBE('.sv-playpop', '.sv-playpop-why');
const openSheet = async () => {
  await ev(`(() => {
    const b = document.querySelector('.sv-play');
    const o = { pointerType: 'touch', pointerId: 7, bubbles: true, isPrimary: true };
    b.dispatchEvent(new PointerEvent('pointerdown', o));
  })(); 1`);
  await settled({ max: 5000, only: true, until: SHOWN('.sv-sheet') });
  await settled({});
};
const expectOff = (at, m) => {
  ok(`${at}: Order and Paths are disabled`, !!m && m.orderOff && m.pathsOff, m);
  ok(`${at}: a line says why for each, on screen and inside the box`,
    !!m && m.lines.length === 2 && m.inside && m.cut === 0, m);
  ok(`${at}: the lines are the controls' reasons`,
    !!m && m.lines[0] === m.orderTip && m.lines[1] === m.pathsTip && !!m.lines[1], m);
  ok(`${at}: Paths' description is its reason`, !!m && m.pathsDesc === m.pathsTip, m);
};
for (const lang of ['en', 'ru', 'it']) {
  for (const w of [360, 390]) {
    const at = `${lang} ${w} sheet`;
    await open(w, 844, true, lang, chain(true));
    await openSheet();
    expectOff(at, await ev(SHEET));
    await open(w, 844, true, lang, chain(false));
    await openSheet();
    const on = await ev(SHEET);
    ok(`${at}, no d/dz: nothing is off and no line shows`,
      !!on && !on.orderOff && !on.pathsOff && on.lines.length === 0 && on.pathsDesc === '', on);
  }
}
// the popover (a laptop): both reasons, one line under each control
await open(1440, 900, false, 'en', chain(true));
await ev(`document.querySelector('#svStrip .sv-playmore').click(), 1`);
await settled({ max: 5000, only: true, until: SHOWN('.sv-playpop') });
await settled({});
expectOff('1440 popover', await ev(POPOVER));
return { pass: fails.length === 0, fails, info };
