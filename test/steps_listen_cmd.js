// Listen along in the steps view: starting it (the example's Listen button) and stopping it (the chip's Stop) leave
// the plane's box where it is, at 1024 and 1366 px and on a 360 px phone, in en, ru and it. The "Listening along" chip
// takes room in the plane's head; when that room is short the chip's label gives it up, rather than the head wrapping
// onto a second row and pushing the plane down.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const rect = (sel) => ev(`(() => {
  const e = document.querySelector(${JSON.stringify(sel)});
  if (!e || !e.getClientRects().length) return null;
  const r = e.getBoundingClientRect();
  return [r.left, r.top, r.right, r.bottom].map(Math.round);
})()`);
// where the plane's corner sits in its pane: the example's lane above the pane goes when the melody ends, which moves
// and resizes the pane and not the corner inside it
const inPane = () => ev(`(() => {
  const p = document.querySelector('#paneL').getBoundingClientRect();
  const c = document.querySelector('#plotL').getBoundingClientRect();
  return [c.left - p.left, c.top - p.top].map(Math.round);
})()`);
// the head is one row while it is under this tall: its 40 px minimum height, with 4 px for the border and rounding
const HEAD_ONE_ROW = 44;
const SOUND_PLAY = '!!(window.__cmwSound && window.__cmwSound({}).play)';
const LISTEN_CHIP = '.mode-chip[data-mode="listen"]';
const STATE = { unit: true, snap: true, shapes: [], nextId: 10, v3: true, v4: true, focus: 0 };
const TOOL_STATE = {
  shapes: [{ id: 'a', kind: 'disc', c: [0, 0], r: 1 }],
  steps: [{ type: 'recip', params: {}, on: true }, { type: 'sin', params: {}, on: true }],
  nextId: 10, v3: true, v4: true, focus: 0,
};
const SIZES = [[1024, 700, false], [1366, 768, false], [360, 740, true]];
for (const lang of ['en', 'ru', 'it']) for (const [w, h, mobile] of SIZES) {
  const at = `${lang} ${w}`;
  await view(w, h, false, mobile);
  await loadView('steps', `stl${w}${lang}${Date.now() % 100000}`, STATE, { lang });
  await settled({ max: 20000, until: `typeof __cmwSteps === 'function' && __cmwSteps().on` });
  ok(`${at}: the steps view is on`, await ev('typeof __cmwSteps === "function" && __cmwSteps().on'), null);
  await ev(`document.getElementById('examplesBtn').click(), 1`);
  await settled({ only: true, until: `!!document.querySelector('#popHost .examples .ex-snd')` });
  await ev(`document.querySelector('#popHost .examples .ex-snd').closest('.ex-item').click()`);
  await settled({ max: 15000, until: `!!document.querySelector('.tour-lane .btn.primary')` });
  await settled({});
  const before = await rect('#plotL'), beforeIn = await inPane();
  await ev(`document.querySelector('.tour-lane .btn.primary').click(), 1`);
  await settled({ max: 8000, only: true, until: SOUND_PLAY });
  if (!mobile) await settled({ max: 4000, only: true, until: `!!document.querySelector('${LISTEN_CHIP}')` });
  await settled({});
  ok(`${at}: Listen is playing`, await ev(SOUND_PLAY), null);
  if (!mobile) ok(`${at}: the "Listening along" chip is in the head`, !!(await rect(LISTEN_CHIP)), null);
  const during = await rect('#plotL');
  ok(`${at}: starting Listen leaves the plane's box where it is`,
    JSON.stringify(before) === JSON.stringify(during), { before, during });
  const stop = `document.querySelector('${LISTEN_CHIP} .mc-stop') || document.querySelector('.ph-ctx button.prim')`;
  await ev(`(${stop}).click(), 1`);
  await settled({ max: 8000, only: true, until: `!(${SOUND_PLAY})` });
  await settled({});
  const afterIn = await inPane();
  ok(`${at}: stopping Listen leaves it where it sits in its pane`,
    JSON.stringify(beforeIn) === JSON.stringify(afterIn), { beforeIn, afterIn });
}
// a long name at 1024 px in en: the chip drops its label and keeps Stop; the label is its tooltip, and Stop's name says
// what it stops
{
  const LONG = 'A circle with a name much too long for the plane head';
  const at = 'en 1024 long name';
  await view(1024, 700, false, false);
  await loadView('steps', `stll${Date.now() % 100000}`, STATE, { lang: 'en' });
  await settled({ max: 20000, until: `typeof __cmwSteps === 'function' && __cmwSteps().on` });
  await ev(`document.getElementById('examplesBtn').click(), 1`);
  await settled({ only: true, until: `!!document.querySelector('#popHost .examples .ex-snd')` });
  await ev(`document.querySelector('#popHost .examples .ex-snd').closest('.ex-item').click()`);
  await settled({ max: 15000, until: `!!document.querySelector('.tour-lane .btn.primary')` });
  await ev(`(() => {
    const name = ${JSON.stringify(LONG)};
    const named = window.__cmwShapes().shapes.map((s) => (s.kind === 'point' ? s : Object.assign({}, s, { name })));
    __cmwSet('shapes', named);
    return 1;
  })()`);
  await settled({});
  const before = await rect('#plotL');
  await ev(`document.querySelector('.tour-lane .btn.primary').click(), 1`);
  await settled({ max: 8000, only: true, until: `!!document.querySelector('${LISTEN_CHIP}')` });
  await settled({});
  const chip = await ev(`(() => {
    const c = document.querySelector('${LISTEN_CHIP}');
    if (!c) return null;
    const t = c.querySelector('.mc-t'), stop = c.querySelector('.mc-stop');
    const head = document.querySelector('#paneL .pane-head').getBoundingClientRect().height;
    return {
      label: t.textContent, labelShown: t.getClientRects().length > 0, tip: c.getAttribute('data-tip'),
      stop: stop.getAttribute('aria-label'), stopShown: stop.getClientRects().length > 0, head,
    };
  })()`);
  ok(`${at}: the chip says what is playing`, chip && chip.label.includes(LONG), chip);
  ok(`${at}: the chip drops its label and keeps Stop`, chip && !chip.labelShown && chip.stopShown, chip);
  ok(`${at}: the label is the chip's tooltip and Stop's name carries it`,
    chip && chip.tip === chip.label && chip.stop.includes(LONG), chip);
  ok(`${at}: the head is one row and the plane stays`,
    chip && chip.head < HEAD_ONE_ROW
    && JSON.stringify(before) === JSON.stringify(await rect('#plotL')), { chip, before });
}
// the Construct tool's chip at 1024 px in en, ru and it: the head stays one row and the plane stays; the count and Esc
// stay, the × stays inside the chip and is not covered by the next control; when the name is gone it is the chip's
// tooltip and the × button's name
for (const lang of ['en', 'ru', 'it']) {
  const at = `${lang} 1024 tool chip`;
  await view(1024, 700, false, false);
  await loadView('steps', `stlt${lang}${Date.now() % 100000}`, TOOL_STATE, { lang });
  await settled({ max: 20000, until: `typeof __cmwSteps === 'function' && __cmwSteps().on` });
  await settled({});
  const before = await rect('#plotL');
  await key('e');
  await settled({ max: 4000, only: true, until: `!!document.querySelector('.mode-chip[data-mode="tool"]')` });
  await settled({});
  const m = await ev(`(() => {
    const c = document.querySelector('.mode-chip[data-mode="tool"]');
    if (!c) return null;
    const cr = c.getBoundingClientRect(), t = c.querySelector('.mc-t'), n = c.querySelector('.mc-n');
    const x = c.querySelector('.icon-btn'), xr = x.getBoundingClientRect();
    const hit = document.elementFromPoint(xr.left + xr.width / 2, xr.top + xr.height / 2);
    return {
      head: document.querySelector('#paneL .pane-head').getBoundingClientRect().height,
      countShown: !!n && n.getClientRects().length > 0,
      nameShown: t.getClientRects().length > 0, xInside: xr.right <= cr.right + 0.5 && xr.left >= cr.left - 0.5,
      xHit: !!hit && (hit === x || x.contains(hit)), tip: c.getAttribute('data-tip'), name: t.textContent,
      xName: x.getAttribute('aria-label'),
    };
  })()`);
  ok(`${at}: the tool is a chip`, !!m, m);
  if (!m) continue;
  ok(`${at}: the head is one row and the plane stays`,
    m.head < HEAD_ONE_ROW && JSON.stringify(before) === JSON.stringify(await rect('#plotL')), { m, before });
  ok(`${at}: the count stays and the × is inside the chip and reachable`, m.countShown && m.xInside && m.xHit, m);
  ok(`${at}: a name that is gone is the chip's tooltip and the × button's name`,
    m.nameShown || (m.tip === m.name && m.xName.includes(m.name)), m);
}
return { pass: fails.length === 0, fails, info };
