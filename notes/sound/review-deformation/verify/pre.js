const PORT = 8954, BASE = `http://localhost:${PORT}/test.html`;
const SPD = '<tmp>';
if (!globalThis.__injDone) { await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(SPD + '/xvsv/rinj.js', 'utf8') }); globalThis.__injDone = 1; }
const OUT = {};
const ns = 'xvsv' + Date.now();
async function loadS(steps, extra) {
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps, nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 120 } }, extra || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `${BASE}?ns=${ns}` }); await sleep(2400);
}
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
async function soundOn(main) {
  if (main) { await ev(`__cmwSetMain('${main}')`); await settle(900); }
  await click(5, 300); await settle(200);
  await ev(`Sound.set({ on: true, vol: 0.7, ui: true, events: true, sonify: true }, { quiet: true }); await new Promise((r) => setTimeout(r, 500)); __cmwSet('loop', false); 1`);
  // spies: cues requested (name, opts) and voice set() args, with time
  await ev(`(() => { window.__L = { cue: [], vs: [], gate: [], say: [] }; new MutationObserver(() => __L.say.push([performance.now(), document.getElementById('sndLive').textContent])).observe(document.getElementById('sndLive'), { childList: true, characterData: true, subtree: true });
    const wrapF = (o, k) => { const f = o[k]; o[k] = function (...a) { const r = f.apply(this, a); __L.cue.push([performance.now(), k === 'play' ? a[0] : k, JSON.stringify(a[k === 'play' ? 1 : 0] || {}), r]); return r; }; };
    wrapF(Sound, 'play'); wrapF(Sound, 'turn'); wrapF(Sound, 'tick');
    const wrap = (mk) => function () { const v = mk.apply(this, arguments); if (v && !v.__spy) { const s = v.set, g = v.gate; v.set = function (...a) { __L.vs.push([performance.now(), a[0], a[1], a[4]]); return s.apply(this, a); }; v.gate = function (...a) { __L.gate.push([performance.now(), a[0]]); return g.apply(this, a); }; v.__spy = 1; } return v; };
    Sound.voice = wrap(Sound.voice); Sound.heightVoice = wrap(Sound.heightVoice); return 1; })()`);
}
const W = (side, re, im) => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const rest = async (p) => { await move(p[0] + 3, p[1]); await sleep(40); await move(p[0], p[1]); await sleep(150); };
const takeL = () => ev(`(() => { const o = JSON.parse(JSON.stringify(__L)); __L.cue.length = 0; __L.vs.length = 0; __L.gate.length = 0; __L.say.length = 0; return o; })()`);
const recStart = () => ev(`__v3.recStart().then(() => 1)`);
const recStop = (name) => ev(`__v3.recStop(${JSON.stringify(name)})`, 60000);
const act = (a) => ev(`(() => { __v3.log.acts.push({ a: ${JSON.stringify(a)}, pn: performance.now(), now: __v3.h.c.currentTime }); return 1; })()`);
const S_ = () => ev('__cmwSound()');
const ST = () => ev('__cmwState().morph');
// summarize the cue log: names only (+ order for zero/pole)
const cueNames = (L) => L.cue.map((c) => c[1] + (/(zero|pole)/.test(c[1]) ? JSON.parse(c[2]).order : ''));
