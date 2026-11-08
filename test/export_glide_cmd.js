// The steps view's Export → Video: the glide along the thread rendered off-screen frame by frame (Figure.makeVideo on the
// steps view's glide plan). For Strip to disk and the zeta function: the video has the frames videoTimes() gives for the
// thread's steps, the size, fps and an H.264 or VP9 codec; a decoded frame matches the exact render at its time; a
// parked frame of the glide matches the pane the screen draws at the same thread position; the thread's place, Play range
// and the pane are as they were afterwards; the dialog lists Video and says where it goes and how long it is. The same on the
// sphere and the Landscape: the glide is recorded in the screen's 3D camera at the frame's own aspect.
// A command file for a CDP daemon:  <runner> test/export_glide_cmd.js
const fails = [], info = {};
// a pixel of the frame is 'drawn' where it differs from the frame's own paper by more than this (summed over r, g, b)
const DRAWN = 60;
// a 3D frame has its picture on it when more than this share of its pixels is drawn (a globe fills about a third of its frame, so
// this says the picture is there and not the paper alone)
const DRAWN_MIN = 0.04;
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
await load('xgl' + Date.now(), {});
const base = await ev('location.origin');
let ns = 0;
const open = async (exN, surf) => {
  await go(`${base}/test.html?view=steps&ns=xgl${Date.now() % 1e7}${ns++}`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure', max: 30000 });
  await ev(`(__cmwExample(${exN}), 1)`);
  await adopted();
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
  // ruling 2 (#635): the video's first frame, at rest on the first plane, shows the still export's picture of that plane:
  // the still's panel (its art image, in the figure's pt) against the video frame cropped to the still's window, the frame
  // being that window widened to 16:9 (both at 320 px wide, so the pixels compare the same picture)
  const fp = await ev(`await (async () => { try {
    const mv = await __cmwFig.makeVideo({ video: { size: '1280x720', fps: 30, secs: 2, ends: 'once' }, keepForCheck: true });
    const chk = await __cmwFig.videoCheck(0, 640, 360), end = await __cmwFig.videoCheck(mv.frames - 1, 640, 360);
    const f = await __cmwFig.build({});
    if (!f) return { none: 1 };
    const ld = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const dv = await ld(chk.decoded);
    // the still's panel against the frame cropped to the still's window is the plane's picture: a globe or a relief has
    // no window of the still's to crop to, and its frames are compared with the screen's pane below
    let mad = null, im = null;
    if (${surf === 'plane'}) {
    if (!f.box) return { none: 1 };
    const bmp = await createImageBitmap(await __cmwFig.png(f, 150)), k = bmp.width / f.W;
    im = [...f.svg.matchAll(/<image x="([-0-9.]+)" y="([-0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g)].map((m) => m.slice(1).map(Number)).sort((p, q) => q[2] * q[3] - p[2] * p[3])[0];
    const w = 320, h = Math.round(w * im[3] / im[2]);
    const still = document.createElement('canvas'); still.width = w; still.height = h;
    still.getContext('2d').drawImage(bmp, im[0] * k, im[1] * k, im[2] * k, im[3] * k, 0, 0, w, h);
    // the frame's window: f.box widened about its centre to 16:9
    const b = f.box, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    let bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    // (the picture is the frame but for the key's column at the right: chk.pic of its width)
    const asp = chk.pic * 16 / 9;
    if (bw / bh > asp) bh = bw / asp; else bw = bh * asp;
    const sx = chk.pic * dv.width / bw, sy = dv.height / bh;
    const vid = document.createElement('canvas'); vid.width = w; vid.height = h;
    vid.getContext('2d').drawImage(dv, (b.x0 - (cx - bw / 2)) * sx, ((cy + bh / 2) - b.y1) * sy, (b.x1 - b.x0) * sx, (b.y1 - b.y0) * sy, 0, 0, w, h);
    const a = vid.getContext('2d').getImageData(0, 0, w, h).data, c = still.getContext('2d').getImageData(0, 0, w, h).data;
    let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - c[i]) + Math.abs(a[i + 1] - c[i + 1]) + Math.abs(a[i + 2] - c[i + 2]);
    mad = s / (w * h * 3);
    }
    // the chrome, drawn the same on every frame: the key's ring (first frame against the last), and the still (ruling B of #943)
    // draws what the pane draws: no level curves of its own
    const de = await ld(end.decoded), rc = (img) => { const c = document.createElement('canvas'); c.width = 60; c.height = 80; c.getContext('2d').drawImage(img, 0.89 * img.width, 0.1 * img.height, 0.08 * img.width, 0.14 * img.height, 0, 0, 60, 80); return c.getContext('2d').getImageData(0, 0, 60, 80).data; };
    const r0 = rc(dv), r1 = rc(de); let sr = 0; for (let i = 0; i < r0.length; i += 4) sr += Math.abs(r0[i] - r1[i]) + Math.abs(r0[i + 1] - r1[i + 1]) + Math.abs(r0[i + 2] - r1[i + 2]);
    return { mad, ring: sr / (60 * 80 * 3), lvl: f.svg.includes('stroke="#1a1a1a"'), W: f.W, H: f.H, panel: im, t: chk.t };
  } catch (e) { return { err: String(e && e.stack || e).slice(0, 600) }; } })()`, 300000);
  info[tag + ' first frame vs PNG'] = fp;
  if (surf === 'plane') ok(`${tag}: the first frame at rest equals the still PNG of the first plane`, fp && !fp.err && fp.mad != null && fp.mad < 12, fp);
  ok(`${tag}: the key's ring is the same on the first and the last frame`, fp && fp.ring != null && fp.ring < 6, fp);
  ok(`${tag}: the still draws no level curves of its own`, fp && fp.lvl === false, fp);
  // a parked frame against the screen at the same place; a globe or a relief has no window of the still's to crop to, so its
  // first frame, at rest on the first plane, is judged the same way (parked at x = 0)
  // (the Landscape with Inside regions draws only the region, a strip of under 4 % of the frame on plane z at rest: there
  // the frame is judged with the colour Everywhere, the surface drawn whole; at x = 0.5 with Inside regions, as the example is)
  for (const [park, scope] of surf === 'plane' ? [[0.5, null]] : [[0, surf === 'land' ? 'all' : null], [0.5, null]]) {
    const s = await ev(`await (async () => {
      ${scope ? `__cmwSteps({ scope: '${scope}' });` : ''}
      __cmwSteps({ park: ${park} });
      for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
      if (GLR.gpuDone) await GLR.gpuDone();
      const cvs = [...document.querySelectorAll('#plotL canvas')].map((e) => [e, e.getBoundingClientRect()]).sort((p, q) => q[1].width * q[1].height - p[1].width * p[1].height)[0];
      const w = 96, h = Math.max(8, Math.round(w * cvs[1].height / cvs[1].width));
      const a = document.createElement('canvas'); a.width = w; a.height = h; a.getContext('2d').drawImage(cvs[0], 0, 0, w, h);
      const r = await __cmwFig.glideArt(${park}, { wpt: cvs[1].width * 72 / 96, hpt: ${surf === 'plane' ? 'undefined' : 'cvs[1].height * 72 / 96'}, dpi: 96, raw: true, look: 'light' });
      const b = document.createElement('canvas'); b.width = w; b.height = h; b.getContext('2d').drawImage(r.cv, 0, 0, w, h);
      const da = a.getContext('2d').getImageData(0, 0, w, h).data, db = b.getContext('2d').getImageData(0, 0, w, h).data;
      // (the 3D surfaces: the video's paper is white and the screen's is its tinted ground, so only the pixels the frame draws
      // something on are compared: the picture and its camera)
      const three = ${surf !== 'plane'}, bg = [db[0], db[1], db[2]];
      let sum = 0, n = 0;
      for (let i = 0; i < da.length; i += 4) {
        if (three && Math.abs(db[i] - bg[0]) + Math.abs(db[i + 1] - bg[1]) + Math.abs(db[i + 2] - bg[2]) <= ${DRAWN}) continue;
        sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); n++;
      }
      return { mad: sum / (Math.max(1, n) * 3), drawn: n / (w * h), x: __cmwSteps().x };
    })()`, 120000);
    info[tag + ' screen ' + park] = s;
    if (scope) await ev(`(__cmwSteps({ scope: 'in' }), 1)`);
    ok(`${tag}: a frame at x = ${park} matches the screen parked there`, s && s.mad < 14 && (surf === 'plane' || s.drawn > DRAWN_MIN) && Math.abs(s.x - park) < 1e-6, s);
  }
}
// the picture check has teeth: a frame of paper alone has no drawn pixels, so it is below DRAWN_MIN
{
  const paperShare = await ev(`(() => { const w = 96, h = 54, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); const d = x.getImageData(0, 0, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > ${DRAWN}) n++; return n / (w * h); })()`);
  ok('a frame of paper alone is not a drawn picture (its drawn share is under DRAWN_MIN)', paperShare <= DRAWN_MIN, paperShare);
}
// the dialog: Video is listed, with where it goes and how long it is
// the key and the axis title the video draws are the pane's own and follow the thread: the pane is read parked at each plane
// (its key caption, or the line saying where the colour is carried from, and its title's plane), then svKey is read from
// plane 0 at each plane and either side of each midpoint between two (the words change at the midpoint)
await open(1, 'plane');
const nPl = await ev('__cmwSteps().planes.length');
let carriedSeen = 0;
// (T at the last plane, where each plane is coloured by its own map, and T = 0, where the later planes carry z's colour)
for (const T of ['null', 0]) {
  if (T !== 'null') await ev(`(__cmwSteps({ T: ${T} }), 1)`);
  const pane = [];
  for (let i = 0; i < nPl; i++) {
    await ev(`(__cmwSteps({ go: ${i}, now: true }), 1)`);
    await settled({ until: `!__cmwSteps().moving && __cmwSteps().i === ${i}`, max: 15000 });
    pane.push(JSON.parse(await ev(`JSON.stringify({ cap: __cmwLegend().caption, title: __cmwSteps().names.title.name.replace(/<\\/?i>/g, '').replace(/<sub>(\\d+)<\\/sub>/g, (m, d) => [...d].map((c) => '₀₁₂₃₄₅₆₇₈₉'[c]).join('')) })`)));
  }
  await ev(`(__cmwSteps({ go: 0, now: true }), 1)`);
  await settled({ until: '!__cmwSteps().moving && __cmwSteps().i === 0', max: 15000 });
  for (let i = 0; i < nPl; i++) for (const [dx, at] of [[0, i], [0.4, i], [-0.4, i], [0.6, i + 1], [-0.6, i - 1]]) {
    const x = i + dx, want = pane[Math.max(0, Math.min(nPl - 1, at))];
    if (x < 0 || x > nPl - 1) continue;
    const k = JSON.parse(await ev(`JSON.stringify(__cmwFig.svKey(${x}))`));
    if (k.carried) carriedSeen++;
    info[`key T ${T} at ${x}`] = { k, want };
    ok(`T ${T}, thread position ${x}: the key's words are the pane's at plane ${at}`, (k.carried ? k.carried.text : k.caption) === want.cap && k.title === want.title, { k, want });
  }
}
ok('past the colour plane the key says where the colour is carried from', carriedSeen > 0, { carriedSeen });
// the still of a plane is the Phase picture (with the pane's key) on a coloured plane; past the colour plane, where the pane's
// key says where the colour is carried from, the pane is not in Phase and the still is the plane picture, which has no key
for (const [T, go, want] of [[0, 1, 'xyL'], [nPl - 1, 0, 'phase']]) {
  await ev(`(__cmwSteps({ T: ${T} }), __cmwSteps({ go: ${go}, now: true }), 1)`);
  await settled({ until: `!__cmwSteps().moving && __cmwSteps().i === ${go} && __cmwSteps().T === ${T}`, max: 15000 });
  const sv = await ev(`await (async () => { const f = await __cmwFig.build({}); return f && f.view; })()`, 60000);
  ok(`T ${T}, plane ${go}: the still is built as ${want}`, sv === want, sv);
}
await open(1, 'plane');
const d = await ev(`await (async () => { const until = async (f) => { for (let i = 0; i < 600 && !f(); i++) await new Promise((r) => requestAnimationFrame(r)); return f(); }; Figure.open(); await until(() => document.querySelector('#xfFmt [data-v="video"]')); const b = document.querySelector('#xfFmt [data-v="video"]'); b && b.click(); await until(() => (document.getElementById('xfVSum') || {}).textContent); const s = document.getElementById('xfVSum'); return { video: !!b && !b.disabled, sum: s ? s.textContent : null }; })()`, 60000);
ok('the dialog offers Video with the summary line', d && d.video && /→.*· [0-9.,]+ s/.test(d.sum || ''), d);
// UX60 (classic's check, ported to the steps view): Video is listed with no step to record too; it is aria-disabled with
// the reason "Add a step to make a video", and a click neither chooses it nor opens the dialog on it
// (a chain of one plane: an empty steps chain saved as the page's state, as steps_empty_cmd.js does)
await loadView('steps', 'xgl0' + Date.now() % 1e7, { v6: true, shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [], srcView: { cx: 0, cy: 0, s: 90 } }, { lang: 'en' });
await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure', max: 30000 });
const bare = await ev(`await (async () => { const until = async (f) => { for (let i = 0; i < 600 && !f(); i++) await new Promise((r) => requestAnimationFrame(r)); return f(); }; const n = __cmwSteps().planes.length; Figure.open(); await until(() => document.querySelector('#xfFmt [data-v="video"]')); const b = document.querySelector('#xfFmt [data-v="video"]'); const fmts = [...document.querySelectorAll('#xfFmt > button')].map((x) => x.dataset.v); b.click(); return { n, fmts, aria: b.getAttribute('aria-disabled'), tip: b.dataset.tip, checked: b.getAttribute('aria-checked'), still: !!document.querySelector('#xfFmt'), vsum: !!document.getElementById('xfVSum') }; })()`, 60000);
info['video with no step'] = bare;
ok('no step: the chain has one plane and Video is listed in the Format row', bare && bare.n < 2 && bare.fmts && bare.fmts.includes('video'), bare);
ok('no step: Video is aria-disabled with "Add a step to make a video" as its tip, a click does not choose it', bare && bare.aria === 'true' && bare.tip === 'Add a step to make a video' && bare.checked === 'false' && bare.still && !bare.vsum, bare);
await ev(`(document.querySelector('.xf-x') && document.querySelector('.xf-x').click(), 1)`);
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
