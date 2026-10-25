// pitch review: record the Mountain King as the app plays it, logging every cue's partials. MODE = 'desk' | 'phone'
const MODE = '__MODE__';
const PHONE = MODE === 'phone';
const PORT = 9312;
const OUT = path.join(DIR, 'rec'); fs.mkdirSync(OUT, { recursive: true });
const recSrc = fs.readFileSync(path.join(DIR, '..', 'sound_rec.js'), 'utf8');
const inj48 = await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const A = window.AudioContext; if (!A) return; window.AudioContext = class extends A { constructor(o) { super(Object.assign({ sampleRate: 48000 }, o || {})); } }; })();` });
const inj = await send('Page.addScriptToEvaluateOnNewDocument', { source: recSrc });
let ua = null;
if (PHONE) { ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'; await send('Emulation.setUserAgentOverride', { userAgent: ua, platform: 'Android' }); }
await view(PHONE ? 412 : 1440, PHONE ? 915 : 900, false, PHONE);
await nav(`http://localhost:${PORT}/test.html?ns=pr${MODE}${Date.now()}`);
await sleep(900);
const touch = async (x, y, ms = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(ms); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300); };
if (PHONE) await touch(200, 12); else { await click(700, 12); await sleep(200); }
const on = await ev(`Sound.set({ on: true, vol: 0.7, ui: false, events: true, sonify: false }, { quiet: true }); await new Promise((r) => setTimeout(r, 700)); Sound.state()`);
await ev(`__cmwExample(14); 1`); await sleep(2500);
const name = await ev(`document.querySelector('#examplesBtn .exlabel').textContent`);
const p = await ev(`(() => { const q = SEASONG.pts[300]; return __cmwW2S('L', q[0], q[1]); })()`);
if (PHONE) await touch(p[0], p[1], 700);
else { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p[0], y: p[1], button: 'right', buttons: 2, clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p[0], y: p[1], button: 'right', buttons: 0, clickCount: 1 }); await sleep(400); }
const xy = await ev(`(() => { const b = document.querySelector('#popHost .pop.menu.pm .mi[data-pm="listen"]'); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; })()`);
if (!xy) return { err: 'no Listen along item', name };
await ev(`window.__cues = []; Sound.cueHook((t, c) => __cues.push({ t, str: c.str ? 1 : 0, g: c.g, pan: c.pan, tag: c.tag, cap: c.cap || 0, m: c.parts.filter((q) => q.k === 'm').map((q) => [q.f, q.a, q.t60]), n: c.parts.filter((q) => q.k !== 'm').length })); await __rec.start(); 1`);
const t0 = await ev(`Sound.debug().ctx.currentTime`);
if (PHONE) await touch(xy[0], xy[1]); else await click(xy[0], xy[1]);
await sleep(300);
const harp = await ev(`__cmwSound().listenHarp`);
await sleep(26000 - 300);
const st = await ev(`await __rec.stop()`, 60000);
const cues = await ev(`(() => { Sound.cueHook(null); return __cues; })()`);
const synth = await ev(`await Sound.stat()`);
const parts = [];
for (let i = 0; i < st.bytes; i += 1 << 20) parts.push(Buffer.from(await ev(`__rec.chunk(${i}, ${1 << 20})`), 'base64'));
const f = path.join(OUT, 'mk_' + MODE);
fs.writeFileSync(f + '.f32', Buffer.concat(parts));
fs.writeFileSync(f + '.json', JSON.stringify({ rate: st.rate, f0: st.f0, t0, harp, cues, frames: st.frames, gaps: st.gaps, peak: st.peak, ua: await ev('navigator.userAgent'), coarse: await ev(`matchMedia('(pointer: coarse)').matches`) }));
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj.identifier });
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: inj48.identifier });
await ev(`Sound.set({ on: false }); 1`);
if (PHONE) await send('Emulation.setUserAgentOverride', { userAgent: '' });
return { MODE, name, on: { on: on.on, audio: on.audio, engine: on.engine }, harp, synth, frames: st.frames, rate: st.rate, gaps: st.gaps, peak: st.peak, cues: cues.length, logs: logs().filter((l) => !/404|Failed to load resource/.test(l.m)) };
