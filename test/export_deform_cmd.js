// The steps view's video export beyond the frames (export_glide_cmd.js checks those): the WebM fallback where H.264 cannot
// be encoded, a video that keeps nothing unless a test asks, the lecture pace of videoTimes(), the dark theme (no frame
// rebuilds the app), and the Export dialog's Video format: its options, the summary line, Save video with its progress, no
// long task, Cancel, the narrow phones, and the dialog's video preview (it plays at the video's frame rate, its frame k is
// the saved video's frame k). The classic views' deformation export is export_deform_classic_cmd.js.
// CMW_ONLY names one part (the CI runs each: ci/browser_suites.js): 'video' (the first four), 'dialog', 'preview'; with none
// every part runs. Writes its files to test/regress/export/out/. A command file for a CDP daemon (test/cdp_kit README).
const OUT = path.join(DIR, '..', 'regress', 'export', 'out');
fs.mkdirSync(OUT, { recursive: true });
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const only = process.env.CMW_ONLY || '';
const part = (p) => !only || only === p;
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
await view(1440, 900, false);
await load('xdf' + Date.now(), {});
const base = await ev('location.origin');
let ns = 0;
// the steps view on example exN, parked on its first plane, with the page's saved downloads and clipboard recorded
const open = async (exN, w = 1440, h = 900, dark = false) => {
  await view(w, h, dark, w < 500);
  await go(`${base}/test.html?view=steps&ns=xdf${Date.now() % 1e7}${ns++}`);
  await settled({ until: 'window.MathJax && typeof MathJax.tex2svg === "function" && !!window.__cmwSteps && !!window.Figure', max: 30000 });
  await ev(`(__cmwExample(${exN}), 1)`);
  await adopted();
  await settled({ until: '__cmwSteps().planes.length > 0', max: 15000, floor: 300 });
  await ev(`(__cmwSteps({ surf: 'plane' }), __cmwSteps({ go: 0, now: true }), __cmwSet('wKey', false), 1)`);
  await settled({ until: '!__cmwSteps().moving', max: 15000, floor: 400 });
  await ev(`(() => { window.__saved = []; const click = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__saved.push({ name: this.download, href: this.href }); return; } return click.call(this); }; return 1; })()`);
};
const dlg = async () => { for (let i = 0; i < 120; i++) { await sleep(150); if (await ev(`(() => { const d = __cmwFig.dialog(); return !!(d && d.fig && !d.building); })()`) === true) return true; } return false; };
const longTasksOn = () => ev(`(() => { window.__lt = []; window.__po = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }); window.__po.observe({ entryTypes: ['longtask'] }); return 1; })()`);
const b64 = `const u8 = new Uint8Array(await r.blob.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));`;

