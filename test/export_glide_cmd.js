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
// a 3D first frame is compared with the still over the pixels the still draws, to this mean difference (of 255): the frame shows
// the screen's look and the still the art layer's fills, so the bound is above their gap and below the controls' (a globe agrees
// to about 3, the Landscape, whose relief window is rounded, to about 12)
const SPHERE_BOUND = 6, LAND_BOUND = 15;
// the share of the still's pixels that must be drawn for its comparison to say something
const STILL_DRAWN_MIN = 0.05;
// the 3 channels of a white pixel summed: a pixel is paper when its channels sum within DRAWN of this
const RGB_MAX = 765;
// the controls: the frame zoomed by this factor, and shifted by this share of the crop's width
const CONTROL_ZOOM = 1.1, CONTROL_SHIFT = 0.1;
// the still is compared at this width in px
const CMP_W = 320;
// a globe still's panel and the pane's canvas on the screen agree in width over height to this (css px rounding)
const ASPECT_TOL = 0.02;
// the options of the glide video every check here records: 1 s per step, as the other API-made videos (export_cmd.js; #531). A
// video renders secs x fps x steps frames and a hold shows its kept picture again, so the length is what the suite's time follows
const VIDEO_OPT = { size: '1280x720', fps: 30, secs: 1, ends: 'once' };
// makeVideo's evaluate wait (ms): the encode of a whole video
const VIDEO_WAIT_MS = 600000;
// the pane's settle limit (ms) after the thread is moved
const SETTLE_MAX_MS = 15000;
// the thread's position is parked to this tolerance (a step of the thread is 1)
const POS_TOL = 1e-6;
// the frame probe's size in px: the label does not depend on it
const PROBE_W = 192, PROBE_H = 108;
// the paths check parks the thread here (between the first two planes), draws the glide's frame at this width in pt, and takes the
// frames to differ where their summed channels do by more than DRAWN
const PATHS_PARK = 0.5, PATHS_FRAME_W = 400;
// Paths on draws on at least this share of the frame's pixels that Paths off leaves bare (the paths of the chain below
// cover about 0.7 % of it)
const PATHS_MIN_SHARE = 0.002;
// the steps view's Paths needs marked area to follow: a disc of z, then z² and a quarter turn of it (arcs)
const PATHS_CHAIN = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0,
  shapes: [{ id: 'd1', kind: 'disc', c: [0.3, 0.2], r: 1.4, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'affine', params: { a: 'i', b: '0' }, on: true }] };
