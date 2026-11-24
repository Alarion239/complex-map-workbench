// Raw readback of the NEWT ops' GPU output, for comparing two builds bit for bit (ci/newt_ab.js runs it on a base build
// and on a branch build and compares what it records). Scenes: the glide of the zeta step (a pole member), a plain NEWT
// step (the series), a seeded one (the inverse Joukowski map), a polynomial one (of degree 5: degrees 3 and 4 are the
// closed forms' RAT3 and RAT4 ops, with no NEWT op), and the Douady-Hubbard map's under Everywhere (seeded, landed down
// the external ray, with the dual derivative), each at several places of its thread (and
// parked on plane 1), once per fresh page load. Every draw into a framebuffer is read back as it is drawn (the float target
// as float32; a one-row target, a table upload, is left out) and hashed over its raw bits.
// The roots pass seeds each pass from the last one of the same size and view, at whatever t that was, and each pass moves
// its targets on (a held place never stops changing), so what a place shows depends on how many passes ran before, which
// timing decides. The record of a place inside the thread is therefore taken from a cold start: after a frame at another
// window width (another key), the first pass back at the first width seeds from nothing, and the record of each frame-sized
// target (the roots pass's, the carried colour targets) is its hashes over that pass and the PASSES - 1 after it, each
// asked for one at a time; a smaller target keeps its last hash, and the detour's own targets are left out. Parked, where no roots pass runs, the record is each
// target's last hash and the left canvas's pixels once the scene has settled.
// Without CMW_NEWT_AB_OUT it checks that a scene's record is the same on two loads, that it read targets back (a blank
// target is marked '(blank)' in the info, not failed: a scene may draw a target that stays empty) and that a glide inside
// the thread took the inverse pass; with it, it also writes the records there, as JSON.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the full gate, in its own shard newt-ab
// (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const OUT = process.env.CMW_NEWT_AB_OUT || '';
// (CMW_NEWT_AB_ONLY: a regex of the 'scene@x' records to take)
const ONLY = process.env.CMW_NEWT_AB_ONLY ? new RegExp(process.env.CMW_NEWT_AB_ONLY) : null;
// (CMW_NEWT_AB_RAW: a folder to write each float target's raw float32 data to, '<scene>@<x> <target>.f32')
const RAW = process.env.CMW_NEWT_AB_RAW || '';
// (the places of a thread: x is the plane index plus the glide's u)
const U = [0.25, 0.5, 0.75, 0.998];
const RECT = { id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] };
// (scope 'all': the steps view's Everywhere, where the Douady-Hubbard glide takes the inverse pass)
const SCENES = [
  { name: 'zeta', step: { type: 'zeta', params: {}, on: true }, shapes: [{ id: 's1', kind: 'rect', a: [1.5, -6], b: [5, 6] }], view: { cx: 3, cy: 0, s: 60 }, xs: [...U, 1] },
  { name: 'plain', step: { type: 'series', params: {}, on: true }, shapes: [RECT], view: { cx: 0, cy: 0, s: 60 }, xs: U },
  { name: 'seeded', step: { type: 'ijouk', params: {}, on: true }, shapes: [RECT], view: { cx: 0, cy: 0, s: 60 }, xs: U },
  { name: 'polynomial', step: { type: 'poly', params: { co: '1, 0, 0, 0, -2, 1' }, on: true }, shapes: [RECT], view: { cx: 0, cy: 0, s: 60 }, xs: U },
  { name: 'dh', step: { type: 'dh', params: {}, on: true }, shapes: [], scope: 'all', view: { cx: 0, cy: 0, s: 60 }, xs: U },
];
// (the record's sizes; the waits below say how they are used)
const PASSES = 3, STABLE_FRAMES = 6, DETOUR_W = 1280, FRAME_MIN = 64;
// Installed once per page: the hook of the draw calls; rec, the last hash of each target; seq, the hashes of each
// frame-sized target since the last draw of a frame-sized target at another size (so from a cold roots pass).
const HOOK = `(() => {
  if (window.__ab) return 1;
  const gl = GLR.gl, rec = {}, seq = {}, st = { on: false, frames: 0, changed: 0, size: '' };
  // (st.frames counts animation frames, st.changed is the frame at which a target's hash last changed)
  const tick = () => { st.frames++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const hash = (u) => { let a = 0x811c9dc5 | 0, b = 0x01000193 | 0; for (let i = 0; i < u.length; i++) { a = Math.imul(a ^ u[i], 0x01000193); b = Math.imul(b + u[i] | 0, 0x85ebca6b) ^ (b >>> 13); } return (a >>> 0).toString(16) + (b >>> 0).toString(16); };
  const raw = {};
  const grab = (k, w, h, float) => { const buf = float ? new Float32Array(4 * w * h) : new Uint8Array(4 * w * h); gl.readPixels(0, 0, w, h, gl.RGBA, float ? gl.FLOAT : gl.UNSIGNED_BYTE, buf); const u = new Uint32Array(buf.buffer); let blank = true; for (let i = 0; i < u.length; i++) if (u[i] !== u[0]) { blank = false; break; } const key = k + '|' + w + 'x' + h, hu = hash(u), was = rec[key]; if (!was || was.h !== hu) st.changed = st.frames; rec[key] = { h: hu, blank }; if (w >= ${FRAME_MIN} && h >= ${FRAME_MIN}) { if (st.size !== w + 'x' + h) { st.size = w + 'x' + h; for (const q of Object.keys(seq)) delete seq[q]; } (seq[key] = seq[key] || []).push({ h: hu, blank }); if (float && seq[key].length === ${PASSES}) raw[key] = buf; } else if (float) raw[key] = buf; };
  const capture = () => {
    const vp = gl.getParameter(gl.VIEWPORT), fb = gl.getParameter(gl.FRAMEBUFFER_BINDING), w = vp[2], h = vp[3];
    if (!(w > 0 && h > 0)) return;
    if (!fb || h < 2) return;
    const rb = gl.getParameter(gl.READ_BUFFER);
    for (let i = 0; i < 8; i++) {
      if (gl.getParameter(gl.DRAW_BUFFER0 + i) === gl.NONE) continue;
      const att = gl.COLOR_ATTACHMENT0 + i;
      const float = gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER, att, gl.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE) === gl.FLOAT;
      gl.readBuffer(att);
      grab('fbo' + i + (float ? 'f' : 'b'), w, h, float);
    }
    gl.readBuffer(rb);
  };
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced']) {
    const o = WebGL2RenderingContext.prototype[name];
    WebGL2RenderingContext.prototype[name] = function (...a) { o.apply(this, a); if (st.on && this === gl) { try { capture(); } catch (e) { rec.error = String(e); } } };
  }
  window.__ab = { rec, seq, st, raw };
  return 1;
})()`;
const stateOf = (sc) => ({ shapes: sc.shapes, steps: [sc.step], rightMode: 'image', srcView: sc.view });
// (waits: the page's load, the scope's prestart, the page quiet once the hook is installed (no pane frame pending), the
// glide's frame at its place (u within GLIDE_U_TOL) with its programs warm (__cmwSteps().ready.ready, the wait for a held
// frame), the glide drawn at DETOUR_W and back, then each pass asked for, until every frame-sized target has PASSES;
// parked, STABLE_FRAMES animation frames in which no target changed. A target of at least FRAME_MIN × FRAME_MIN pixels is
// frame-sized)
const LOAD_MAX_MS = 60000, WARM_MAX_MS = 120000, GLIDE_MAX_MS = 90000, PASS_MAX_MS = 30000, GLIDE_U_TOL = 1e-9;
// (a scene is loaded LOADS_PER_SCENE times, a third only when the first two disagree: a software renderer's frame count varies)
const LOADS_PER_SCENE = 2;
const ready = () => settled({ max: LOAD_MAX_MS, until: 'typeof __cmwSteps === "function" && typeof __cmwP === "function" && !!window.GLR' });
// the record of a scene at thread place x, from a fresh page load
const record = async (sc, x) => {
  await view(1440, 900, false);
  await loadView('steps', `ab${Date.now()}`, stateOf(sc));
  await ready();
  if (sc.scope) {
    await ev(`__cmwSteps({ scope: ${JSON.stringify(sc.scope)} }), 1`);
    await settled({ max: WARM_MAX_MS, until: '__cmwSteps().ready.ready' });
  }
  await ev(HOOK);
  await settled({ max: WARM_MAX_MS });
  // (a place inside the thread waits for the glide's frame there: the thread reaches x before that frame is drawn)
  const parked = x === Math.floor(x);
  const atX = parked ? `__cmwSteps().x === ${x}` : `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(${Math.floor(x)} + g.u - ${x}) < ${GLIDE_U_TOL}; })()`;
  await ev(`__cmwSteps({ ${parked ? 'park' : 'x'}: ${x} }), 1`);
  await settled({ max: GLIDE_MAX_MS, until: atX });
  await settled({ max: GLIDE_MAX_MS, until: '__cmwSteps().ready.ready' });
  // (the glide's path at a place inside the thread: the NEWT ops are drawn by the inverse pass)
  if (!parked) { const drawn = await ev('__cmwSteps().glide.path'); ok(`${sc.name}@${x}: the glide takes the inverse pass`, drawn === 'inverse', drawn); }
  let r;
  if (!parked) {
    // (from a cold pass: the frame at DETOUR_W is a pass of another key, and the first frame-sized draw back at the first
    // width clears seq, so each frame-sized target's hashes start at that pass)
    const w0 = await ev('__cmwSteps().glide.w');
    await ev('window.__ab.st.on = true, 1');
    await view(DETOUR_W, 900, false);
    const away = await settled({ max: GLIDE_MAX_MS, until: `__cmwSteps().glide.w !== ${w0} && __cmwSteps().ready.ready` });
    ok(`${sc.name}@${x}: the glide draws at the detour's width`, away.ok, away.busy);
    await view(1440, 900, false);
    const back = await settled({ max: GLIDE_MAX_MS, until: `__cmwSteps().glide.w === ${w0} && ${atX} && __cmwSteps().ready.ready` });
    ok(`${sc.name}@${x}: the glide draws back at the first width`, back.ok, back.busy);
    const fewest = `(() => { const q = Object.values(window.__ab.seq); return q.length ? Math.min(...q.map((e) => e.length)) : 0; })()`;
    for (let n = await ev(fewest); n < PASSES; n = await ev(fewest)) {
      await ev(`__cmwSteps({ x: ${x} }), 1`);
      const drawn = await settled({ max: PASS_MAX_MS, until: `${fewest} > ${n}` });
      if (!drawn.ok) { ok(`${sc.name}@${x}: pass ${n + 1} of ${PASSES} is drawn`, false, drawn.busy); break; }
    }
    r = await ev(`JSON.stringify(Object.assign({}, ...Object.entries(window.__ab.rec).filter(([k]) => { const m = /\\|(\\d+)x(\\d+)$/.exec(k); return m && (+m[1] < ${FRAME_MIN} || +m[2] < ${FRAME_MIN}); }).map(([k, v]) => ({ [k]: v })), ...Object.entries(window.__ab.seq).map(([k, q]) => ({ [k]: { h: q.slice(0, ${PASSES}).map((e) => e.h).join(','), blank: q.slice(0, ${PASSES}).every((e) => e.blank) } })), window.__ab.rec.error ? { error: window.__ab.rec.error } : {}))`);
  } else {
    await ev('Object.keys(window.__ab.rec).forEach((k) => delete window.__ab.rec[k]), window.__ab.st.on = true, 1');
    const stable = await settled({ max: GLIDE_MAX_MS, until: `window.__ab.st.frames - window.__ab.st.changed >= ${STABLE_FRAMES}` });
    ok(`${sc.name}@${x}: the record settles (${STABLE_FRAMES} frames with no target changed)`, stable.ok, stable.busy);
    r = await ev(`(() => { const cv = document.querySelector('#canvasL'), c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.drawImage(cv, 0, 0); const u = new Uint32Array(g.getImageData(0, 0, c.width, c.height).data.buffer); let a = 0x811c9dc5 | 0, blank = true; for (let i = 0; i < u.length; i++) { a = Math.imul(a ^ u[i], 0x01000193); if (u[i] !== u[0]) blank = false; } window.__ab.rec['canvasL|' + c.width + 'x' + c.height] = { h: (a >>> 0).toString(16), blank }; return JSON.stringify(window.__ab.rec); })()`);
  }
  return typeof r === 'string' ? JSON.parse(r) : r;
};
const records = {};
for (const sc of SCENES) {
  for (const x of sc.xs) {
    const key = `${sc.name}@${x}`;
    if (ONLY && !ONLY.test(key)) continue;
    let a = await record(sc, x), b = await record(sc, x);
    let loads = LOADS_PER_SCENE;
    // (a load that disagrees with both of two others is the odd one out: the frame count of a software renderer's run varies)
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      const c = await record(sc, x);
      loads++;
      if (JSON.stringify(c) === JSON.stringify(a)) b = c;
      else if (JSON.stringify(c) === JSON.stringify(b)) a = b;
    }
    records[key] = a;
    if (RAW) {
      fs.mkdirSync(RAW, { recursive: true });
      for (const t of Object.keys(a)) {
        if (!/^fbo/.test(t)) continue;
        const b64 = await ev(`(() => { const u8 = new Uint8Array(window.__ab.raw[${JSON.stringify(t)}].buffer); let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); })()`);
        fs.writeFileSync(path.join(RAW, `${key} ${t}.f32`), Buffer.from(b64, 'base64'));
      }
    }
    const targets = Object.keys(a).filter((k) => k !== 'error');
    ok(`${key}: draws were read back`, targets.length > 0 && !a.error, a.error || targets.length);
    ok(`${key}: a second load records the same hashes`, JSON.stringify(a) === JSON.stringify(b), Object.keys(a).filter((k) => !b[k] || a[k].h !== b[k].h));
    if (loads > LOADS_PER_SCENE) info[key + ' loads'] = loads;
    info[key] = targets.map((k) => k + (a[k].blank ? ' (blank)' : '')).join(' ');
  }
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(records, null, 1));
return { pass: fails.length === 0, fails: fails.slice(0, 10), info };
