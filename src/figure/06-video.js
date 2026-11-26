  // =====================================================================================================
  // 6. Video of the steps view's glide along its thread: every frame rendered exactly off-screen (never a screen capture),
  // encoded with WebCodecs as H.264 in our own MP4 muxer, else VP9 in our own WebM muxer; one frame per task, so the page
  // keeps its frames while a video is made
  // =====================================================================================================
  const VIDEO_SIZES = { '1920x1080': [1920, 1080], '1280x720': [1280, 720], '1080x1080': [1080, 1080] };
  // (export review r3, verify-editor-7) secs is the length of ONE step (the Length menu says "3 s per step"): a chain of
  // five steps is not rushed, a single map takes that long
  const VSECS = [2, 3, 4, 6];
  const vdefaults = () => ({ size: '1920x1080', fps: 30, secs: 3, ends: 'once', tlabel: true, look: 'light' });
  // the frames' times (export review r3, editor-7, a lecture's pace): each step eased on its own (t = k + ease(u)) over
  // secs seconds, a hold of 0.6 s at every whole t inside, holds of 1.2 s at both ends. stops (a glide's plan,
  // A.svGlide): the whole t inside where it holds, the others crossed in one ease with the steps either side (an
  // All-at-once span, which passes the planes inside it), each part taking secs seconds a step; none: every whole t
  // inside. Bounce: there and back.
  // Loop: three runs, each followed by a 0.5 s cross-fade from t = m back to t = 0 (the last one too, so a player's loop
  // does not jump). An entry is a time, or {a, b, k}: the frame at a faded into the frame at b by k
  function videoTimes(v, m, stops = null) {
    const fps = v.fps === 60 ? 60 : 30, nSteps = m >= 1 && Math.abs(m - Math.round(m)) < 1e-9 ? Math.round(m) : 1;
    const per = Math.max(2, Math.round((v.secs || 3) * fps)), mid = Math.round(0.6 * fps), end = Math.round(1.2 * fps);
    const ease = (u) => u * u * (3 - 2 * u), hold = (t, n) => Array(n).fill(t);
    // (the parts' ends, in steps: 0, the stops inside, nSteps)
    const inner = [...Array(Math.max(0, nSteps - 1)).keys()].map((k) => k + 1), ends = [0, ...(stops ? inner.filter((k) => stops.includes(k)) : inner), nSteps];
    const run = [0];
    for (let p = 0; p + 1 < ends.length; p++) {
      const a = ends[p], b = ends[p + 1], n = per * (b - a);
      for (let i = 1; i <= n; i++) run.push((a + (b - a) * ease(i / n)) * m / nSteps);
      if (p + 2 < ends.length) run.push(...hold(b * m / nSteps, mid));
    }
    if (v.ends === 'bounce') return [...hold(0, end), ...run, ...hold(m, end), ...run.slice().reverse().slice(1), ...hold(0, end)];
    const one = [...hold(0, end), ...run, ...hold(m, end)];
    if (v.ends === 'loop') { const nf = Math.round(0.5 * fps), fade = [...Array(nf).keys()].map((i) => ({ a: m, b: 0, k: (i + 1) / nf })); return [...one, ...fade, ...one, ...fade, ...one, ...fade]; }
    return one;
  }
  const tOf = (e) => (typeof e === 'number' ? e : null);
  // a globe or a relief frame is drawn at a device pixel ratio of at least PIC_DPR_MIN, and of the frame's height over PIC_H_PX
  // when that is more
  const PIC_DPR_MIN = 1.5, PIC_H_PX = 360;
  // the screen's relief window (A.landBox) when all four of its bounds are finite, else null
  const planLandBox = () => { const lb = A.landBox ? A.landBox() : null; return lb && [lb.x0, lb.x1, lb.y0, lb.y1].every(Number.isFinite) ? lb : null; };
  // the plan of the steps view's glide along its thread (gl: A.svGlide): the left pane at the screen's window widened to
  // the frame's aspect, or on the sphere and the Landscape the screen's camera at the frame's own aspect (the whole
  // picture, no crop: the frame is the screen's); video time t is the thread position gl.lo + t, so m is the number of
  // steps. The pane's own paths and outlines come with its picture (the strip's state), so no vector marks are drawn
  // over it
  async function glidePlan(o, v, gl) {
    const [W, H] = VIDEO_SIZES[v.size] || VIDEO_SIZES['1920x1080'], m = gl.hi - gl.lo, pic = gl.surf !== 'plane';
    // the window is the still figure's, so the first frame frames the picture the PNG of the first plane does
    const still = pic ? null : await build({ svPic: 'shown' }), key = A.svKey && A.hue ? ringCanvas(H) : null;
    // (the key stands in a column at the right, beside the picture as in the still, so it never covers it)
    const picW = key ? W - keyColumn(H) : W;
    const name = (o.name || 'glide').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'glide';
    return { o, v: Object.assign({}, v, { look: 'light' }), gl, W, H, dpr: pic ? Math.max(PIC_DPR_MIN, H / PIC_H_PX) : Math.max(1, Math.min(W, H) / 720), m, pic, box: pic ? null : widenTo(still && still.box ? still.box : A.svBox(), picW / H), picW, landBox: gl.surf === 'land' ? planLandBox() : null, times: videoTimes(v, m, gl.stops), name, key };
  }
  // the app's hue ring as a canvas of the frame's own scale (0.14 H across), drawn once and kept for every frame
  function ringCanvas(Hpx) {
    const R = Math.round(0.07 * Hpx), n = 2 * R, kc = document.createElement('canvas'); kc.width = n; kc.height = n;
    const kx = kc.getContext('2d'), id = kx.createImageData(n, n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n * 2 - 1, w = 1 - (j + 0.5) / n * 2, rr = Math.hypot(u, w), q = 4 * (j * n + i);
      if (rr > 1 || rr < 0.55) continue;
      const c = A.hue((Math.atan2(w, u) + Math.PI) / (2 * Math.PI));
      const a = Math.min(1, (1 - rr) * R, (rr - 0.55) * R);
      id.data[q] = c[0]; id.data[q + 1] = c[1]; id.data[q + 2] = c[2]; id.data[q + 3] = Math.round(255 * Math.max(0, a));
    }
    kx.putImageData(id, 0, 0);
    return kc;
  }
  // the plan of a video: the steps view's glide along its thread (glidePlan); there is none to record without a step
  async function videoPlan(opts) {
    const o = Object.assign(defaults(), opts || {}), v = Object.assign(vdefaults(), o.video || {});
    const gl = !o.view && A.svOn && A.svOn() && A.svGlide ? A.svGlide() : null;
    if (!gl) throw new Error('There is no glide to record');
    return await glidePlan(o, v, gl);
  }
  // the video's text: an italic letter, upright digits, on a white halo (editor-17)
  const vText = (ctx, parts, x, y, fs, align = 'left') => {
    const fam = '"Latin Modern Roman", "CMU Serif", "Times New Roman", serif';
    const fonts = parts.map(([, it, sub]) => `${it ? 'italic ' : ''}${sub ? Math.round(0.7 * fs) : fs}px ${fam}`);
    const ws = parts.map(([s], i) => { ctx.font = fonts[i]; return ctx.measureText(s).width; }), tw = ws.reduce((a, b) => a + b, 0);
    const x0 = align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
    for (const pass of [0, 1]) {
      let xx = x0;
      parts.forEach(([s], i) => {
        ctx.font = fonts[i];
        const yy = parts[i][2] ? y + 0.25 * fs : y;
        if (pass === 0) { ctx.lineWidth = 0.22 * fs; ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.strokeText(s, xx, yy); } else { ctx.fillStyle = '#111111'; ctx.fillText(s, xx, yy); }
        xx += ws[i];
      });
    }
    return tw;
  };
  // the width of the column the glide's key stands in, at the right of the picture: the ring and its labels, the strip
  // and the words under it (all in units of the text size, 0.028 of the frame's height), and a margin
  const keyColumn = (H) => { const fs = Math.round(0.028 * H); return Math.ceil(Math.max(2 * Math.round(0.07 * H), 5.2 * fs) + 2.4 * fs + 0.03 * H); };
  // the width of such parts at size fs
  const vWidth = (ctx, parts, fs) => { const fam = '"Latin Modern Roman", "CMU Serif", "Times New Roman", serif'; return parts.reduce((a, [t, it, sub]) => { ctx.font = `${it ? 'italic ' : ''}${sub ? Math.round(0.7 * fs) : fs}px ${fam}`; return a + ctx.measureText(t).width; }, 0); };
  // the glide's chrome, the same on every frame but for its words: the plane's name as the axis title and the pane's key
  // (ring, modulus bands unless the style is plain, the caption), top right on a pale ground; the words are those of the
  // plane the thread position shows, so they change where the screen's do
  function glideChrome(ctx, plan, t, fs) {
    const { W, H } = plan, k = A.svKey(plan.gl.lo + t);
    if (!k) return;
    // (a plane's name, "w₂": an italic letter and a subscript)
    const parts = (nm) => [...String(nm).matchAll(/([A-Za-z])([₀-₉]*)|([^A-Za-z₀-₉]+)/g)].flatMap((m) => (m[3] ? [[m[3], false]] : [[m[1], true], ...(m[2] ? [[[...m[2]].map((c) => '₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).join(''), false, 'sub']] : [])]));
    // (every offset below is a multiple of fs, the text size: the title's baseline 1.1 fs from the top, the ring 2.6 fs under it,
    // each row of words about a line, 1.0 to 1.3 fs, below the one above, the strip 0.5 fs tall)
    const n = plan.key.width, col = keyColumn(H), cx = W - col / 2, top = 0.03 * H, bw = col - 0.03 * H;
    vText(ctx, parts(k.title), cx + bw / 2, top + 1.1 * fs, fs * 1.1, 'right');
    const ry = top + 2.3 * fs + 0.3 * fs, cy = ry + n / 2;
    ctx.drawImage(plan.key, cx - n / 2, ry);
    vText(ctx, [['1', false]], cx + n / 2 + 0.25 * fs, cy + 0.35 * fs, fs, 'left');
    vText(ctx, [['−1', false]], cx - n / 2 - 0.25 * fs, cy + 0.35 * fs, fs, 'right');
    vText(ctx, [['i', true]], cx, ry - 0.25 * fs, fs, 'center');
    vText(ctx, [['−', false], ['i', true]], cx, ry + n + 1.0 * fs, fs, 'center');
    let y = ry + n + 1.6 * fs;
    // (a line's words with the plane's name in italic: the pieces around its first occurrence)
    const withName = (line, name) => { const i = name ? line.indexOf(name) : -1; return i < 0 ? [[line, false]] : [[line.slice(0, i), false], ...parts(name), [line.slice(i + name.length), false]].filter((q) => q[0]); };
    if (k.carried) {
      // (past the colour plane: where the colour is carried from, in lines as wide as the key's ring)
      const words = k.carried.text.split(' '), width = (ln) => vWidth(ctx, withName(ln, k.carried.from), fs), lines = [];
      let cur = '';
      for (const wd of words) { const nx = cur ? `${cur} ${wd}` : wd; if (cur && width(nx) > bw - 0.6 * fs) { lines.push(cur); cur = wd; } else cur = nx; }
      if (cur) lines.push(cur);
      lines.forEach((ln, j) => vText(ctx, withName(ln, k.carried.from), cx, y + (0.9 + 1.25 * j) * fs, fs, 'center'));
      return;
    }
    if (!k.plain) {
      const sw = n, sy = y + 1.1 * fs, sh = 0.5 * fs;
      for (let j = 0; j < 3; j++) { const g = ctx.createLinearGradient(cx - sw / 2 + j * sw / 3, 0, cx - sw / 2 + (j + 1) * sw / 3, 0); g.addColorStop(0, k.stops[0]); g.addColorStop(1, k.stops[1]); ctx.fillStyle = g; ctx.fillRect(cx - sw / 2 + j * sw / 3, sy, sw / 3, sh); }
      ctx.strokeStyle = '#555555'; ctx.lineWidth = 1; ctx.strokeRect(cx - sw / 2, sy, sw, sh);
      vText(ctx, [[k.factor, false]], cx, sy - 0.25 * fs, fs, 'center');
      vText(ctx, [[k.perBand, false]], cx, sy + sh + 1.1 * fs, fs, 'center');
      y = sy + sh + 1.7 * fs;
    }
    vText(ctx, withName(k.caption, k.name), cx, y + 0.9 * fs, fs, 'center');
  }
  // one frame of the video at time t, drawn into the 2D context ctx (W x H device px)
  async function videoFrame(plan, t, ctx) {
    // (W: the picture's width, the frame's but for the glide's key column at the right; Wf: the frame's)
    const { o, v, H, dpr } = plan, W = plan.picW || plan.W, Wf = plan.W, st = A.state();
    const look = v.look === 'print' ? 'print' : 'light';
    const base = { dpi: 96 * dpr, T: t, alive: o.alive, raw: true, look: look === 'light' ? 'light' : null, ink: printInkFor(o, st.alpha) };
    const r = await A.svGlideArt(plan.gl.lo + t, Object.assign(base, plan.pic ? { wpt: W / dpr * 72 / 96, hpt: H / dpr * 72 / 96, landBox: plan.landBox, landRound: roundLandBox } : { box: plan.box, wpt: W / dpr * 72 / 96 }));
    if (!r) return false;
    const s0 = performance.now();
    ctx.save();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, Wf, H);
    ctx.drawImage(r.cv, 0, 0, W, H);
    // (the off-screen canvas is let go at once: a frame's 8 MB backing store would otherwise wait for the collector)
    r.cv.width = 1; r.cv.height = 1;
    const lw = Math.max(1, Math.min(W, H) / 720);
    // the axes' marks on a plane, in world coordinates
    let P = null;
    if (plan.box) { const b = plan.box; P = (w) => (fin(w) ? [(w.re - b.x0) / (b.x1 - b.x0) * W, (b.y1 - w.im) / (b.y1 - b.y0) * H] : null); }
    const line = (pts, color, width, dash) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.lineCap = dash ? 'butt' : 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); let pen = false; for (const p of pts) { if (!p) { pen = false; continue; } if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); pen = true; } ctx.stroke(); ctx.setLineDash([]); };
    const fs = Math.round(0.028 * H);
    // (editor-6) the print look's axes, and tick numbers in both looks: the window is fixed, so they are too
    if (plan.box) {
      // (the readout at the bottom left keeps its place: an axis number that would run through it is left out)
      const labW = v.tlabel ? vWidth(ctx, [[A.svGlideText(plan.gl.lo + t), false]], Math.round(0.04 * H)) + 0.035 * H : 0;
      const b = plan.box, step = niceStep(Math.max(b.x1 - b.x0, b.y1 - b.y0), 8), xs = XD.ticks(b.x0, b.x1, step), ys = XD.ticks(b.y0, b.y1, step);
      const ox = Math.min(Math.max(P(C(0, 0))[0], 0), W), oy = Math.min(Math.max(P(C(0, 0))[1], 0), H);
      if (look === 'print') { line([[0, oy], [W, oy]], '#555555', 1.2 * lw); line([[ox, 0], [ox, H]], '#555555', 1.2 * lw); }
      const num = (x, d) => { const s2 = (Math.abs(x) < 1e-12 ? 0 : x).toFixed(d); return (I18 ? I18.num(s2) : s2).replace(/^-/, '−'); };
      const decX = XD.axisDec('x', xs, step, num), decY = XD.axisDec('y', ys, step, num), recY = XD.axes ? XD.axes[XD.axes.length - 1] : null;
      for (const x of xs) { if (Math.abs(x) < 1e-12) continue; const px = P(C(x, 0))[0]; if (px < 0.04 * W || px > 0.96 * W) continue; line([[px, oy - 4 * lw], [px, oy + 4 * lw]], '#333333', 1.2 * lw); if (!(oy + fs * 1.15 > H - 0.1 * H && px < labW + fs)) vText(ctx, [[num(x, decX), false]], px, Math.min(H - 0.02 * H, oy + fs * 1.15), fs, 'center'); }
      for (const y of ys) { if (Math.abs(y) < 1e-12) continue; const py = P(C(0, y))[1]; if (py < 0.06 * H || py > 0.9 * H) continue; line([[ox - 4 * lw, py], [ox + 4 * lw, py]], '#333333', 1.2 * lw);
        // (right-aligned left of the axis; an axis at the frame's left edge, or a label wider than the room left of it,
        // moves the label right so that it starts inside the frame)
        const lab = num(y, decY), w = vWidth(ctx, [[lab, false]], fs), lx = Math.max(fs * 2.2, w + 0.3 * fs, ox - 0.4 * fs);
        if (recY) recY.left = Math.min(recY.left ?? Infinity, lx - w);
        vText(ctx, [[lab, false]], lx, py + 0.35 * fs, fs, 'right');
      }
    }
    if (plan.key) glideChrome(ctx, plan, t, fs);
    // the label: bottom left, the thread's position (editor-17)
    if (v.tlabel) {
      plan.label = A.svGlideText(plan.gl.lo + t);
      vText(ctx, [[plan.label, false]], Math.round(0.035 * H), H - Math.round(0.035 * H), Math.round(0.04 * H));
    }
    ctx.restore();
    if (plan.trace) plan.trace.push(['draw', Math.round(performance.now() - s0)]);
    return true;
  }
  // ---- encoders and muxers ----
  const H264 = ['avc1.640033', 'avc1.64002A', 'avc1.640028', 'avc1.4D402A', 'avc1.4D4028', 'avc1.42E02A', 'avc1.42E028'];
  const pickCache = new Map();
  async function pickEncoder(W, H, fps, webmOnly) {
    if (typeof VideoEncoder === 'undefined') return null;
    const ck = `${W}x${H}@${fps}${webmOnly ? 'w' : ''}`;
    if (pickCache.has(ck)) return pickCache.get(ck);
    const bitrate = Math.round(Math.min(16e6, Math.max(2e6, W * H * fps * 0.12)));
    let out = null;
    // (webmOnly: the fallback on purpose, for its test)
    for (const codec of webmOnly ? [] : H264) {
      const cfg = /** @type {VideoEncoderConfig} */ ({ codec, width: W, height: H, bitrate, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' });
      try { const s = await VideoEncoder.isConfigSupported(cfg); if (s && s.supported) { out = { cfg, mux: 'mp4' }; break; } } catch (e) { /* next */ }
    }
    if (!out) for (const codec of ['vp09.00.40.08', 'vp09.00.31.08', 'vp8']) {
      const cfg = /** @type {VideoEncoderConfig} */ ({ codec, width: W, height: H, bitrate, framerate: fps, latencyMode: 'quality' });
      try { const s = await VideoEncoder.isConfigSupported(cfg); if (s && s.supported) { out = { cfg, mux: 'webm' }; break; } } catch (e) { /* next */ }
    }
    pickCache.set(ck, out);
    return out;
  }
  // MP4 (ISO BMFF): ftyp, moov (one video track, all samples in one chunk), mdat. The samples are in decode order (the
  // encoder's output order); a stream whose timestamps are not increasing (reordered frames) gets a ctts box
  // (export review r3, video-8)
  function muxMP4(chunks, desc, W, H, fps) {
    if (!desc || desc.length < 7 || desc[0] !== 1) throw new Error('The H.264 encoder gave no avcC description');
    if (chunks.length && chunks[0].data.length > 4 && chunks[0].data[0] === 0 && chunks[0].data[1] === 0 && (chunks[0].data[2] === 1 || (chunks[0].data[2] === 0 && chunks[0].data[3] === 1))) throw new Error('The H.264 encoder gave Annex B, not AVC');
    const enc = new TextEncoder();
    const u32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255], u16 = (v) => [(v >> 8) & 255, v & 255];
    const box = (type, ...parts) => { const body = parts.flat(Infinity); return [...u32(8 + body.length), ...enc.encode(type), ...body]; };
    const full = (type, ver, flags, ...parts) => box(type, ver, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255, ...parts);
    const ts = fps * 1000, n = chunks.length, dur = n * 1000, ms = Math.round(n * 1000 / fps);
    // composition offsets (in 1/(fps*1000) s) when the presentation order differs from the decode order
    const step = 1e6 / fps, pos = chunks.map((c) => Math.round(c.ts / step));
    const reordered = pos.some((p, i) => p !== i);
    const ctts = reordered ? (() => { const sorted = pos.slice().sort((a, b) => a - b), offs = pos.map((p, i) => (p - i) * 1000), base = Math.min(0, ...offs); if (sorted.some((p, i) => p !== i)) throw new Error('The video has missing frames'); return full('ctts', 0, 0, u32(n), offs.map((o) => [u32(1), u32(o - base)]).flat()); })() : [];
    const matrix = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].flatMap(u32);
    const ftyp = box('ftyp', ...enc.encode('isom'), u32(0x200), ...enc.encode('isomiso2avc1mp41'));
    const stbl = (stco) => box('stbl',
      full('stsd', 0, 0, u32(1), box('avc1', [0, 0, 0, 0, 0, 0], u16(1), u16(0), u16(0), u32(0), u32(0), u32(0), u16(W), u16(H), u32(0x00480000), u32(0x00480000), u32(0), u16(1), Array(32).fill(0), u16(0x18), u16(0xffff), box('avcC', ...desc), box('pasp', u32(1), u32(1)))),
      full('stts', 0, 0, u32(1), u32(n), u32(1000)),
      ctts,
      full('stss', 0, 0, u32(chunks.filter((c) => c.key).length), chunks.map((c, i) => (c.key ? u32(i + 1) : [])).flat()),
      full('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
      full('stsz', 0, 0, u32(0), u32(n), chunks.map((c) => u32(c.data.length)).flat()),
      full('stco', 0, 0, u32(1), u32(stco)));
    const moov = (stco) => box('moov',
      full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(ms), u32(0x00010000), u16(0x0100), Array(10).fill(0), matrix, Array(24).fill(0), u32(2)),
      box('trak',
        full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(ms), Array(8).fill(0), u16(0), u16(0), u16(0), u16(0), matrix, u32(W << 16), u32(H << 16)),
        box('mdia',
          full('mdhd', 0, 0, u32(0), u32(0), u32(ts), u32(dur), u16(0x55c4), u16(0)),
          full('hdlr', 0, 0, u32(0), ...enc.encode('vide'), Array(12).fill(0), ...enc.encode('VideoHandler'), 0),
          box('minf', full('vmhd', 0, 1, Array(8).fill(0)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl(stco)))));
    const size = chunks.reduce((a, c) => a + c.data.length, 0);
    const head = ftyp.length + moov(0).length;
    const top = new Uint8Array([...ftyp, ...moov(head + 8), ...u32(8 + size), ...enc.encode('mdat')]);
    return new Blob([top, ...chunks.map((c) => c.data)], { type: 'video/mp4' });
  }
  // WebM (Matroska): EBML header, Segment {SeekHead, Info, Tracks, a Cluster per key frame of SimpleBlocks, Cues}
  // (export review r3, video-9: the Cues index every cluster, so players and editors seek)
  function muxWebM(chunks, W, H, fps, codec) {
    const enc = new TextEncoder();
    const vint = (n) => { for (let l = 1; l <= 8; l++) if (n < 2 ** (7 * l) - 1) { const o = []; let v = n; for (let i = 0; i < l; i++) { o.unshift(v & 255); v = Math.floor(v / 256); } o[0] |= 1 << (8 - l); return o; } throw new Error('size'); };
    const idb = (id) => { const o = []; let v = id; while (v > 0) { o.unshift(v & 255); v = Math.floor(v / 256); } return o; };
    const uint = (v) => { const o = []; do { o.unshift(v & 255); v = Math.floor(v / 256); } while (v > 0); return o; };
    const u64 = (v) => { const o = []; for (let i = 0; i < 8; i++) { o.unshift(v & 255); v = Math.floor(v / 256); } return o; };
    const el = (id, data) => { const d = data instanceof Uint8Array ? data : new Uint8Array(data.flat ? data.flat(Infinity) : data); return [...idb(id), ...vint(d.length), ...d]; };
    const f64 = (v) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return [...b]; };
    const ms = (i) => Math.round(i * 1000 / fps);
    const ebml = el(0x1A45DFA3, [el(0x4286, uint(1)), el(0x42F7, uint(1)), el(0x42F2, uint(4)), el(0x42F3, uint(8)), el(0x4282, [...enc.encode('webm')]), el(0x4287, uint(4)), el(0x4285, uint(2))]);
    const info = el(0x1549A966, [el(0x2AD7B1, uint(1000000)), el(0x4D80, [...enc.encode('Complex Map Workbench')]), el(0x5741, [...enc.encode('Complex Map Workbench')]), el(0x4489, f64(ms(chunks.length)))]);
    const cid = /^vp8$/.test(codec) ? 'V_VP8' : 'V_VP9';
    const tracks = el(0x1654AE6B, [el(0xAE, [el(0xD7, uint(1)), el(0x73C5, uint(1)), el(0x83, uint(1)), el(0x86, [...enc.encode(cid)]), el(0x23E383, uint(Math.round(1e9 / fps))), el(0xE0, [el(0xB0, uint(W)), el(0xBA, uint(H))])])]);
    const clusters = [];
    let cur = null, c0 = 0;
    chunks.forEach((c, i) => {
      if (!cur || c.key || ms(i) - c0 > 30000) { if (cur) clusters.push({ t: cur.t, parts: cur.parts }); c0 = ms(i); cur = { t: c0, parts: [el(0xE7, uint(c0))] }; }
      const rel = ms(i) - c0, hdr = [0x81, (rel >> 8) & 255, rel & 255, c.key ? 0x80 : 0];
      cur.parts.push([...idb(0xA3), ...vint(4 + c.data.length), ...hdr]); cur.parts.push(c.data);
    });
    if (cur) clusters.push(cur);
    // the SeekHead has a fixed size (positions as 8-byte integers), so the offsets are known before it is written
    const seekEntry = (id, p) => el(0x4DBB, [el(0x53AB, idb(id)), el(0x53AC, u64(p))]);
    const seekLen = el(0x114D9B74, [seekEntry(0x1549A966, 0), seekEntry(0x1654AE6B, 0), seekEntry(0x1C53BB6B, 0)]).length;
    const cl = /** @type {any[]} */ (clusters.map((c) => { const pieces = c.parts.map((q) => (q instanceof Uint8Array ? q : new Uint8Array(q))); const len = pieces.reduce((a, q) => a + q.length, 0); return { t: c.t, head: new Uint8Array([...idb(0x1F43B675), ...vint(len)]), pieces, size: 0 }; }));
    let off = seekLen + info.length + tracks.length;
    for (const c of cl) { c.pos = off; c.size = c.head.length + c.pieces.reduce((a, q) => a + q.length, 0); off += c.size; }
    const cues = el(0x1C53BB6B, cl.map((c) => el(0xBB, [el(0xB3, uint(c.t)), el(0xB7, [el(0xF7, uint(1)), el(0xF1, uint(c.pos))])])));
    const seek = el(0x114D9B74, [seekEntry(0x1549A966, seekLen), seekEntry(0x1654AE6B, seekLen + info.length), seekEntry(0x1C53BB6B, off)]);
    const body = [new Uint8Array(seek), new Uint8Array(info), new Uint8Array(tracks)];
    for (const c of cl) body.push(c.head, ...c.pieces);
    body.push(new Uint8Array(cues));
    const blen = body.reduce((a, q) => a + q.length, 0);
    return new Blob([new Uint8Array(ebml), new Uint8Array([...idb(0x18538067), ...vint(blen)]), ...body], { type: 'video/webm' });
  }
  // a wait that a hidden page does not slow to a second: the encoder's dequeue event, else a message-channel turn
  const turn = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(undefined); ch.port2.postMessage(0); });
  // makeVideo(opts, {progress(i, n), cancelled()}) -> {blob, ext, codec, frames, fps, secs, W, H, ms} or null (cancelled)
  // (opts.keepForCheck: the tests' videoCheck reads the last video back; nothing is kept otherwise, export review r3, video-4)
  let lastVideo = null;
  async function makeVideo(opts, cb = {}) {
    if (!A) throw new Error('Figure is not attached');
    const t0 = performance.now();
    lastVideo = null;
    // (the encoder first: a browser without one is told so before any frame is drawn, video-6)
    const v0 = Object.assign(vdefaults(), (opts && opts.video) || {}), [W0, H0] = VIDEO_SIZES[v0.size] || VIDEO_SIZES['1920x1080'];
    const fps = v0.fps === 60 ? 60 : 30;
    const pick = await pickEncoder(W0, H0, fps, !!v0.webm);
    if (!pick) throw new Error('This browser cannot encode video (no WebCodecs encoder)');
    const plan = await videoPlan(opts);
    if (!plan) return null;
    // (tests: opts.trace collects the time of each frame's steps, ms: frame, draw, enc, configure)
    if (opts && opts.trace) plan.trace = opts.trace;
    const { W, H } = plan;
    const chunks = [];
    let desc = null, err = null;
    const encoder = new VideoEncoder({
      output: (ch, meta) => { const d = new Uint8Array(ch.byteLength); ch.copyTo(d); chunks.push({ data: d, key: ch.type === 'key', ts: ch.timestamp }); const dd = /** @type {any} */ (meta && meta.decoderConfig && meta.decoderConfig.description); if (dd && !desc) desc = new Uint8Array(dd.buffer ? dd.buffer.slice(dd.byteOffset, dd.byteOffset + dd.byteLength) : dd); },
      error: (e) => { err = e; },
    });
    await breathe();
    const c0 = performance.now();
    encoder.configure(pick.cfg);
    if (plan.trace) plan.trace.push(['configure', Math.round(performance.now() - c0)]);
    await breathe();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { alpha: false });
    const times = plan.times, n = times.length, keyEvery = fps * 2;
    // (a fade blends two frames kept as pictures: t = m and t = 0)
    const kept = new Map();
    const keptAt = async (t) => { if (kept.has(t)) return kept.get(t); const c = document.createElement('canvas'); c.width = W; c.height = H; if (!(await videoFrame(plan, t, c.getContext('2d', { alpha: false })))) return null; kept.set(t, c); return c; };
    const dequeued = () => new Promise((r) => { let done = false; const f = () => { if (!done) { done = true; try { encoder.removeEventListener('dequeue', f); } catch (e) { /* none */ } r(undefined); } }; try { encoder.addEventListener('dequeue', f); } catch (e) { /* none */ } turn().then(() => { if (encoder.encodeQueueSize <= 3) f(); else setTimeout(f, 50); }); });
    let prev = null;
    try {
      for (let i = 0; i < n; i++) {
        if ((cb.cancelled && cb.cancelled()) || err) break;
        const e = times[i], t = tOf(e);
        // (a hold repeats the last picture: no new render)
        const same = prev != null && (t != null ? typeof prev === 'number' && Math.abs(t - prev) <= 1e-12 : typeof prev === 'object' && prev.k === e.k);
        if (!same) {
          const a0 = performance.now();
          if (t != null) { if (!(await videoFrame(plan, t, ctx))) { err = err || new Error('cancelled'); break; } }
          else {
            const ca = await keptAt(e.a), cbv = await keptAt(e.b);
            if (!ca || !cbv) { err = err || new Error('cancelled'); break; }
            ctx.globalAlpha = 1; ctx.drawImage(ca, 0, 0); ctx.globalAlpha = e.k; ctx.drawImage(cbv, 0, 0); ctx.globalAlpha = 1;
          }
          prev = e;
          if (plan.trace) plan.trace.push(['frame', Math.round(performance.now() - a0)]);
        }
        const e0 = performance.now();
        const vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        encoder.encode(vf, { keyFrame: i % keyEvery === 0 });
        vf.close();
        if (plan.trace) plan.trace.push(['enc', Math.round(performance.now() - e0)]);
        while (encoder.encodeQueueSize > 3 && !err) await dequeued();
        if (cb.progress) cb.progress(i + 1, n);
        await breathe();
      }
      if (err || (cb.cancelled && cb.cancelled())) { try { encoder.close(); } catch (e) { /* closed */ } if (err && err.message !== 'cancelled') throw err; return null; }
      await encoder.flush();
    } finally { if (encoder.state !== 'closed') try { encoder.close(); } catch (e) { /* closed */ } }
    for (const c of kept.values()) { c.width = 1; c.height = 1; }
    // (the chunks stay in the encoder's output order, which is the decode order: muxMP4 checks the timestamps)
    const hx = (v) => v.toString(16).toUpperCase().padStart(2, '0');
    const codec = pick.mux === 'mp4' && desc && desc.length > 3 ? `avc1.${hx(desc[1])}${hx(desc[2])}${hx(desc[3])}` : pick.cfg.codec;
    const blob = pick.mux === 'mp4' ? muxMP4(chunks, desc, W, H, fps) : muxWebM(chunks, W, H, fps, pick.cfg.codec);
    if (opts && opts.keepForCheck) { plan.o = Object.assign({}, plan.o, { alive: null }); lastVideo = { codec, mux: pick.mux, frames: n, fps, W, H, times, desc, chunks, plan }; }
    return { blob, ext: pick.mux, codec, frames: n, fps, secs: n / fps, W, H, name: plan.name, ms: Math.round(performance.now() - t0) };
  }
  // (tests) one frame of the last video decoded back, and the exact render at its t, as RGBA at w x h
  async function videoCheck(k, w = 192, h = 108) {
    const L = lastVideo;
    if (!L || typeof VideoDecoder === 'undefined') return null;
    const frames = [];
    const dec = new VideoDecoder({ output: (f) => { frames.push(f); }, error: () => {} });
    const cfg = { codec: L.codec, codedWidth: L.W, codedHeight: L.H };
    if (L.mux === 'mp4') cfg.description = L.desc;
    dec.configure(cfg);
    let k0 = k; while (k0 > 0 && !L.chunks[k0].key) k0--;
    for (let i = k0; i <= k; i++) dec.decode(new EncodedVideoChunk({ type: L.chunks[i].key ? 'key' : 'delta', timestamp: L.chunks[i].ts, data: L.chunks[i].data }));
    await dec.flush();
    const f = frames[frames.length - 1];
    const c1 = document.createElement('canvas'); c1.width = w; c1.height = h;
    const x1 = c1.getContext('2d'); x1.drawImage(f, 0, 0, w, h);
    frames.forEach((q) => q.close()); dec.close();
    const big = document.createElement('canvas'); big.width = L.W; big.height = L.H;
    const e = L.times[k];
    if (typeof e === 'number') await videoFrame(L.plan, e, big.getContext('2d', { alpha: false }));
    else { const ca = document.createElement('canvas'), cb2 = document.createElement('canvas'); for (const c of [ca, cb2]) { c.width = L.W; c.height = L.H; } await videoFrame(L.plan, e.a, ca.getContext('2d', { alpha: false })); await videoFrame(L.plan, e.b, cb2.getContext('2d', { alpha: false })); const g = big.getContext('2d'); g.drawImage(ca, 0, 0); g.globalAlpha = e.k; g.drawImage(cb2, 0, 0); g.globalAlpha = 1; }
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
    c2.getContext('2d').drawImage(big, 0, 0, w, h);
    const a = x1.getImageData(0, 0, w, h).data, b = c2.getContext('2d').getImageData(0, 0, w, h).data;
    let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    return { t: typeof e === 'number' ? e : e.a, pic: (L.plan.picW || L.plan.W) / L.plan.W, mad: s / (w * h * 3), decoded: c1.toDataURL('image/png'), exact: c2.toDataURL('image/png'), label: L.plan.label || null };
  }
  // (tests) the video's window and the screen's, and the frame at the thread's position on
  // screen drawn by the video's code
  async function videoScreenCheck(opts) {
    const plan = await videoPlan(opts);
    if (!plan) return null;
    const scr = A.screenBox('L'), t = Math.max(0, Math.min(plan.m, A.svGlide().at - plan.gl.lo));
    const c = document.createElement('canvas'); c.width = plan.W; c.height = plan.H;
    await videoFrame(plan, t, c.getContext('2d', { alpha: false }));
    return { box: plan.box, screen: scr, t, frame: c.toDataURL('image/png') };
  }
  // ---- (2026-10-24, VIDEO-PREVIEW.md) the dialog plays the video as it will be saved ----
  // Every picture the preview shows is a frame of the video: videoFrame on the video's own plan at the video's own size
  // (the exact render makeVideo encodes), scaled down once to the size the dialog shows it at in device pixels (never
  // below that, never above the video's size) and kept. A hold shows its kept frame again; a fade of Loop blends two kept
  // frames, as makeVideo does. The frames are drawn one per animation frame, coarse to fine (every 16th first), so the
  // motion shows at once and fills in; until a frame is drawn its nearest drawn neighbour stands in. The clock runs at
  // the video's frame rate over its whole timeline (holds, Loop's three runs, Bounce's way back) and starts again at
  // the end.
  // Keeping (review vp-1, vp-7): when all the frames fit in pvRaw() bytes they are kept as they are (bitmaps, exact);
  // else each is kept compressed (WebP, or JPEG where WebP cannot be encoded, quality 0.92) and a few frames around the
  // playhead are decoded ahead (createImageBitmap, off the main thread). So the size of the kept frames follows the
  // screen, not the length of the timeline. pvRaw() is smaller on a phone, a tablet or a device with 4 GB or less.
  const pvRaw = () => {
    let low = false;
    try { low = (/** @type {any} */ (navigator).deviceMemory > 0 && /** @type {any} */ (navigator).deviceMemory <= 4) || matchMedia('(pointer: coarse)').matches; } catch (e) { /* no matchMedia */ }
    return low ? 64e6 : 192e6;
  };
  const PV_Q = 0.92;
  // the compressed format: WebP where this browser can encode it (it says so by the type of what it returns), else JPEG
  let pvMimeP = null;
  const pvMime = () => pvMimeP || (pvMimeP = (async () => {
    try {
      const c = /** @type {any} */ (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(2, 2) : Object.assign(document.createElement('canvas'), { width: 2, height: 2 }));
      c.getContext('2d').fillRect(0, 0, 1, 1);
      const b = c.convertToBlob ? await c.convertToBlob({ type: 'image/webp', quality: PV_Q }) : await new Promise((r) => c.toBlob(r, 'image/webp', PV_Q));
      return b && b.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    } catch (e) { return 'image/jpeg'; }
  })());
  const pvStats = { renders: 0, live: 0, runs: 0, draws: 0, decodes: 0 }; // (tests: frames drawn, previews alive, starts, pictures shown, frames decoded)
  // the width the frames are kept at: the shown width in device pixels, at most the video's
  const pvKeptW = (W, cssW) => Math.max(16, Math.min(W, Math.round(cssW * Math.max(1, window.devicePixelRatio || 1))));
  function makePreview(cv, ui) {
    const g = cv.getContext('2d', { alpha: false });
    let run = null, raf = 0, clock = 0, pos0 = 0;
    // (first: the frame drawn first in this run, -1 until one is)
    const P = { playing: false, i: 0, shown: false, drawn: -1, first: -1 };
    const tkey = (t) => t.toFixed(9);
    // the next slot for a frame's render: just after the screen's frame (so a render of 5-15 ms fits before the next
    // one). A hidden page draws nothing: the fill waits until the page is shown again (review vp-7)
    const shownAgain = (q) => new Promise((r) => {
      if (!document.hidden) { r(undefined); return; }
      const f = () => { if (!document.hidden || q.dead) { document.removeEventListener('visibilitychange', f); q.unhide = null; r(undefined); } };
      q.unhide = f; document.addEventListener('visibilitychange', f);
    });
    const slot = async (q) => { await shownAgain(q); if (q.dead) return; await new Promise((r) => requestAnimationFrame(() => { breathe().then(r); })); };
    const idle = () => new Promise((r) => setTimeout(r, 150));
    const has = (q, u) => (q.raw ? !!q.bm[u] : !!(q.bl[u] || q.pend.has(u)));
    // the frame kept for unique time u, else its nearest kept neighbour (while the frames fill in); -1 if none
    const near = (q, u) => { if (has(q, u)) return u; for (let d = 1; d < q.U.length; d++) { if (u - d >= 0 && has(q, u - d)) return u - d; if (u + d < q.U.length && has(q, u + d)) return u + d; } return -1; };
    // the unique times timeline index i needs (one; two for a fade)
    const need = (q, i) => { const e = q.times[i]; return typeof e === 'number' ? [q.ui[i]] : [q.uOf.get(tkey(e.a)), q.uOf.get(tkey(e.b))]; };
    // (compressed) decode u ahead; the decoded frames are a small cache, the ones near the playhead kept
    function decode(q, u) {
      if (q.raw || q.hot.has(u) || q.dec.has(u) || !q.bl[u]) return;
      const p = createImageBitmap(q.bl[u]).then((b) => {
        q.dec.delete(u);
        if (q.dead) { if (b.close) b.close(); return; }
        pvStats.decodes++; q.hot.set(u, b); trim(q);
        if (!P.playing && P.shown && P.drawn !== P.i && run === q) draw(P.i);
      }, (e) => { q.dec.delete(u); console.error(e); });
      q.dec.set(u, p);
    }
    function trim(q) {
      if (q.hot.size <= q.hotMax) return;
      for (const [u, b] of q.hot) { if (q.hot.size <= q.hotMax) break; if (q.keep.has(u) || q.pend.has(u)) continue; q.hot.delete(u); if (b.close) b.close(); }
    }
    // (compressed) the frames for the next ~0.3 s from index i, decoded ahead, at most 4 at a time
    function ahead(q, i) {
      if (q.raw) return;
      q.keep.clear();
      const n = q.times.length, K = Math.min(q.hotMax - 2, Math.ceil(q.fps * 0.3));
      for (let k = 0; k <= K && q.keep.size < q.hotMax - 1; k++) for (const u of need(q, (i + k) % n)) { const v = near(q, u); if (v >= 0) q.keep.add(v); }
      for (const v of q.keep) { if (q.dec.size >= 4) break; decode(q, v); }
    }
    const get = (q, v) => {
      if (q.raw) return q.bm[v];
      const b = q.hot.get(v);
      if (b) { q.hot.delete(v); q.hot.set(v, b); return b; } // (most recently used last)
      decode(q, v); return null;
    };
    function draw(i) {
      const q = run;
      if (!q) return false;
      const e = q.times[i], vs = need(q, i).map((u) => near(q, u));
      if (vs.some((v) => v < 0)) return false;
      if (!q.raw) for (const v of vs) q.keep.add(v);
      const bs = vs.map((v) => get(q, v));
      if (bs.some((b) => !b)) return false;
      g.globalAlpha = 1; g.drawImage(bs[0], 0, 0, cv.width, cv.height);
      if (bs.length > 1) { g.globalAlpha = e.k; g.drawImage(bs[1], 0, 0, cv.width, cv.height); g.globalAlpha = 1; }
      pvStats.draws++; P.drawn = i;
      if (!P.shown) { P.shown = true; P.first = i; ui.shown(true); }
      return true;
    }
    const show = (i) => { P.i = i; P.drawn = -1; if (run) ahead(run, i); draw(i); ui.tick(i); };
    function loop(now) {
      raf = 0;
      const q = run;
      if (!q || !P.playing) return;
      // (time does not run before the first picture is shown: on a slow machine the poster's frame is still rendering, and the
      // preview must open on it, not on a frame the clock has since passed)
      if (!P.shown) { pos0 = P.i; clock = now; }
      const i = Math.max(0, Math.floor(pos0 + (now - clock) * q.fps / 1000)) % q.times.length;
      if (i !== P.i) { P.i = i; ui.tick(i); }
      ahead(q, i);
      if (P.drawn !== i || !P.shown) draw(i); // (a frame still decoding: the picture stays one frame longer)
      raf = requestAnimationFrame(loop);
    }
    // (lazy, reduced motion: only the frame in view is drawn until Play; a seek draws its frame and neighbours)
    function want(q, i) { const n = q.times.length; for (const k of [0, 1, -1, 2, -2]) for (const u of need(q, (i + k + n) % n)) q.urgent.push(u); if (q.wake) q.wake(); }
    function fillAll(q) { if (!q.lazy) return; q.lazy = false; for (const u of q.full) q.order.push(u); if (q.wake) q.wake(); ui.fill(q.ready, q.U.length); }
    function play() {
      const q = run;
      if (!q) return;
      fillAll(q);
      P.playing = true; pos0 = P.i; clock = performance.now();
      if (!raf) raf = requestAnimationFrame(loop);
      ui.playing(true);
    }
    function pause() { P.playing = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } ui.playing(false); }
    function seek(i) { const q = run; if (!q) return; i = Math.max(0, Math.min(q.times.length - 1, i | 0)); pos0 = i; clock = performance.now(); if (q.lazy) want(q, i); show(i); }
    function stop() {
      const q = run;
      run = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      P.playing = false;
      if (q) {
        q.dead = true;
        for (const b of q.bm) if (b && b.close) b.close();
        for (const b of q.hot.values()) if (b.close) b.close();
        q.bm = []; q.bl = []; q.hot.clear();
        if (q.wake) q.wake();
        if (q.unhide) q.unhide(); // (a fill waiting for a hidden page ends)
        pvStats.live--;
      }
    }
    // start(plan, {cssW, autoplay, at, lazy, keep}): the frames of plan (from videoPlan, the poster's), shown cssW CSS px
    // wide, from timeline index at; keep: a picture to hold in view until the first new frame (a restart on resize)
    function start(plan, o) {
      stop();
      const times = plan.times, fps = plan.v.fps === 60 ? 60 : 30;
      const U = [], uOf = new Map(), ui2 = new Int32Array(times.length);
      const add = (t) => { const k = tkey(t); if (!uOf.has(k)) { uOf.set(k, U.length); U.push(t); } return uOf.get(k); };
      times.forEach((e, i) => { if (typeof e === 'number') ui2[i] = add(e); else { add(e.a); add(e.b); ui2[i] = -1; } });
      const pw = pvKeptW(plan.W, o.cssW), ph = Math.max(9, Math.round(plan.H * pw / plan.W));
      const fb = 4 * pw * ph, budget = pvRaw(), raw = U.length * fb <= budget;
      cv.width = pw; cv.height = ph;
      const at = Math.max(0, Math.min(times.length - 1, o.at | 0));
      const q = run = {
        plan, times, fps, U, uOf, ui: ui2, raw, bm: raw ? new Array(U.length).fill(null) : [], bl: raw ? [] : new Array(U.length).fill(null),
        hot: new Map(), dec: new Map(), pend: new Map(), keep: new Set(), hotMax: Math.max(6, Math.min(40, Math.floor(budget / 3 / fb))), bytes: 0,
        mime: 'image/webp', ready: 0, pw, ph, dead: false, id: ++pvStats.runs, lazy: !!o.lazy, order: [], full: [], urgent: [], qpos: 0, wake: null, unhide: null, cssW: o.cssW,
      };
      pvStats.live++;
      P.i = at; P.drawn = -1; P.shown = false; P.first = -1;
      if (o.keep) { g.drawImage(o.keep, 0, 0, pw, ph); P.shown = true; } else ui.shown(false);
      ui.size(pw, ph, plan.W, plan.H, raw); ui.tick(at); ui.fill(0, U.length);
      // the order: the frame in view, both ends, then every 16th, 8th, ... frame (lazy: the frame in view only)
      const seen = new Uint8Array(U.length);
      const put = (u) => { if (u >= 0 && u < U.length && !seen[u]) { seen[u] = 1; q.full.push(u); } };
      for (const u of need(q, at)) put(u);
      put(0); put(U.length - 1);
      for (let st = 16; st >= 1; st >>= 1) for (let u = 0; u < U.length; u += st) put(u);
      if (q.lazy) q.order = need(q, at).slice(); else { q.order = q.full; }
      if (o.autoplay) play(); else ui.playing(false);
      const nextU = () => {
        while (q.urgent.length) { const u = q.urgent.shift(); if (!has(q, u)) return u; }
        while (q.qpos < q.order.length) { const u = q.order[q.qpos++]; if (!has(q, u)) return u; }
        return -1;
      };
      (async () => {
        const big = document.createElement('canvas');
        const bx = big.getContext('2d', { alpha: false });
        const off = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(pw, ph) : null;
        const sm = /** @type {any} */ (off || Object.assign(document.createElement('canvas'), { width: pw, height: ph }));
        const sx = sm.getContext('2d', { alpha: false });
        const enc = (type) => (off ? off.convertToBlob({ type, quality: PV_Q }) : new Promise((r) => sm.toBlob(r, type, PV_Q)));
        try {
          if (!q.raw) q.mime = await pvMime();
          while (!q.dead) {
            const u = nextU();
            if (u < 0) {
              if (q.ready === U.length) break;
              big.width = 1; big.height = 1; // (lazy: nothing to draw until a seek or Play)
              await new Promise((r) => { q.wake = r; }); q.wake = null;
              continue;
            }
            while (!q.dead && ui.blocked()) await idle(); // (a video being saved goes first)
            if (q.dead) return;
            await slot(q);
            if (q.dead) return;
            if (big.width !== plan.W || big.height !== plan.H) { big.width = plan.W; big.height = plan.H; }
            if (!(await videoFrame(plan, U[u], bx)) || q.dead) return;
            sx.globalAlpha = 1; sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high';
            sx.drawImage(big, 0, 0, pw, ph);
            if (q.raw) {
              const bm = off ? off.transferToImageBitmap() : await createImageBitmap(sm);
              if (q.dead) { if (bm.close) bm.close(); return; }
              q.bm[u] = bm;
            } else {
              // (compressed: the encoding runs off the main thread, at most 3 at a time, while the next frame is drawn; the
              // frame just drawn goes to the decoded cache too, kept there until its encoding is done)
              while (!q.dead && q.pend.size >= 3) await Promise.race(q.pend.values());
              if (q.dead) return;
              const p = enc(q.mime).then((bl) => { q.pend.delete(u); if (q.dead) return; if (!bl) { console.error('preview: a frame could not be encoded'); return; } q.bl[u] = bl; q.bytes += bl.size; }, (e) => { q.pend.delete(u); console.error(e); });
              q.pend.set(u, p);
              const bm = off ? off.transferToImageBitmap() : await createImageBitmap(sm);
              if (q.dead) { if (bm.close) bm.close(); return; }
              const old = q.hot.get(u); if (old && old.close) old.close();
              q.hot.set(u, bm); trim(q);
            }
            q.ready++; pvStats.renders++;
            ui.fill(q.ready, U.length);
            // (paused: the picture in view is redrawn when its own frame, or a nearer one, arrives; a run that is not
            // lazy, such as a restart after an option changed while paused, shows its frames too, not the 960 px
            // poster; review-video-preview-verify vp-1/vp-2 residual)
            if (!P.playing && (P.shown || o.autoplay || !q.lazy)) { P.drawn = -1; draw(P.i); }
          }
        } catch (e) { console.error(e); } finally { big.width = 1; big.height = 1; if (!off) { sm.width = 1; sm.height = 1; } }
      })();
    }
    // the dialog grew (or moved to a sharper screen): frames kept clearly smaller than the new size are drawn again at
    // it, from the same position, playing or paused as before; the picture in view stays until the first new frame
    // (review vp-3)
    function resize(cssW) {
      const q = run;
      if (!q || pvKeptW(q.plan.W, cssW) <= q.pw * 1.25) return false;
      let keep = null;
      if (P.shown) { keep = document.createElement('canvas'); keep.width = cv.width; keep.height = cv.height; keep.getContext('2d').drawImage(cv, 0, 0); }
      start(q.plan, { cssW, autoplay: P.playing, at: P.i, lazy: q.lazy, keep });
      if (keep) { keep.width = 1; keep.height = 1; }
      return true;
    }
    return {
      start, stop, play, pause, seek, draw, resize,
      toggle: () => (P.playing ? pause() : play()),
      state: () => ({ playing: P.playing, i: P.i, n: run ? run.times.length : 0, ready: run ? run.ready : 0, total: run ? run.U.length : 0, pw: run ? run.pw : 0, ph: run ? run.ph : 0, shown: P.shown, first: P.first, fps: run ? run.fps : 0, id: run ? run.id : 0, raw: run ? run.raw : null, lazy: run ? run.lazy : false, hot: run ? run.hot.size : 0, bytes: run ? run.bytes : 0, mime: run && !run.raw ? run.mime : null }),
      // (tests) the picture the preview shows at timeline index i, once its own frames are kept, as PNG data
      frame: async (i) => {
        const q = run;
        if (!q) return null;
        const e = q.times[i], us = need(q, i);
        if (us.some((u) => !has(q, u))) return null;
        const bs = await Promise.all(us.map((u) => (q.raw ? q.bm[u] : createImageBitmap(q.bl[u]))));
        const c = document.createElement('canvas'); c.width = q.pw; c.height = q.ph;
        const x = c.getContext('2d', { alpha: false });
        x.drawImage(bs[0], 0, 0); if (bs.length > 1) { x.globalAlpha = e.k; x.drawImage(bs[1], 0, 0); }
        if (!q.raw) for (const b of bs) if (b.close) b.close();
        return c.toDataURL('image/png');
      },
      entry: (i) => (run ? run.times[i] : null),
      tOf: (i) => { const e = run && run.times[i]; return e == null ? null : typeof e === 'number' ? e : e.k < 0.5 ? e.a : e.b; },
    };
  }
