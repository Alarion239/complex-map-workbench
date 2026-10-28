// The Mountain King as the app plays it (notes/sea-song/FUNCTION.md): the example opened, Listen along chosen from
// the circle's menu (its samples prepared first: F is costly; then stopped and chosen again, so the playback starts at
// once from the kept samples), and what the app's AudioContext sends to its destination recorded sample-exact
// (test/sound_rec.js) for the playback and its ring-out (SEA_SEC: seconds, default its duration + 2.5). Writes
// <daemon>/rec/mountain-king.f32 (float32 stereo interleaved) and .json (rate, the recording's first frame, the
// playback's handle from Sound.along: t0, dur, mode, counts, and its scheduled events). Then:
//   node test/seasong_wav.js <rec/mountain-king.f32> <out.wav>
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const OUT = path.join(DIR, 'rec');
fs.mkdirSync(OUT, { recursive: true });
const recSrc = fs.readFileSync(path.join(DIR, '..', 'sound_rec.js'), 'utf8');
// (the page's AudioContext forced to 48 kHz, as a 16 kHz default output, e.g. Bluetooth earbuds, would make it; SEA_48K=0 in the daemon's environment: the device's own rate)
const inj48 = process.env.SEA_48K !== '0' ? await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const A = window.AudioContext; if (!A) return; window.AudioContext = class extends A { constructor(o) { super(Object.assign({ sampleRate: 48000 }, o || {})); } }; })();` }) : null;
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: recSrc });
const done = async () => {
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
  if (inj48) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj48.identifier });
};
await view(1440, 900, false, false);
await nav(`http://localhost:${PORT}/test.html?ns=searec${Date.now()}`);
await sleep(800);
await click(700, 12); await sleep(200);
const on = await ev(`Sound.set({ on: true, vol: 0.7, ui: false, events: true, sonify: false }, { quiet: true }); await new Promise((r) => setTimeout(r, 700)); Sound.state()`);
// the example by its name in the gallery (SEA_EX: its index instead)
let exi = process.env.SEA_EX != null ? +process.env.SEA_EX : -1;
if (exi < 0) {
  await clickSel('#examplesBtn'); await sleep(600);
  exi = await ev(`[...document.querySelectorAll('#popHost .examples .ex-item .ex-name')].findIndex((e) => e.textContent === 'In the Hall of the Mountain King')`);
  await key('Escape'); await sleep(200);
}
if (exi < 0) { await done(); return { err: 'the example is not in the gallery' }; }
await ev(`__cmwExample(${exi}); 1`); await sleep(2500);
const name = await ev(`document.querySelector('#examplesBtn .exlabel').textContent`);
// Sound.along's handle (the glue calls the Sound object's along): its start, length, counts and scheduled events
await ev(`(() => { if (!window.__sgAlong0) window.__sgAlong0 = Sound.along; window.__sgA = null; Sound.along = function (...a) { const r = window.__sgAlong0.apply(this, a); window.__sgA = r; return r; }; return 1; })()`);
const listen = async () => {
  const p = await ev(`(() => { const q = SEASONG.pts[300]; return __cmwW2S('L', q[0], q[1]); })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p[0], y: p[1], button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p[0], y: p[1], button: 'right', buttons: 0, clickCount: 1 });
  await sleep(400);
  const xy = await ev(`(() => { const b = document.querySelector('#popHost .pop.menu.pm .mi[data-pm="listen"]'); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
  if (xy) await click(xy[0], xy[1]);
  return !!xy;
};
// the preparation (its samples are kept), then stopped
if (!(await listen())) { await done(); return { err: 'no Listen along item', name }; }
const tPrep = Date.now();
for (let i = 0; i < 400 && !(await ev('__cmwSound().play')); i++) await sleep(150);
const prepMs = Date.now() - tPrep;
if (!(await ev('__cmwSound().play'))) { await done(); return { err: 'Listen along did not start in 60 s', name, prepMs }; }
await key('Escape'); await sleep(1500);
const rec = await ev(`({ rec: !!__rec.ctx, err: __rec.err, engine: Sound.state().engine })`);
await ev(`await __rec.start(); 1`);
await sleep(200);
await listen();
await sleep(300);
const A = await ev(`(() => { const a = window.__sgA, s = __cmwSound(); if (!a) return null; return { t0: a.t0, dur: a.dur, mode: a.mode, counts: a.counts, play: s.play, fn: s.listenFn }; })()`);
const sec = process.env.SEA_SEC ? +process.env.SEA_SEC : (A ? A.dur : 20) + 2.5;
await sleep(1000 * sec - 300);
const st = await ev(`await __rec.stop()`, 60000);
const events = await ev(`(() => { const a = window.__sgA; return a && a.log ? [...a.log].map((e) => ({ at: e.at, k: e.k, c: e.c, db: e.db })) : []; })()`);
await ev(`(() => { if (window.__sgAlong0) Sound.along = window.__sgAlong0; return 1; })()`);
const parts = [];
for (let i = 0; i < st.bytes; i += 1 << 20) parts.push(Buffer.from(await ev(`__rec.chunk(${i}, ${1 << 20})`), 'base64'));
const f = path.join(OUT, 'mountain-king');
fs.writeFileSync(f + '.f32', Buffer.concat(parts));
fs.writeFileSync(f + '.json', JSON.stringify({ rate: st.rate, f0: st.f0, along: A, events, frames: st.frames, gaps: st.gaps, peak: st.peak }));
await done();
await ev(`Sound.set({ on: false }); 1`);
const kinds = {}; for (const e of events) kinds[e.k] = (kinds[e.k] || 0) + 1;
return { name, on: { on: on.on, audio: on.audio, engine: on.engine }, rec, prepMs, along: A, kinds, frames: st.frames, rate: st.rate, gaps: st.gaps, peak: st.peak, file: f + '.f32', logs: logs().filter((l) => !/404|Failed to load resource/.test(l.m)) };
