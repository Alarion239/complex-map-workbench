// The sea song as the app plays it (notes/sea-song/AS-BUILT.md): the example opened, Listen along chosen from the
// curve's menu, and what the app's AudioContext sends to its destination recorded sample-exact (test/sound_rec.js),
// 26 s (SEA_SEC). Writes <daemon>/rec/mountain-king.f32 (float32 stereo interleaved) and .json (rate, the harp's state, the
// onsets of the scheduled notes and ticks). Then: node test/seasong_wav.js <f32> <wav> and afconvert to AAC.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const OUT = path.join(DIR, 'rec');
fs.mkdirSync(OUT, { recursive: true });
const recSrc = fs.readFileSync(path.join(DIR, '..', 'sound_rec.js'), 'utf8');
// (the page's AudioContext forced to 48 kHz, as a 16 kHz default output, e.g. Bluetooth earbuds, would make it; SEA_48K=0 in the daemon's environment: the device's own rate)
const inj48 = process.env.SEA_48K !== '0' ? await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const A = window.AudioContext; if (!A) return; window.AudioContext = class extends A { constructor(o) { super(Object.assign({ sampleRate: 48000 }, o || {})); } }; })();` }) : null;
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: recSrc });
await view(1440, 900, false, false);
await nav(`http://localhost:${PORT}/test.html?ns=searec${Date.now()}`);
await sleep(800);
await click(700, 12); await sleep(200);
const on = await ev(`Sound.set({ on: true, vol: 0.7, ui: false, events: true, sonify: false }, { quiet: true }); await new Promise((r) => setTimeout(r, 700)); Sound.state()`);
const exi = +(process.env.SEA_EX || 14);
await ev(`__cmwExample(${exi}); 1`); await sleep(2500);
const name = await ev(`document.querySelector('#examplesBtn .exlabel').textContent`);
const p = await ev(`(() => { const q = SEASONG.pts[300]; return __cmwW2S('L', q[0], q[1]); })()`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p[0], y: p[1], button: 'right', buttons: 2, clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p[0], y: p[1], button: 'right', buttons: 0, clickCount: 1 });
await sleep(400);
const xy = await ev(`(() => { const b = document.querySelector('#popHost .pop.menu.pm .mi[data-pm="listen"]'); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
if (!xy) return { err: 'no Listen along item', name };
const rec = await ev(`({ rec: !!__rec.ctx, err: __rec.err, engine: Sound.state().engine })`);
await ev(`window.__cues = []; Sound.cueHook((t, c) => __cues.push([t, c.str ? 1 : 0])); await __rec.start(); 1`);
const t0 = await ev(`Sound.debug().ctx.currentTime`);
await click(xy[0], xy[1]);
await sleep(300);
const harp = await ev(`__cmwSound().listenHarp`);
await sleep(1000 * (+(process.env.SEA_SEC || 26)) - 300);   // (round 2: 22.97 s and the ring-out)
const st = await ev(`await __rec.stop()`, 60000);
const cues = await ev(`(() => { Sound.cueHook(null); return __cues; })()`);
const synth = await ev(`await Sound.stat()`);
const parts = [];
for (let i = 0; i < st.bytes; i += 1 << 20) parts.push(Buffer.from(await ev(`__rec.chunk(${i}, ${1 << 20})`), 'base64'));
const f = path.join(OUT, 'mountain-king');
fs.writeFileSync(f + '.f32', Buffer.concat(parts));
fs.writeFileSync(f + '.json', JSON.stringify({ rate: st.rate, f0: st.f0, t0, harp, cues, frames: st.frames, gaps: st.gaps, peak: st.peak }));
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
if (inj48) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj48.identifier });
await ev(`Sound.set({ on: false }); 1`);
return { name, on: { on: on.on, audio: on.audio, engine: on.engine }, rec, harp, synth, frames: st.frames, rate: st.rate, gaps: st.gaps, peak: st.peak, cues: cues.length, logs: logs().filter((l) => !/404|Failed to load resource/.test(l.m)) };