if (part('video')) {
  await open(1);
  const m = await ev('(() => { const g = __cmwFig.glide(); return g.hi - g.lo; })()');
  // the fallback where H.264 cannot be encoded: VP9 in our WebM muxer (forced here), decoded back
  const wv = await ev(`await (async () => { try { const r = await __cmwFig.makeVideo({ video: { size: '1280x720', fps: 30, secs: 1, ends: 'once', look: 'print', webm: true }, keepForCheck: true }); const chk = await __cmwFig.videoCheck(20, 256, 144);
    ${b64} return { ext: r.ext, codec: r.codec, frames: r.frames, fps: r.fps, W: r.W, H: r.H, mad: chk && chk.mad, b64: btoa(s) }; } catch (e) { return { err: String(e && e.stack || e).slice(0, 500) }; } })()`, 300000);
  if (wv && wv.b64) { fs.writeFileSync(path.join(OUT, 'video-webm.' + wv.ext), Buffer.from(wv.b64, 'base64')); delete wv.b64; }
  const nW = await ev(`__cmwFig.videoTimes({ size: '1280x720', fps: 30, secs: 1, ends: 'once' }, ${m}).length`);
  ok('the WebM fallback: VP9 in WebM, every frame of the glide, a decoded frame matches the exact render', wv && wv.ext === 'webm' && /^vp09/.test(wv.codec) && wv.frames === nW && wv.mad < 12, { wv, nW });
  // nothing of a video is kept unless a test asks
  const kept = await ev(`await (async () => { const r = await __cmwFig.makeVideo({ video: { size: '1280x720', fps: 30, secs: 1, ends: 'once' } }); return { frames: r.frames, check: await __cmwFig.videoCheck(5) }; })()`, 300000);
  ok('a video made without keepForCheck keeps nothing (videoCheck finds no last video)', kept && kept.frames > 0 && kept.check === null, kept);
  // a lecture's pace: each step eased on its own, a hold at every whole t, 1.2 s holds at the ends, a loop that fades back
  // to t = 0 instead of jumping
  const pace = await ev(`(() => { const T = __cmwFig.videoTimes({ fps: 30, secs: 4, ends: 'once' }, 2), L = __cmwFig.videoTimes({ fps: 30, secs: 4, ends: 'loop' }, 2);
    const run = (arr, v) => { let best = 0, cur = 0; for (const x of arr) { if (typeof x === 'number' && Math.abs(x - v) < 1e-12) { cur++; best = Math.max(best, cur); } else cur = 0; } return best; };
    return { n: T.length, h0: run(T, 0), h1: run(T, 1), h2: run(T, 2), sym: Math.abs((T.indexOf(1) - T.lastIndexOf(0)) - (T.indexOf(2) - T.lastIndexOf(1))) <= 1, fades: L.filter((x) => typeof x === 'object').length, endObj: typeof L[L.length - 1] === 'object' && L[L.length - 1].b === 0 }; })()`);
  ok('video pace: holds of 1.2 s at both ends, 0.6 s at t = 1, equal time per step, the loop fades back to t = 0', pace.h0 >= 36 && pace.h2 >= 36 && pace.h1 >= 18 && pace.sym && pace.fades === 45 && pace.endObj, pace);
  const per = await ev(`[1, 2, 5].map((k) => __cmwFig.videoTimes({ fps: 30, secs: 4, ends: 'once' }, k).length)`);
  ok('video pace: the Length is the length of each step (1 step: 4 s + 2.4 s of holds; each further step: 4 s + 0.6 s)', per[0] === 1 + 120 + 72 && per[1] - per[0] === 120 + 18 && per[2] - per[1] === 3 * (120 + 18), per);
  // the glide video of a long thread in the page keeps its frames: no main-thread task of 50 ms or more, the pane still beats
  await longTasksOn();
  const lt = await ev(`await (async () => { let beats = 0; const hb = setInterval(() => beats++, 16); const t0 = performance.now(); const r = await __cmwFig.makeVideo({ video: { size: '1920x1080', fps: 60, secs: 1, ends: 'bounce', look: 'print', tlabel: true } }); clearInterval(hb); window.__po.disconnect(); return { frames: r.frames, wall: Math.round(performance.now() - t0), beats, lt: window.__lt }; })()`, 600000);
  ok('glide video 1920 x 1080 at 60 fps: no main-thread task of 50 ms or more while it is made', lt && !lt.lt.some((d) => d >= 50) && lt.beats > 0.25 * lt.wall / 16, lt);
  // the dark theme: an export render does not flip the page's theme, so no frame rebuilds the app
  await open(1, 1440, 900, true);
  const dk = await ev(`await (async () => { let flips = 0; const mo = new MutationObserver((l) => { flips += l.length; }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.__lt = []; const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }); po.observe({ entryTypes: ['longtask'] });
    const r = await __cmwFig.makeVideo({ video: { size: '1280x720', fps: 30, secs: 1, ends: 'once', look: 'light' } });
    const f = await __cmwFig.build({ for: 'article' }); await new Promise((q) => setTimeout(q, 50)); po.disconnect(); mo.disconnect();
    return { frames: r.frames, flips, lt: window.__lt, dark: matchMedia('(prefers-color-scheme: dark)').matches, fig: !!f }; })()`, 300000);
  ok('dark theme: a video and a figure flip the theme at most once and make no task of 50 ms or more', dk && dk.dark && dk.flips <= 2 && !dk.lt.some((d) => d >= 50) && dk.fig, dk);
  info.video = { wv, dk, lt };
}

