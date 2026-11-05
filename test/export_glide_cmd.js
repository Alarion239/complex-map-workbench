// The steps view's Export → Video: the glide along the thread rendered off-screen frame by frame (Figure.makeVideo on the
// steps view's glide plan). For Strip to disk and the zeta function: the video has the frames videoTimes() gives for the
// thread's steps, the size, fps and an H.264 or VP9 codec; a decoded frame matches the exact render at its time; a
// parked frame of the glide matches the pane the screen draws at the same thread position; the thread's place, Play range
// and the pane are as they were afterwards; the dialog lists Video and says where it goes and how long it is. The same on the
// sphere and the Landscape: the glide is recorded in the screen's 3D camera at the frame's own aspect.
// A command file for a CDP daemon:  <runner> test/export_glide_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
await load('xgl' + Date.now(), {});
const base = await ev('location.origin');
let ns = 0;
const open = async (exN, surf) => {
  await go(`${base}/test.html?view=steps&ns=xgl${Date.now() % 1e7}${ns++}`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure', max: 30000 });
  await ev(`(__cmwExample(${exN}), 1)`);
  await settled({ until: '__cmwSteps().planes.length > 0', max: 15000, floor: 300 });
  await ev(`(__cmwSteps({ surf: '${surf}' }), __cmwSteps({ go: 0, now: true }), __cmwSet('wKey', false), 1)`);
  await settled({ until: '!__cmwSteps().moving', max: 15000, floor: 400 });
};
for (const [exN, surf] of [[1, 'plane'], [18, 'plane'], [1, 'sphere'], [1, 'land']]) {
  const tag = `ex ${exN} ${surf}`;
  await open(exN, surf);
  const vopt = { size: '1280x720', fps: 30, secs: 2, ends: 'once' };
  const v = await ev(`await (async () => { try {
    const g = __cmwFig.glide(), at0 = __cmwSteps().x;
    const r = await __cmwFig.makeVideo({ video: ${JSON.stringify(vopt)}, keepForCheck: true });
    const n = __cmwFig.videoTimes(${JSON.stringify(vopt)}, g.hi - g.lo).length, k = Math.floor(r.frames * 0.4), chk = await __cmwFig.videoCheck(k, 256, 144);
    return { g, at0, at1: __cmwSteps().x, ext: r.ext, codec: r.codec, frames: r.frames, expect: n, fps: r.fps, W: r.W, H: r.H, mad: chk && chk.mad, t: chk && chk.t };
  } catch (e) { return { err: String(e && e.stack || e).slice(0, 600) }; } })()`, 600000);
  if (!v || v.err) { fails.push({ name: `${tag}: video`, got: v }); continue; }
  info[tag] = v;
  ok(`${tag}: the glide spans the thread (${v.g && v.g.from} to ${v.g && v.g.to})`, v.g && v.g.hi > v.g.lo, v.g);
  ok(`${tag}: the frame count is videoTimes()'s`, v.frames === v.expect && v.frames > 0, v);
  ok(`${tag}: 1280 x 720 at 30 fps, H.264 or VP9`, v.W === 1280 && v.H === 720 && v.fps === 30 && /^(avc1|vp0?9|vp8)/.test(v.codec), v);
  ok(`${tag}: a decoded frame matches the exact render at its time`, v.mad != null && v.mad < 12, v);
  ok(`${tag}: the thread's place is where it was`, v.at0 === v.at1, v);
  // a parked frame against the screen at the same place
  const s = await ev(`await (async () => {
    __cmwSteps({ park: 0.5 });
    for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
    if (GLR.gpuDone) await GLR.gpuDone();
    const cvs = [...document.querySelectorAll('#plotL canvas')].map((e) => [e, e.getBoundingClientRect()]).sort((p, q) => q[1].width * q[1].height - p[1].width * p[1].height)[0];
    const w = 96, h = Math.max(8, Math.round(w * cvs[1].height / cvs[1].width));
    const a = document.createElement('canvas'); a.width = w; a.height = h; a.getContext('2d').drawImage(cvs[0], 0, 0, w, h);
    const r = await __cmwFig.glideArt(0.5, { wpt: cvs[1].width * 72 / 96, hpt: ${surf === 'plane' ? 'undefined' : 'cvs[1].height * 72 / 96'}, dpi: 96, raw: true, look: 'light' });
    const b = document.createElement('canvas'); b.width = w; b.height = h; b.getContext('2d').drawImage(r.cv, 0, 0, w, h);
    const da = a.getContext('2d').getImageData(0, 0, w, h).data, db = b.getContext('2d').getImageData(0, 0, w, h).data;
    let sum = 0; for (let i = 0; i < da.length; i += 4) sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
    return { mad: sum / (w * h * 3), x: __cmwSteps().x };
  })()`, 120000);
  info[tag + ' screen'] = s;
  ok(`${tag}: a frame at x = 0.5 matches the screen parked there`, s && s.mad < 14 && Math.abs(s.x - 0.5) < 1e-6, s);
}
// the dialog: Video is listed, with where it goes and how long it is
await open(1, 'plane');
const d = await ev(`await (async () => { const until = async (f) => { for (let i = 0; i < 600 && !f(); i++) await new Promise((r) => requestAnimationFrame(r)); return f(); }; Figure.open(); await until(() => document.querySelector('#xfFmt [data-v="video"]')); const b = document.querySelector('#xfFmt [data-v="video"]'); b && b.click(); await until(() => (document.getElementById('xfVSum') || {}).textContent); const s = document.getElementById('xfVSum'); return { video: !!b && !b.disabled, sum: s ? s.textContent : null }; })()`, 60000);
ok('the dialog offers Video with the summary line', d && d.video && /→.*· [0-9.,]+ s/.test(d.sum || ''), d);
// the glide is recorded on the sphere and the Landscape, and the plane-only gate is gone
for (const surf of ['sphere', 'land']) {
  await open(1, surf);
  const g = await ev('__cmwFig.glide()');
  ok(`${surf}: the glide is offered with its surface`, g && g.surf === surf && g.hi > g.lo, g);
  const q = await ev(`await (async () => { const until = async (f) => { for (let i = 0; i < 600 && !f(); i++) await new Promise((r) => requestAnimationFrame(r)); return f(); }; Figure.open(); await until(() => document.querySelector('#xfFmt [data-v="video"]')); const b = document.querySelector('#xfFmt [data-v="video"]'); b.click(); await until(() => (document.getElementById('xfVSum') || {}).textContent); return { aria: b.getAttribute('aria-disabled'), sum: (document.getElementById('xfVSum') || {}).textContent }; })()`, 60000);
  ok(`${surf}: Video is enabled in the dialog, with the summary line`, q && q.aria !== 'true' && /→.*· [0-9.,]+ s/.test(q.sum || ''), q);
  await ev(`(document.querySelector('.xf-x') && document.querySelector('.xf-x').click(), 1)`);
}
return { pass: fails.length === 0, fails, info };