// a box may overshoot the figure's size by this much (SVG units) to count as inside it
const FIT_SLACK = 0.01;
// the hue ring is marked 1, i, -1, -i
const RING_MARKS = 4;
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
  const v = await ev(`await (async () => { try {
    const g = __cmwFig.glide(), at0 = __cmwSteps().x;
    const r = await __cmwFig.makeVideo({ video: ${JSON.stringify(VIDEO_OPT)}, keepForCheck: true });
    const n = __cmwFig.videoTimes(${JSON.stringify(VIDEO_OPT)}, g.hi - g.lo).length, k = Math.floor(r.frames * 0.4), chk = await __cmwFig.videoCheck(k, 256, 144);
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
    const chk = await __cmwFig.videoCheck(0, 640, 360), end = await __cmwFig.videoCheck(${v.frames} - 1, 640, 360);
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
    const w = ${CMP_W}, h = Math.round(w * im[3] / im[2]);
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
    // a globe or a relief: the frame is the still's camera widened to 16:9 (the same eye, target and up, the same extent in the
    // still's height), so the still's picture is the frame's centre crop at the still's aspect (the Landscape's still crops the
    // relief to what is drawn: f.info.crop, as fractions of the render at the still's aspect). Compared over the pixels the
    // still draws (the frame's paper is white, but it carries a ground shadow and the screen's look), the frame also moved by
    // a tenth of the crop (a zoom, a shift) as controls the row must tell apart
    let three = null;
    if (${surf !== 'plane'}) {
      const bmp = await createImageBitmap(await __cmwFig.png(f, 150)), k = bmp.width / f.W;
      im = [...f.svg.matchAll(/<image x="([-0-9.]+)" y="([-0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g)].map((m) => m.slice(1).map(Number)).sort((p, q) => q[2] * q[3] - p[2] * p[3])[0];
      const w = ${CMP_W}, h = Math.round(w * im[3] / im[2]), asp = im[2] / im[3], cr = f.info && f.info.crop;
      const still = document.createElement('canvas'); still.width = w; still.height = h;
      const gs = still.getContext('2d'); gs.fillStyle = '#fff'; gs.fillRect(0, 0, w, h);
      gs.drawImage(bmp, im[0] * k, im[1] * k, im[2] * k, im[3] * k, 0, 0, w, h);
      const c = gs.getImageData(0, 0, w, h).data;
      const cmp = (img, picW, H, zoom, dx) => {
        let sx = picW / 2 - H * asp / 2, sy = 0, cw = H * asp, ch = H;
        if (cr) { const rw = H * cr.asp; sx = picW / 2 - rw / 2 + cr.x0 * rw; sy = cr.y0 * H; cw = (cr.x1 - cr.x0) * rw; ch = (cr.y1 - cr.y0) * H; }
        const mx = sx + cw / 2 + dx * cw, my = sy + ch / 2;
        cw /= zoom; ch /= zoom;
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
        g.drawImage(img, mx - cw / 2, my - ch / 2, cw, ch, 0, 0, w, h);
        const a = g.getImageData(0, 0, w, h).data;
        let sum = 0, n = 0;
        for (let i = 0; i < a.length; i += 4) { if (${RGB_MAX} - c[i] - c[i + 1] - c[i + 2] <= ${DRAWN}) continue; sum += Math.abs(a[i] - c[i]) + Math.abs(a[i + 1] - c[i + 1]) + Math.abs(a[i + 2] - c[i + 2]); n++; }
        return { mad: n ? sum / (n * 3) : null, n: n / (w * h) };
      };
      const picW = Math.round(chk.pic * dv.width), H = dv.height;
      // (the pane's canvas on the screen, measured here and not through the figure: its width over height is the still's panel's
      // for a globe)
      const pc = [...document.querySelectorAll('#plotL canvas')].map((e) => e.getBoundingClientRect()).sort((p, q) => q.width * q.height - p.width * p.height)[0];
      three = { first: cmp(dv, picW, H, 1, 0), zoom: cmp(dv, picW, H, ${CONTROL_ZOOM}, 0), shift: cmp(dv, picW, H, 1, ${CONTROL_SHIFT}), asp: +asp.toFixed(3), dom: pc ? +(pc.width / pc.height).toFixed(3) : null };
    }
    // the chrome, drawn the same on every frame: the key's ring (first frame against the last), and the still (ruling B of #943)
    // draws what the pane draws: no level curves of its own
    const de = await ld(end.decoded), rc = (img) => { const c = document.createElement('canvas'); c.width = 60; c.height = 80; c.getContext('2d').drawImage(img, 0.89 * img.width, 0.1 * img.height, 0.08 * img.width, 0.14 * img.height, 0, 0, 60, 80); return c.getContext('2d').getImageData(0, 0, 60, 80).data; };
    const r0 = rc(dv), r1 = rc(de); let sr = 0; for (let i = 0; i < r0.length; i += 4) sr += Math.abs(r0[i] - r1[i]) + Math.abs(r0[i + 1] - r1[i + 1]) + Math.abs(r0[i + 2] - r1[i + 2]);
    // (the sphere's marks 0, infinity, 1, i, -1, -i: the still names the marks that the first frame's code draws. The frame's are
    // the texts its code writes on its canvas as the frame is drawn, so a mark the frame leaves out is not assumed from the camera)
    let labels = null;
    if (${surf === 'sphere'}) {
      const P = CanvasRenderingContext2D.prototype, text = P.fillText, marks = ['0', '\u221e', '1', 'i', '\u22121', '\u2212i'], seen = new Set();
      P.fillText = function (t, ...a) { if (marks.includes(t)) seen.add(t); return text.call(this, t, ...a); };
      try { await __cmwFig.glideArt(0, { wpt: im[2], hpt: im[3], dpi: 96, raw: true, look: 'light' }); } finally { P.fillText = text; }
      const named = (b) => (b.tex.includes('infty') ? '\u221e' : b.tex.replace('-', '\u2212'));
      labels = { still: f.boxes.filter((b) => b.kind === 'globe-label').map(named).sort().join(' '), frame: [...seen].sort().join(' ') };
    }
    return { mad, three, labels, ring: sr / (60 * 80 * 3), lvl: f.svg.includes('stroke="#1a1a1a"'), W: f.W, H: f.H, panel: im, t: chk.t };
  } catch (e) { return { err: String(e && e.stack || e).slice(0, 600) }; } })()`, 300000);
  info[tag + ' first frame vs PNG'] = fp;
  if (surf === 'plane') ok(`${tag}: the first frame at rest equals the still PNG of the first plane`, fp && !fp.err && fp.mad != null && fp.mad < 12, fp);
  // (a bound for each: the frame shows the screen's look, the still the art layer's fills; the controls sit well above it)
  if (surf !== 'plane') {
    const t3 = fp && fp.three, bound = surf === 'sphere' ? SPHERE_BOUND : LAND_BOUND;
    ok(`${tag}: the first frame's centre crop is the still of the first plane (over the pixels the still draws, under ${bound} of 255)`, !!t3 && t3.first.mad != null && t3.first.n > STILL_DRAWN_MIN && t3.first.mad < bound, fp);
    // the still's shape is checked against the pane's own size, not against the figure's path that the frame also takes
    if (surf === 'sphere') ok(`${tag}: the globe still's panel has the pane's width over height (${t3 && t3.dom})`, !!t3 && t3.dom != null && Math.abs(t3.asp - t3.dom) < ASPECT_TOL, fp);
    if (surf === 'sphere') ok(`${tag}: the still names the sphere's marks that the first frame draws (${fp && fp.labels && fp.labels.frame})`, !!fp.labels && fp.labels.frame.length > 0 && fp.labels.still === fp.labels.frame, fp);
    ok(`${tag}: the same comparison fails on a frame zoomed by ${CONTROL_ZOOM} and on one shifted by ${CONTROL_SHIFT} of the crop`, !!t3 && t3.zoom.mad > bound && t3.shift.mad > bound, fp);
  }
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
// the glide's label words are the pane's readout: a frame's label, then the pane parked at the same place says it too. The
// pane's spoken value is the readout followed by the Play range's words, and no range is set here, so it is the label itself
{
  const lb = JSON.parse(await ev(`await (async () => { try {
    const g = __cmwFig.glide(), vopt = ${JSON.stringify(VIDEO_OPT)};
    const r = await __cmwFig.makeVideo({ video: vopt, keepForCheck: true }), chk = await __cmwFig.videoCheck(5, ${PROBE_W}, ${PROBE_H});
    return JSON.stringify({ lo: g.lo, hi: g.hi, t: chk && chk.t, label: chk && chk.label, frames: r.frames });
  } catch (e) { return JSON.stringify({ err: String(e && e.stack || e).slice(0, 600) }); } })()`, VIDEO_WAIT_MS));
  ok('a glide frame reports the label it drew', !lb.err && typeof lb.label === 'string' && lb.label.length > 0, lb);
  if (!lb.err && lb.label) {
    const park = async (x) => {
      await ev(`(__cmwSteps({ x: ${x} }), 1)`);
      await settled({ until: `Math.abs(__cmwSteps().x - ${x}) < ${POS_TOL} && !!document.querySelector('[role=slider][aria-valuetext]')`, max: SETTLE_MAX_MS });
      return ev(`document.querySelector('[role=slider][aria-valuetext]').getAttribute('aria-valuetext')`);
    };
    const said = await park(lb.lo + lb.t);
    ok('the pane parked where the frame stands says the frame\'s label', said === lb.label, { said, lb });
    // negative control: parked at the far end of the glide the pane says something else, so the equality above can fail
    const far = await park(lb.t < (lb.hi - lb.lo) / 2 ? lb.hi : lb.lo);
    ok('the pane parked at the other end of the glide does not say the frame\'s label', typeof far === 'string' && far !== lb.label, { far, lb });
  }
}
// the still of a plane is the Phase picture (with the pane's key) on a coloured plane; past the colour plane, where the pane's
// key says where the colour is carried from, the pane is not in Phase and the still is the plane picture with the pane's key line
for (const [T, go, want] of [[0, 1, 'xyL'], [nPl - 1, 0, 'phase']]) {
  await ev(`(__cmwSteps({ T: ${T} }), __cmwSteps({ go: ${go}, now: true }), 1)`);
  await settled({ until: `!__cmwSteps().moving && __cmwSteps().i === ${go} && __cmwSteps().T === ${T}`, max: 15000 });
  const sv = JSON.parse(await ev(`await (async () => { const f = await __cmwFig.build({}); return JSON.stringify({ view: f && f.view, key: f && f.info ? f.info.keyLine || null : null, cap: __cmwLegend().caption, W: f && f.W, H: f && f.H, ring: f ? f.boxes.filter((b) => b.kind === 'ring-mark').map((b) => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 })) : [] }); })()`, 60000));
  ok(`T ${T}, plane ${go}: the still is built as ${want}`, sv.view === want, sv);
  // (a plain plane's still carries the pane's key: its line is the caption the pane's legend shows; a Phase still has none of its own here)
  // (the ring's marks, drawn by the code the plain still shares, lie inside the figure on both stills)
  ok(`T ${T}, plane ${go}: the still's ring marks lie inside the figure`, sv.ring.length === RING_MARKS && sv.ring.every((b) => b.x0 >= -FIT_SLACK && b.y0 >= -FIT_SLACK && b.x1 <= sv.W + FIT_SLACK && b.y1 <= sv.H + FIT_SLACK), sv);
  ok(`T ${T}, plane ${go}: the still's key line ${want === 'xyL' ? 'is the pane\'s' : 'is absent'}`, want === 'xyL' ? !!sv.key && sv.key === sv.cap : !sv.key, sv);
}
// a short, wide pane makes a short picture: the figure is as tall as its key, whose last line is inside it
await view(1440, 430, false);
await ev(`(__cmwSteps({ T: 0 }), __cmwSteps({ go: 1, now: true }), 1)`);
await settled({ until: `!__cmwSteps().moving && __cmwSteps().i === 1 && __cmwSteps().T === 0`, max: 15000 });
const short = JSON.parse(await ev(`await (async () => { const f = await __cmwFig.build({}); return JSON.stringify({ H: f.H, view: f.view, boxes: f.boxes.filter((b) => b.kind === 'key' || b.kind === 'ring-mark').map((b) => ({ k: b.kind, y1: b.y1, tex: b.tex })) }); })()`, 60000));
ok('a short pane: the still\'s key (ring marks and lines) lies inside the figure', short.view === 'xyL' && short.boxes.length >= 5 && short.boxes.every((b) => b.y1 <= short.H + FIT_SLACK), short);
await view(1440, 900, false);
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
// the video's Paths follow the strip's: the frame the glide draws at a parked place has the pane's paths t -> H_t(z) on
// with Paths on, and none with it off (the video's frames are the pane's picture, so the dialog has no Paths box of its own here)
{
  await loadView('steps', 'xglp' + Date.now() % 1e7, PATHS_CHAIN, { lang: 'en' });
  await settled({ until: 'typeof __cmwSteps === "function" && !!document.querySelector("#svStrip")', max: 30000 });
  const { parked } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'steps_paths_kit.js'), 'utf8'))({ ev, settled });
  const heads = (await parked(PATHS_PARK)).heads;
  const pr = await ev(`await (async () => {
    const frame = async (on) => {
      __cmwSet('morphPaths', on);
      __cmwSteps({ park: ${PATHS_PARK} });
      for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r));
      if (GLR.gpuDone) await GLR.gpuDone();
      const r = await __cmwFig.glideArt(${PATHS_PARK}, { wpt: ${PATHS_FRAME_W}, dpi: 96, raw: true, look: 'light' });
      return { d: r.cv.getContext('2d').getImageData(0, 0, r.cv.width, r.cv.height).data, heads: __cmwSteps().paths.heads };
    };
    const on = await frame(true), off = await frame(false);
    let n = 0; for (let i = 0; i < on.d.length; i += 4) if (Math.abs(on.d[i] - off.d[i]) + Math.abs(on.d[i + 1] - off.d[i + 1]) + Math.abs(on.d[i + 2] - off.d[i + 2]) > ${DRAWN}) n++;
    return { headsOn: on.heads, headsOff: off.heads, share: n / (on.d.length / 4) };
  })()`, 120000);
  info['paths on and off'] = Object.assign({ heads }, pr);
  ok('Paths on: the pane draws paths at the parked place, and none with Paths off', heads > 0 && pr.headsOn > 0 && pr.headsOff === 0, info['paths on and off']);
  ok(`the glide's frame draws the paths with Paths on and not with Paths off (over ${PATHS_MIN_SHARE} of its pixels differ)`, pr.share > PATHS_MIN_SHARE, info['paths on and off']);
}
return { pass: fails.length === 0, fails, info };