if (part('dialog')) {
  await open(1);
  await ev(`(() => { const s = __cmwFig.settings(); s.fmt = 'pdf'; __cmwFig.saveSettings(s); return 1; })()`);
  await ev('Figure.open(); 1'); await dlg();
  let q = await ev(`(() => ({ fmts: [...document.querySelectorAll('#xfFmt button')].map((b) => b.dataset.v), tex: document.getElementById('xfTex').textContent }))()`);
  ok('dialog (steps view): PDF, PNG, SVG, Video', q.fmts.join() === 'pdf,png,svg,video', q);
  await clickSel('#xfFmt button[data-v="png"]'); await settle(300);
  await key('Escape'); await settle(300);
  await ev('Figure.open(); 1'); await dlg();
  q = await ev(`(document.querySelector('#xfFmt [aria-checked="true"]') || {}).dataset.v`);
  ok('the format is remembered (PNG)', q === 'png', q);
  await clickSel('#xfFmt button[data-v="video"]'); await settle(400);
  await clickSel('#xfVSize button[data-v="1280x720"]'); await settle(200);
  q = await ev(`(() => ({ win: !!document.getElementById('xfVWin'), paths: !!document.querySelector('#xfVideoBox .xf-checks input[data-k="paths"]'), len: (() => { const s = document.getElementById('xfVLen'); return { aria: s.getAttribute('aria-label'), opts: [...s.options].map((o) => o.value + ':' + o.textContent) }; })(), name: document.getElementById('xfName').value, sum: (document.getElementById('xfVSum') || {}).textContent }))()`);
  ok('dialog Video: no Window choice (the glide is the pane as on screen), the Length menu is per step, the summary line', !q.win && q.len.aria === 'Length of each step' && q.len.opts.join() === '2:2 s per step,3:3 s per step,4:4 s per step,6:6 s per step' && /→.*· [0-9.,]+ s/.test(q.sum || ''), q);
  ok('dialog Video: the name is the scene\'s (the steps view has one video of the thread)', q.name === 'strip-to-disk', q.name);
  await ev(`(() => { const s = document.getElementById('xfVLen'); s.value = '2'; s.dispatchEvent(new Event('change')); return 1; })()`);
  // (the hint is rewritten when the poster of the chosen size is drawn, so it is what is waited on: a poster of the earlier size may be showing)
  for (let i = 0; i < 40; i++) { await sleep(200); if (await ev(`!!document.querySelector('.xf-poster').getAttribute('src') && /1280 × 720/.test(document.querySelector('.xf-hint').textContent)`)) break; }
  q = await ev(`(() => ({ hidden: ['xfOverleaf', 'xfDocs', 'xfMore'].map((id) => document.getElementById(id).hidden), vid: !document.getElementById('xfVideo').hidden, poster: !!document.querySelector('.xf-poster').getAttribute('src'), ext: document.querySelector('.xf-ext').textContent, hint: document.querySelector('.xf-hint').textContent }))()`);
  ok('dialog Video: a poster frame, Save video, the destinations put away', q.hidden.every(Boolean) && q.vid && q.poster && q.ext === '.mp4' && /1280 × 720/.test(q.hint), q);
  await shot('export-dlg-glide-1440');
  await ev('window.__saved.length = 0; 1'); await longTasksOn();
  const nameWas = await ev(`document.getElementById('xfName').value`);
  await clickSel('#xfVideo');
  let sawProg = false;
  for (let i = 0; i < 300; i++) { await sleep(200); if (!sawProg) sawProg = await ev(`!document.querySelector('.xf-prog').hidden && /Frame \\d+ of \\d+/.test(document.querySelector('.xf-progtxt').textContent)`); if (await ev('window.__saved.length > 0')) break; }
  q = await ev(`({ saved: window.__saved.map((s) => s.name), after: document.querySelector('.xf-after2').textContent, lt: window.__lt })`);
  ok('Save video: a progress bar, then the .mp4 (H.264, 1280 x 720, 30 fps)', sawProg && q.saved.includes(nameWas + '.mp4') && /1280 × 720, 30 fps/.test(q.after) && /H\.264/.test(q.after), { nameWas, q });
  ok('Save video in the dialog: no main-thread task of 50 ms or more', !q.lt.some((d) => d >= 50), q.lt);
  await ev('window.__saved.length = 0; 1');
  // a long video, so Cancel comes while it is being made: 1920 x 1080 at 60 fps, 6 s per step
  await clickSel('#xfVSize button[data-v="1920x1080"]'); await clickSel('#xfVFps button[data-v="60"]');
  await ev(`(() => { const s = document.getElementById('xfVLen'); s.value = '6'; s.dispatchEvent(new Event('change')); return 1; })()`); await sleep(300);
  const box0 = await ev(`(() => { const r = document.querySelector('.modal.xf').getBoundingClientRect(); return [r.top, r.height]; })()`);
  await clickSel('#xfVideo');
  for (let i = 0; i < 100; i++) { await sleep(100); if (await ev(`!document.querySelector('.xf-prog').hidden && /Frame (\\d+)/.test(document.querySelector('.xf-progtxt').textContent) && +/Frame (\\d+)/.exec(document.querySelector('.xf-progtxt').textContent)[1] > 5`)) break; }
  q = await ev(`(() => { const r = document.querySelector('.modal.xf').getBoundingClientRect(), pb = document.querySelector('.xf-meter'); return { box: [r.top, r.height], locked: [...document.querySelectorAll('#xfVideoBox button, #xfVideoBox select, #xfVideoBox input')].every((e) => e.disabled), now: pb.getAttribute('aria-valuenow'), min: pb.getAttribute('aria-valuemin'), max: pb.getAttribute('aria-valuemax'), live: document.querySelector('.xf-progtxt').getAttribute('role'), status: [...document.querySelectorAll('.xf-foot [role="status"]')].map((e) => e.textContent) }; })()`);
  ok('during a video: the dialog does not move, the options are locked, the progress bar has a value, the frame count is not announced', Math.abs(q.box[0] - box0[0]) < 1 && Math.abs(q.box[1] - box0[1]) < 1 && q.locked && +q.now > 0 && q.min === '0' && q.max === '100' && q.live == null && q.status.every((t) => !/Frame/.test(t)), { box0, q });
  await ev(`(() => { const b = document.getElementById('xfVCancel'); if (b && !b.closest('[hidden]')) b.click(); return !!b; })()`);
  for (let i = 0; i < 40; i++) { await sleep(150); if (await ev(`document.querySelector('.xf-prog').hidden`)) break; }
  await sleep(400);
  q = await ev(`({ saved: window.__saved.map((s) => s.name) })`);
  ok('Cancel stops the video: nothing saved', q.saved.length === 0, q);
  ok('after Cancel the options are free again', await ev(`[...document.querySelectorAll('#xfVideoBox button, #xfVideoBox select, #xfVideoBox input')].every((e) => !e.disabled)`), null);
  for (const [w, h, dark] of [[760, 900, true], [360, 780, false], [360, 780, true]]) {
    await open(1, w, h, dark);
    await ev(`(() => { const s = __cmwFig.settings(); s.fmt = 'video'; __cmwFig.saveSettings(s); return 1; })()`);
    await ev('Figure.open(); 1'); await dlg(); await settle(600);
    const mm = await ev(`(() => { const e = document.querySelector('.modal.xf'), v = document.getElementById('xfVideo').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, vw: innerWidth, over: e.scrollWidth - e.clientWidth, vid: [v.left, v.right] }; })()`);
    ok(`dialog Video ${w} ${dark ? 'dark' : 'light'}: no horizontal scroll, Save video on screen`, mm.sw <= mm.vw && mm.over <= 0 && mm.vid[0] >= 0 && mm.vid[1] <= mm.vw, mm);
  }
}

