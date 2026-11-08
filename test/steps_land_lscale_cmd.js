// The steps view's Landscape height-scale slider (#lscaleRange): it is in the pane's options, shows the current
// scale, and moving it rescales the relief on the rest plane and on a held frame.
// The default page (z, exp, Möbius) on the Landscape, T = w₂, at rest on plane 0 and held at 0.5:
// - the slider is present and reads the default scale, 1;
// - set to its minimum and to its maximum, it reads that value, and each setting redraws the pane: the frame differs from
//   the same session's frame at the default scale by more than the redraw tolerance (a control that does nothing fails);
// - set back to the default, the frame is the default frame again (within the same tolerance);
// - the same holds held at 0.5.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const { grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const LSCALE_MIN = 0.25, LSCALE_MAX = 2, LSCALE_DEFAULT = 1;
// the share of pixels more than 32/255 apart: a changed relief moves far more than the redraw noise
const SAME_MAX = 0.005, CHANGED_MIN = 0.02;
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
// the pane's options pop-up holds the slider: opened the way a pointer does
const openOptions = () => ev(`(() => { if (!document.getElementById('lscaleRange')) { const b = document.querySelector('#leftFoot .opts-btn:not(.pat-btn)'); if (b) b.click(); } })(), 1`).then(() => settled({ max: 5000 }));
const slider = async () => JSON.parse(await ev(`JSON.stringify((() => { const e = document.getElementById('lscaleRange'); return e ? { value: +e.value, min: +e.min, max: +e.max } : null; })())`));
// the slider moved the way a pointer would: its value set and an input event dispatched
const setScale = async (v) => {
  await ev(`(() => { const e = document.getElementById('lscaleRange'); e.value = ${v}; e.dispatchEvent(new Event('input', { bubbles: true })); })(), 1`);
  await settled({ max: 60000 });
  await ev(rAF2);
};
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landlscale${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, T: 2, now: true }); 1`);
await settled({ max: 60000 });
const share = async (a, b) => { const c = await compare(a, b); return c && c.frac; };
info.runs = {};
for (const where of ['rest', 'held']) {
  const r = info.runs[where] = {};
  if (where === 'rest') await rest(0); else { await rest(0); await park(0.5); }
  await openOptions();
  const s0 = await slider();
  r.initial = s0;
  ok(`${where}: the slider is present`, !!s0, s0);
  if (!s0) continue;
  ok(`${where}: the slider spans ${LSCALE_MIN}..${LSCALE_MAX}`, s0.min === LSCALE_MIN && s0.max === LSCALE_MAX, s0);
  ok(`${where}: the slider reads the default scale`, s0.value === LSCALE_DEFAULT, s0);
  await grab(`${where}-base`);
  for (const v of [LSCALE_MIN, LSCALE_MAX]) {
    await setScale(v);
    const s = await slider();
    await grab(`${where}-${v}`);
    const d = await share(`${where}-${v}`, `${where}-base`);
    r[v] = { s, d };
    ok(`${where}: set to ${v}, the slider reads it`, s && s.value === v, s);
    ok(`${where}: set to ${v}, the relief is redrawn (> ${CHANGED_MIN * 100} % of pixels differ from the default scale)`, d != null && d > CHANGED_MIN, r[v]);
  }
  await setScale(LSCALE_DEFAULT);
  await grab(`${where}-back`);
  const back = await share(`${where}-back`, `${where}-base`);
  r.back = back;
  ok(`${where}: back at the default scale, the default frame is drawn again (≤ ${SAME_MAX * 100} % differ)`, back != null && back <= SAME_MAX, r.back);
}
return { pass: fails.length === 0, fails, info };
