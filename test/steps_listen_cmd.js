// Listen along in the steps view: starting it (the example's Listen button) and stopping it (the chip's Stop) leave the plane's box where
// it is, at 1024 and 1366 px and on a 360 px phone, in en, ru and it. The "Listening along" chip takes room in the plane's
// head; when that room is short the chip's label gives it up, rather than the head wrapping onto a second row and pushing
// the plane down.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const rect = (sel) => ev(`(() => {
  const e = document.querySelector(${JSON.stringify(sel)});
  if (!e || !e.getClientRects().length) return null;
  const r = e.getBoundingClientRect();
  return [r.left, r.top, r.right, r.bottom].map(Math.round);
})()`);
// where the plane's corner sits in its pane: the example's lane above the pane goes when the melody ends, which moves and
// resizes the pane and not the corner inside it
const inPane = () => ev(`(() => {
  const p = document.querySelector('#paneL').getBoundingClientRect(), c = document.querySelector('#plotL').getBoundingClientRect();
  return [c.left - p.left, c.top - p.top].map(Math.round);
})()`);
const playing = () => ev(`!!(window.__cmwSound && window.__cmwSound({}).play)`);
const STATE = { unit: true, snap: true, shapes: [], nextId: 10, v3: true, v4: true, focus: 0 };
for (const lang of ['en', 'ru', 'it']) for (const [w, h, mobile] of [[1024, 700, false], [1366, 768, false], [360, 740, true]]) {
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
  await settled({ max: 8000, only: true, until: `!!(window.__cmwSound && window.__cmwSound({}).play)` });
  if (!mobile) await settled({ max: 4000, only: true, until: `!!document.querySelector('.mode-chip[data-mode="listen"]')` });
  await settled({});
  ok(`${at}: Listen is playing`, await playing(), null);
  if (!mobile) ok(`${at}: the "Listening along" chip is in the head`, !!(await rect('.mode-chip[data-mode="listen"]')), null);
  const during = await rect('#plotL');
  ok(`${at}: starting Listen leaves the plane's box where it is`, JSON.stringify(before) === JSON.stringify(during), { before, during });
  await ev(`(document.querySelector('.mode-chip[data-mode="listen"] .mc-stop') || document.querySelector('.ph-ctx button.prim')).click(), 1`);
  await settled({ max: 8000, only: true, until: `!(window.__cmwSound && window.__cmwSound({}).play)` });
  await settled({});
  const afterIn = await inPane();
  ok(`${at}: stopping Listen leaves it where it sits in its pane`, JSON.stringify(beforeIn) === JSON.stringify(afterIn), { beforeIn, afterIn });
}
return { pass: fails.length === 0, fails, info };