if (part('preview')) {
  const pvState = () => ev(`(() => { const d = __cmwFig.dialog(); if (!d || !d.preview) return null; const sk = document.getElementById('xfPvSeek');
    return Object.assign(d.preview.state(), { note: d.preview.note(), poster: !document.querySelector('.xf-poster').hidden, canvas: !document.querySelector('.xf-pvcv').hidden, btn: document.getElementById('xfPvPlay').getAttribute('aria-label'),
      seek: [+sk.value, +sk.max, sk.getAttribute('aria-valuetext')], time: document.querySelector('.xf-pvtime').textContent, stats: __cmwFig.previewStats() }); })()`);
  const { scrubberKeys } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'preview_scrubber.js'), 'utf8'))({ ev, key, settled, pvState });
  const filled = `(() => { const d = __cmwFig.dialog(); const s = d && d.preview && d.preview.state(); return !!(s && s.total > 0 && s.ready === s.total); })()`;
  // in the page: the preview's picture at timeline index k against the saved video's frame k, decoded, and against the exact
  // render at its t, all at the preview's size; mean abs difference of 255
  const VS = `async (k) => { const d = __cmwFig.dialog(), s = d.preview.state(), o = Object.assign(d.preview.opts(), { keepForCheck: true, alive: null });
    const r = await __cmwFig.makeVideo(o); const chk = await __cmwFig.videoCheck(k, s.pw, s.ph), pf = await d.preview.frame(k);
    const px = async (u) => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = s.pw; c.height = s.ph; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, s.pw, s.ph).data; };
    const mad = (a, b) => { let q = 0; for (let i = 0; i < a.length; i += 4) q += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return +(q / (a.length / 4 * 3)).toFixed(3); };
    const P = await px(pf), D = await px(chk.decoded), X = await px(chk.exact);
    let lo = 255, hi = 0; for (let i = 0; i < P.length; i += 4) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
    return { k, frames: r.frames, n: s.n, pw: s.pw, ph: s.ph, madVideo: mad(P, D), madExact: mad(P, X), range: hi - lo }; }`;
  await open(1);
  await ev(`(() => { const s = __cmwFig.settings(); s.fmt = 'video'; s.video = { size: '1280x720', fps: 30, secs: 2, ends: 'once', tlabel: true, look: 'light' }; __cmwFig.saveSettings(s); return 1; })()`);
  await longTasksOn();
  await ev('Figure.open(); 1'); await dlg();
  let tPoster = -1, tMoving = -1, tFilled = -1;
  const t0 = Date.now();
  for (let i = 0; i < 400 && (tMoving < 0 || tFilled < 0); i++) {
    const st = await pvState();
    if (st) { if (tPoster < 0 && st.poster) tPoster = Date.now() - t0; if (tMoving < 0 && st.canvas) tMoving = Date.now() - t0; if (tFilled < 0 && st.ready === st.total && st.total > 0) tFilled = Date.now() - t0; }
    await sleep(150);
  }
  const st = await pvState();
  ok('preview: the glide plays in the dialog by itself, every frame drawn, the note says at what size', tMoving >= 0 && tFilled >= 0 && st && st.ready === st.total && st.total > 0 && st.total <= st.n && /^Preview/.test(st.note || ''), st);
  const adv = await ev(`await (async () => { const d = __cmwFig.dialog(); const a = d.preview.state().i; const t = performance.now(); await new Promise((r) => setTimeout(r, 1000)); return { rate: d.preview.state().i - a, ms: performance.now() - t }; })()`);
  ok('preview: it advances at the video\'s frame rate (30 fps: 24 to 36 frames a second)', adv && adv.rate >= 24 && adv.rate <= 36, adv);
  const m1 = await ev(`await (${VS})(Math.floor(__cmwFig.dialog().preview.state().n * 0.4))`, 300000);
  ok('preview: its frame k is the saved video\'s frame k (decoded MP4 < 4 of 255; the exact render < 6) and not blank', m1 && m1.frames === m1.n && m1.madVideo < 4 && m1.madExact < 6 && m1.range > 20, m1);
  await ev(`(() => { window.__po && window.__po.disconnect(); return 1; })()`);
  ok('preview: no main-thread task of 50 ms or more while it fills and plays', !(await ev('window.__lt')).some((d) => d >= 50), null);
  await ev(`(() => { const b = document.getElementById('xfPvPlay'); b.click(); return 1; })()`); await sleep(300);
  const p1 = await pvState(); await sleep(400); const p2 = await pvState();
  ok('preview: the button pauses it', p1 && p2 && p1.btn === 'Play' && typeof p1.i === 'number' && p1.i === p2.i, { p1, p2 });
  // the scrubber takes the keyboard, paused (the steps view's preview has its own page, so its own run of the check)
  const { mid, k0, k1, k2, k3 } = await scrubberKeys();
  ok('preview: the scrubber takes the keyboard (Right: one frame on; End; Home), paused', k0.i === mid && !k0.playing && k1.i === mid + 1 && !k1.playing && k2.i === k2.n - 1 && k3.i === 0 && k3.seek[0] === 0, { mid, n: k2.n, k0: k0.i, k1: k1.i, k2: k2.i, k3: k3.i });
  await key('Escape'); await settle(300);
  ok('preview: closing the dialog stops it', (await ev('!__cmwFig.dialog()')) === true, null);
}
return { pass: fails.length === 0, fails, info };
