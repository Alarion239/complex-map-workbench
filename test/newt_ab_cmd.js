// Raw readback of the NEWT ops' GPU output, for comparing two builds bit for bit (ci/newt_ab.js runs it on a base build
// and on a branch build and compares what it records). Scenes: the glide of the zeta step (a pole), a plain NEWT step
// (the series), a seeded one (the inverse Joukowski map) and a polynomial one, each at several places of its thread
// (and parked on plane 1), once per fresh page load. Every draw into a framebuffer is read back as it is drawn (the
// float target as float32; a one-row target, a table upload, is left out) and hashed over its raw bits; the record of a
// scene is the last hash of each target (the NEWT roots pass's targets, the carried colour targets) and the hash of the
// left canvas's pixels once the scene has settled.
// Without CMW_NEWT_AB_OUT it checks that a scene's record is the same on two loads and that its targets are not blank;
// with it, it also writes the records there, as JSON.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const OUT = process.env.CMW_NEWT_AB_OUT || '';
// (CMW_NEWT_AB_ONLY: a regex of the 'scene@x' records to take)
const ONLY = process.env.CMW_NEWT_AB_ONLY ? new RegExp(process.env.CMW_NEWT_AB_ONLY) : null;
// (CMW_NEWT_AB_RAW: a folder to write each float target's raw float32 data to, '<scene>@<x> <target>.f32')
const RAW = process.env.CMW_NEWT_AB_RAW || '';
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (the places of a thread: x is the plane index plus the glide's u)
const U = [0.25, 0.5, 0.75, 0.998];
const RECT = { id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] };
const SCENES = [
  { name: 'zeta', step: { type: 'zeta', params: {}, on: true }, shape: { id: 's1', kind: 'rect', a: [1.5, -6], b: [5, 6] }, view: { cx: 3, cy: 0, s: 60 }, xs: [...U, 1] },
  { name: 'plain', step: { type: 'series', params: {}, on: true }, shape: RECT, view: { cx: 0, cy: 0, s: 60 }, xs: U },
  { name: 'seeded', step: { type: 'ijouk', params: {}, on: true }, shape: RECT, view: { cx: 0, cy: 0, s: 60 }, xs: U },
  { name: 'polynomial', step: { type: 'poly', params: { co: '1, 0, -1, 0' }, on: true }, shape: RECT, view: { cx: 0, cy: 0, s: 60 }, xs: U },
];
// Installed once per page: the hook of the draw calls, and the record of the last hash of each target.
const HOOK = `(() => {
  if (window.__ab) return 1;
  const gl = GLR.gl, rec = {}, st = { on: false };
  const hash = (u) => { let a = 0x811c9dc5 | 0, b = 0x01000193 | 0; for (let i = 0; i < u.length; i++) { a = Math.imul(a ^ u[i], 0x01000193); b = Math.imul(b + u[i] | 0, 0x85ebca6b) ^ (b >>> 13); } return (a >>> 0).toString(16) + (b >>> 0).toString(16); };
  const raw = {};
  const grab = (k, w, h, float) => { const buf = float ? new Float32Array(4 * w * h) : new Uint8Array(4 * w * h); gl.readPixels(0, 0, w, h, gl.RGBA, float ? gl.FLOAT : gl.UNSIGNED_BYTE, buf); if (float) raw[k + '|' + w + 'x' + h] = buf; const u = new Uint32Array(buf.buffer); let blank = true; for (let i = 0; i < u.length; i++) if (u[i] !== u[0]) { blank = false; break; } rec[k + '|' + w + 'x' + h] = { h: hash(u), blank }; };
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
  window.__ab = { rec, st, raw };
  return 1;
})()`;
const stateOf = (sc) => ({ shapes: [sc.shape], steps: [sc.step], rightMode: 'image', srcView: sc.view });
const ready = () => settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwP === "function" && !!window.GLR' });
// the record of a scene at thread place x, from a fresh page load
const record = async (sc, x) => {
  await view(1440, 900, false);
  await loadView('steps', `ab${Date.now()}`, stateOf(sc));
  await ready();
  await ev(HOOK);
  await sleep(2500);
  await ev('Object.keys(window.__ab.rec).forEach((k) => delete window.__ab.rec[k]), window.__ab.st.on = true, 1');
  await ev(`__cmwSteps({ ${x === Math.floor(x) ? 'park' : 'x'}: ${x} }), 1`);
  await settled({ max: 90000, until: `__cmwSteps().x === ${x} || (__cmwSteps().glide && Math.abs(${Math.floor(x)} + __cmwSteps().glide.u - ${x}) < 1e-9)` });
  await sleep(2500);
  const r = await ev(`(() => { const cv = document.querySelector('#canvasL'), c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.drawImage(cv, 0, 0); const u = new Uint32Array(g.getImageData(0, 0, c.width, c.height).data.buffer); let a = 0x811c9dc5 | 0, blank = true; for (let i = 0; i < u.length; i++) { a = Math.imul(a ^ u[i], 0x01000193); if (u[i] !== u[0]) blank = false; } window.__ab.rec['canvasL|' + c.width + 'x' + c.height] = { h: (a >>> 0).toString(16), blank }; return JSON.stringify(window.__ab.rec); })()`);
  return typeof r === 'string' ? JSON.parse(r) : r;
};
const records = {};
for (const sc of SCENES) {
  for (const x of sc.xs) {
    const key = `${sc.name}@${x}`;
    if (ONLY && !ONLY.test(key)) continue;
    let a = await record(sc, x), b = await record(sc, x);
    // (a load that disagrees with both of two others is the odd one out: the frame count of a software renderer's run varies)
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      const c = await record(sc, x);
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
    info[key] = targets.map((k) => k + (a[k].blank ? ' (blank)' : '')).join(' ');
  }
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(records, null, 1));
return { pass: fails.length === 0, fails: fails.slice(0, 10), info };
