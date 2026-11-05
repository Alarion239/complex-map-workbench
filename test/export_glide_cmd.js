// The steps view's Export → Video: the glide along the thread rendered off-screen frame by frame (Figure.makeVideo on the
// steps view's glide plan). For Strip to disk and the zeta function: the video has the frames videoTimes() gives for the
// thread's steps, the size, fps and an H.264 or VP9 codec; a decoded frame matches the exact render at its time; a
// parked frame of the glide matches the pane the screen draws at the same thread position; the thread's place, Play range
// and the pane are as they were afterwards; the dialog lists Video and says where it goes and how long it is; on the
// sphere and the Landscape the glide is not offered as a 2D video.
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
for (const exN of [1, 18]) {
  const tag = `ex ${exN}`;
  await open(exN, 'plane');
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
  // ruling 2 (#635): the video's first frame, at rest on the first plane, shows the still export's picture of that plane:
  // the still's panel (its art image, in the figure's pt) against the video frame cropped to the still's window, the frame
  // being that window widened to 16:9 (both at 320 px wide, so the pixels compare the same picture)
  const fp = await ev(`await (async () => { try {
    const mv = await __cmwFig.makeVideo({ video: { size: '1280x720', fps: 30, secs: 2, ends: 'once' }, keepForCheck: true });
    const chk = await __cmwFig.videoCheck(0, 640, 360), end = await __cmwFig.videoCheck(mv.frames - 1, 640, 360);
    const f = await __cmwFig.build({});
    if (!f || !f.box) return { none: 1 };
    const bmp = await createImageBitmap(await __cmwFig.png(f, 150)), k = bmp.width / f.W;
    const im = [...f.svg.matchAll(/<image x="([-0-9.]+)" y="([-0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g)].map((m) => m.slice(1).map(Number)).sort((p, q) => q[2] * q[3] - p[2] * p[3])[0];
    const ld = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const dv = await ld(chk.decoded), w = 320, h = Math.round(w * im[3] / im[2]);
    const still = document.createElement('canvas'); still.width = w; still.height = h;
    still.getContext('2d').drawImage(bmp, im[0] * k, im[1] * k, im[2] * k, im[3] * k, 0, 0, w, h);
    // the frame's window: f.box widened about its centre to 16:9
    const b = f.box, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    let bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    if (bw / bh > 16 / 9) bh = bw * 9 / 16; else bw = bh * 16 / 9;
    const sx = dv.width / bw, sy = dv.height / bh;
    const vid = document.createElement('canvas'); vid.width = w; vid.height = h;
    vid.getContext('2d').drawImage(dv, (b.x0 - (cx - bw / 2)) * sx, ((cy + bh / 2) - b.y1) * sy, (b.x1 - b.x0) * sx, (b.y1 - b.y0) * sy, 0, 0, w, h);
    const a = vid.getContext('2d').getImageData(0, 0, w, h).data, c = still.getContext('2d').getImageData(0, 0, w, h).data;
    let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - c[i]) + Math.abs(a[i + 1] - c[i + 1]) + Math.abs(a[i + 2] - c[i + 2]);
    // the chrome, drawn the same on every frame: the key's ring (first frame against the last), and the still (ruling B of #943)
    // draws what the pane draws: no level curves of its own
    const de = await ld(end.decoded), rc = (img) => { const c = document.createElement('canvas'); c.width = 60; c.height = 80; c.getContext('2d').drawImage(img, 0.89 * img.width, 0.1 * img.height, 0.08 * img.width, 0.14 * img.height, 0, 0, 60, 80); return c.getContext('2d').getImageData(0, 0, 60, 80).data; };
    const r0 = rc(dv), r1 = rc(de); let sr = 0; for (let i = 0; i < r0.length; i += 4) sr += Math.abs(r0[i] - r1[i]) + Math.abs(r0[i + 1] - r1[i + 1]) + Math.abs(r0[i + 2] - r1[i + 2]);
    return { mad: s / (w * h * 3), ring: sr / (60 * 80 * 3), lvl: f.svg.includes('stroke="#1a1a1a"'), W: f.W, H: f.H, panel: im, t: chk.t };
  } catch (e) { return { err: String(e && e.stack || e).slice(0, 600) }; } })()`, 300000);
  info[tag + ' first frame vs PNG'] = fp;
  ok(`${tag}: the first frame at rest equals the still PNG of the first plane`, fp && !fp.err && fp.mad != null && fp.mad < 12, fp);
  ok(`${tag}: the key's ring is the same on the first and the last frame`, fp && fp.ring != null && fp.ring < 6, fp);
  ok(`${tag}: the still draws no level curves of its own`, fp && fp.lvl === false, fp);
  // a parked frame against the screen at the same place
  const s = await ev(`await (async () => {
    __cmwSteps({ park: 0.5 });
    for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
    if (GLR.gpuDone) await GLR.gpuDone();
    const cvs = [...document.querySelectorAll('#plotL canvas')].map((e) => [e, e.getBoundingClientRect()]).sort((p, q) => q[1].width * q[1].height - p[1].width * p[1].height)[0];
    const w = 96, h = Math.max(8, Math.round(w * cvs[1].height / cvs[1].width));
    const a = document.createElement('canvas'); a.width = w; a.height = h; a.getContext('2d').drawImage(cvs[0], 0, 0, w, h);
    const r = await __cmwFig.glideArt(0.5, { wpt: cvs[1].width * 72 / 96, dpi: 96, raw: true, look: 'light' });
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
// UX60 (classic's check, ported to the steps view): Video is listed with no step to record too; it is aria-disabled with
// the reason "Add a step to make a video", and a click neither chooses it nor opens the dialog on it
// (a chain of one plane: an empty steps chain saved as the page's state, as steps_empty_cmd.js does)
await loadView('steps', 'xgl0' + Date.now() % 1e7, { v6: true, shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 90 } }, { lang: 'en' });
await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure', max: 30000 });
const bare = await ev(`await (async () => { const until = async (f) => { for (let i = 0; i < 600 && !f(); i++) await new Promise((r) => requestAnimationFrame(r)); return f(); }; const n = __cmwSteps().planes.length; Figure.open(); await until(() => document.querySelector('#xfFmt [data-v="video"]')); const b = document.querySelector('#xfFmt [data-v="video"]'); const fmts = [...document.querySelectorAll('#xfFmt > button')].map((x) => x.dataset.v); b.click(); await new Promise((r) => setTimeout(r, 200)); return { n, fmts, aria: b.getAttribute('aria-disabled'), tip: b.dataset.tip, checked: b.getAttribute('aria-checked'), still: !!document.querySelector('#xfFmt'), vsum: !!document.getElementById('xfVSum') }; })()`, 60000);
info['video with no step'] = bare;
ok('no step: the chain has one plane and Video is listed in the Format row', bare && bare.n < 2 && bare.fmts && bare.fmts.includes('video'), bare);
ok('no step: Video is aria-disabled with "Add a step to make a video" as its tip, a click does not choose it', bare && bare.aria === 'true' && bare.tip === 'Add a step to make a video' && bare.checked === 'false' && bare.still && !bare.vsum, bare);
await ev(`(document.querySelector('.xf-x') && document.querySelector('.xf-x').click(), 1)`);
// the sphere: no silent 2D
await ev(`(document.querySelector('.xf-x') && document.querySelector('.xf-x').click(), 1)`);
await open(1, 'sphere');
const sp = await ev('__cmwFig.glide()');
ok('on the sphere the plane glide is not offered', sp === null, sp);
// on the sphere and the Landscape Video stays listed but unavailable, with its reason for the keyboard and screen readers, and a
// click neither selects it nor turns the deformation on
for (const [surf, want] of [['sphere', 'Video of the sphere is not ready yet'], ['land', 'Video of the Landscape is not ready yet']]) {
  await open(1, surf);
  const q = await ev(`await (async () => { const until = async (f) => { for (let i = 0; i < 600 && !f(); i++) await new Promise((r) => requestAnimationFrame(r)); return f(); }; Figure.open(); await until(() => document.querySelector('#xfFmt [data-v="video"]')); const b = document.querySelector('#xfFmt [data-v="video"]'); b.click(); await new Promise((r) => setTimeout(r, 200)); return { aria: b.getAttribute('aria-disabled'), tip: b.dataset.tip, desc: b.getAttribute('aria-description'), disabled: b.disabled, checked: b.getAttribute('aria-checked'), still: !!document.querySelector('#xfFmt'), vsum: !!document.getElementById('xfVSum') }; })()`, 60000);
  info['video on ' + surf] = q;
  ok(`${surf}: Video is aria-disabled, focusable, with the reason as tip and description`, q && q.aria === 'true' && q.disabled === false && q.tip === want && q.desc === want, q);
  ok(`${surf}: a click on Video does nothing (dialog stays open, Video not chosen)`, q && q.checked === 'false' && q.still && !q.vsum, q);
  await ev(`(document.querySelector('.xf-x') && document.querySelector('.xf-x').click(), 1)`);
}
return { pass: fails.length === 0, fails, info };
