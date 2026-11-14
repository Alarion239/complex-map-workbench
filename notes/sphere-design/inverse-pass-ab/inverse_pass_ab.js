'use strict';
// The inverse pass's A/B: a base build and this checkout's build draw the same scenes, and their draws must agree bit for
// bit. A one-off review script for the leaf's call-site merges (issue #1546), not run by CI. It is #1410's
// ci/newt_ab.js and test/newt_ab_cmd.js (their tree builds, draw hook and hashes) with scenes of the leaf and one more
// readback; if those land first, these scenes and the control belong in that tool.
//   node notes/sphere-design/inverse-pass-ab/inverse_pass_ab.js [--base REF] [--only REGEX] [--no-control] [--keep] [--work DIR]
// REF defaults to origin/claude/funny-darwin-l5uis3. Needs CHROME_BIN and CMW_CHROME_ARGS (ci/README.md); CMW_ANGLE picks
// the renderer (swiftshader; vulkan with lavapipe's flags). Exit 1 on any differing record.
// Each scene is loaded in a fresh page, moved to its place (a glide's x, the globe, a classic pane) and recorded once its
// panes are quiet:
//   - every inverse program's draw is drawn again into an RGBA32F target, blending off, and read back as raw float32
//     (the pass's own output before any 8-bit target), keyed by its variant, viewport and uniform values;
//   - every other draw into a framebuffer is read back as it is drawn (a float target as float32, a byte target as bytes);
//   - the panes' canvases.
// A record holds the last hash of each key. A scene is loaded twice, and a build's record of it is its stable core: the
// keys whose hashes agree on both loads (a key drawn by a transient frame on one load only, which a software
// renderer's timing decides, is listed apart and not compared). Two builds differ where a key of both cores has two
// hashes, or a key of one core is missing from the other build's loads. Negative control: a third build of this
// checkout with the merged code moved by one part in 10^7 (ixCentral's central difference and ixChain3's footprint
// across) must differ from the base.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const { serve } = require(path.join(ROOT, 'ci', 'lib.js'));
const { launch, sleep } = require(path.join(ROOT, 'test', 'regress', 'perf', 'cdp.js'));

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const BASE = opt('--base', 'origin/claude/funny-darwin-l5uis3');
const ONLY = argv.includes('--only') ? new RegExp(opt('--only')) : null;
// the control's edits of src/gl/02-glsl-inverse.js: [text, the same moved by one part in 10^7]
const CONTROL = [
  ['    else dl = vec2(lxp - lxm, lyp - l) * 0.5;', '    else dl = vec2(lxp - lxm, lyp - l) * 0.5000001;'],
  ['if (k == 0) g0 = g; else if (k == 1) gx = g - g0;', 'if (k == 0) g0 = g; else if (k == 1) gx = (g - g0) * 1.0000001;'],
];
const LOAD_MAX_MS = 240000, PLACE_MAX_MS = 300000, WANT_MAX_MS = 900000, FRAMES_PAUSE_MS = 2500;

const sh = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
};
// (--work DIR: where the builds go, the system's temporary folder by default)
const work = fs.mkdtempSync(path.join(opt('--work', os.tmpdir()), 'inverse_pass_ab-'));
// a built tree: `ref`'s files (git archive), or this checkout's tracked files as they are on disk, then `edits`
function tree(name, ref, edits) {
  const dir = path.join(work, name);
  fs.mkdirSync(dir);
  if (ref) {
    const r = sh('sh', ['-c', `git archive "${ref}" | tar -x -C "${dir}"`], ROOT);
    if (!r.ok) throw new Error(`${name}: git archive ${ref}: ${r.out}`);
  } else {
    for (const f of sh('git', ['ls-files'], ROOT).out.split('\n').filter(Boolean)) {
      if (!fs.existsSync(path.join(ROOT, f))) continue;
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
    }
  }
  for (const [file, pairs] of Object.entries(edits || {})) {
    const p = path.join(dir, file);
    let s = fs.readFileSync(p, 'utf8');
    for (const [a, b] of pairs) {
      if (s.split(a).length !== 2) throw new Error(`${name}: the edit's text is not in ${file} once: ${a}`);
      s = s.replace(a, b);
    }
    fs.writeFileSync(p, s);
  }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  const b = sh('python3', ['build.py'], dir);
  if (!b.ok) throw new Error(`${name}: build failed\n${b.out.slice(-2000)}`);
  return dir;
}

// The page's hook, installed before the app's scripts: programs whose fragment stage holds the inverse walk, and every
// draw read back while recording is on (window.__ab.on).
const HOOK = `(() => {
  const P = WebGL2RenderingContext.prototype, src = new WeakMap(), invFs = new WeakMap(), uniformsOf = new WeakMap();
  const ss = P.shaderSource, at = P.attachShader;
  P.shaderSource = function (s, t) { src.set(s, t); return ss.call(this, s, t); };
  P.attachShader = function (p, s) { const t = src.get(s) || ''; if (t.includes('void invWalk(')) invFs.set(p, t); return at.call(this, p, s); };
  const rec = {}, ab = { on: false, rec };
  window.__ab = ab;
  const hash = (u) => { let a = 0x811c9dc5 | 0, b = 0x01000193 | 0; for (let i = 0; i < u.length; i++) { a = Math.imul(a ^ u[i], 0x01000193); b = Math.imul(b + u[i] | 0, 0x85ebca6b) ^ (b >>> 13); } return (a >>> 0).toString(16) + (b >>> 0).toString(16); };
  const blankOf = (u) => { for (let i = 1; i < u.length; i++) if (u[i] !== u[0]) return false; return true; };
  // (every attachment of the bound draw framebuffer, as it is drawn: a float one as float32, a byte one as bytes)
  const readTargets = (gl) => {
    const vp = gl.getParameter(gl.VIEWPORT), fb = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), w = vp[2], h = vp[3];
    if (!fb || !(w > 0) || h < 2) return;
    const rfb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), rb = gl.getParameter(gl.READ_BUFFER);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
    for (let i = 0; i < 8; i++) {
      if (gl.getParameter(gl.DRAW_BUFFER0 + i) === gl.NONE) continue;
      const att = gl.COLOR_ATTACHMENT0 + i;
      const float = gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER, att, gl.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE) === gl.FLOAT;
      const buf = float ? new Float32Array(4 * w * h) : new Uint8Array(4 * w * h);
      gl.readBuffer(att);
      gl.readPixels(vp[0], vp[1], w, h, gl.RGBA, float ? gl.FLOAT : gl.UNSIGNED_BYTE, buf);
      const u = new Uint32Array(buf.buffer);
      rec['fbo' + i + (float ? 'f' : 'b') + '|' + w + 'x' + h] = { h: hash(u), blank: blankOf(u) };
    }
    gl.readBuffer(rb);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rfb);
  };
  // (the values of every active uniform of p, which tell one inverse pass from another)
  const uniformKey = (gl, p) => {
    let list = uniformsOf.get(p);
    if (!list) {
      list = [];
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const u = gl.getActiveUniform(p, i), base = u.name.replace(/\\[0\\]$/, '');
        for (let k = 0; k < u.size; k++) list.push([u.size > 1 ? base + '[' + k + ']' : u.name, gl.getUniformLocation(p, u.size > 1 ? base + '[' + k + ']' : u.name)]);
      }
      list.sort((x, y) => (x[0] < y[0] ? -1 : 1));
      uniformsOf.set(p, list);
    }
    const s = JSON.stringify(list.map(([nm, loc]) => { const v = loc ? gl.getUniform(p, loc) : null; return [nm, v && v.length !== undefined ? Array.from(v) : v]; }));
    const u = new Uint32Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return hash(u);
  };
  // an inverse program's draw drawn again into an RGBA32F target (blending off, cleared to 0) and read back as float32
  let fbo = null, tex = null, tw = 0, th = 0;
  const redraw = (gl, draw, args) => {
    const p = gl.getParameter(gl.CURRENT_PROGRAM), t = p && invFs.get(p);
    if (!t) return;
    const vp = gl.getParameter(gl.VIEWPORT), W = vp[0] + vp[2], H = vp[1] + vp[3];
    if (!(vp[2] > 0 && vp[3] > 0)) return;
    gl.getExtension('EXT_color_buffer_float');
    const dfb = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), rfb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    const pack = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING), blend = gl.isEnabled(gl.BLEND);
    if (!fbo || W > tw || H > th) {
      const unit = gl.getParameter(gl.ACTIVE_TEXTURE), bound = gl.getParameter(gl.TEXTURE_BINDING_2D);
      tw = Math.max(W, tw); th = Math.max(H, th);
      if (!tex) tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, tw, th, 0, gl.RGBA, gl.FLOAT, null);
      gl.bindTexture(gl.TEXTURE_2D, bound);
      gl.activeTexture(unit);
      if (!fbo) fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.disable(gl.BLEND);
    // (the whole target cleared, whatever the scissor and the colour mask the draw keeps)
    const scissor = gl.isEnabled(gl.SCISSOR_TEST), mask = gl.getParameter(gl.COLOR_WRITEMASK);
    gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(true, true, true, true);
    gl.clearBufferfv(gl.COLOR, 0, new Float32Array(4));
    gl.colorMask(mask[0], mask[1], mask[2], mask[3]);
    if (scissor) gl.enable(gl.SCISSOR_TEST);
    draw.apply(gl, args);
    const buf = new Float32Array(4 * vp[2] * vp[3]);
    gl.readPixels(vp[0], vp[1], vp[2], vp[3], gl.RGBA, gl.FLOAT, buf);
    if (blend) gl.enable(gl.BLEND);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pack);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dfb);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rfb);
    // (the variant, then what the draw exercises: the shape's kind (7 a formula), the carried colour's stages uGs, uGt
    // (uGs >= uGt: G the identity) and whether G is analytic, a staged shape's plane)
    const U = (nm) => { const l = gl.getUniformLocation(p, nm); return l ? gl.getUniform(p, l) : null; }, sh = U('uShape'), gs = U('uGs'), st = U('uShStage');
    const kind = 'B' + ((/const int IX_B = (\\d+)/.exec(t) || [])[1]) + (t.includes('#define IX_CARRY') ? 'c' : '') + (t.includes('#define IX_STAGED') ? 's' : '') + (t.includes('#define IX_ANISO') ? 'g' : '') + (t.includes('#define IX_NR_PASS') ? 'n' : '')
      + (sh ? ':k' + sh[0] : '') + (gs !== null ? ':G' + gs + '-' + U('uGt') + (U('uGan') ? 'a' : '') : '') + (st ? ':s' + st : '');
    const u = new Uint32Array(buf.buffer);
    rec['inv|' + kind + '|' + vp.join(',') + '|' + uniformKey(gl, p)] = { h: hash(u), blank: blankOf(u) };
  };
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const o = P[name];
    P[name] = function (...a) {
      o.apply(this, a);
      if (!ab.on || ab.busy) return;
      ab.busy = true;
      try { readTargets(this); redraw(this, o, a); } catch (e) { rec.error = String(e); }
      ab.busy = false;
    };
  }
})();`;

const RECT = { id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3], ci: 0, visible: true };
// the default example (Strip to disk): a formula region, exp, a Mobius map
const STRIP = { shapes: [{ id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}', ci: 0, visible: true }, { id: 's2', kind: 'line', a: [0, 0.8], b: [1, 0.8], ci: 1, visible: true }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }], srcView: { cx: 0, cy: 0, s: 52 } };
const typed = (expr) => ({ shapes: [RECT], steps: [{ type: 'custom', params: { expr, cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 60 } });
// scenes: the view, the saved state, the commands before the places, the places (a glide's x; none: the view as loaded)
const SCENES = [
  // the carried colour (B5) and a formula region (ixCentral) over the glides to planes 1 and 2
  { name: 'strip', view: 'steps', state: STRIP, xs: [0.25, 0.75, 1.5] },
  // opacity 0.3: B = 8, both admission paths
  { name: 'strip-a0.3', view: 'steps', state: Object.assign({}, STRIP, { alpha: 0.3 }), xs: [0.5, 1.5] },
  // the classic view's exact image: B5 and B8 without the carried colour
  { name: 'classic', view: 'classic', state: STRIP, xs: [null] },
  { name: 'classic-a0.3', view: 'classic', state: Object.assign({}, STRIP, { alpha: 0.3 }), xs: [null] },
  // a shape on plane 1 (its own staged program)
  { name: 'staged', view: 'steps', state: Object.assign({}, STRIP, { shapes: STRIP.shapes.concat([{ id: 's3', kind: 'disc', c: [0, 0.3], r: 0.4, stage: 1, ci: 2, visible: true }]) }), xs: [0.5, 1.5] },
  // the carried colour's other branches: colour plane 0 (G the identity), and a chain that is not analytic (G at three points)
  { name: 'strip-T0', view: 'steps', state: STRIP, pre: ['__cmwSteps({ T: 0 })'], xs: [0.5] },
  { name: 'conj', view: 'steps', state: Object.assign({}, STRIP, { steps: [STRIP.steps[0], { type: 'conj', params: {}, on: true }] }), xs: [0.5] },
  // Inside regions: the formula region drawn by the carried program (ixCentral there)
  { name: 'strip-in', view: 'steps', state: STRIP, pre: ["__cmwSteps({ scope: 'in' })"], xs: [0.5] },
  // B = 8 on the globe and in the staged program
  { name: 'globe-a0.3', view: 'steps', state: Object.assign({}, STRIP, { alpha: 0.3 }), pre: ["__cmwSteps({ surf: 'sphere' })"], xs: [0.5] },
  { name: 'staged-a0.3', view: 'steps', state: Object.assign({}, STRIP, { alpha: 0.3, shapes: STRIP.shapes.concat([{ id: 's3', kind: 'disc', c: [0, 0.3], r: 0.4, stage: 1, ci: 2, visible: true }]) }), xs: [0.5] },
  // a typed formula's NEWT op
  { name: 'sinzz', view: 'steps', state: typed('sin(z)/z'), xs: [0.5] },
  // the globe
  { name: 'globe', view: 'steps', state: STRIP, pre: ["__cmwSteps({ surf: 'sphere' })"], xs: [0.5] },
  // (want: the carried program, which a software renderer may still be linking when the panes are quiet, has drawn)
  { name: 'globe-terms', view: 'steps', state: typed('sin(z)+cos(2z)+exp(z/3)+log(z+2)+z^5+1/(z-1)+sqrt(z)+tan(z/2)+sinh(z)+z^2*exp(-z)'), pre: ["__cmwSteps({ surf: 'sphere' })"], xs: [0.5], want: '^inv\\|B5cg' },
];
const savedState = (st) => Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st);

// quiet: no link pending, no pane pending, compiling or refining, no running animation, and `until`
async function quiet(H, until, max) {
  const t0 = Date.now();
  for (;;) {
    const ok = await H.ev(`(() => { try { if (document.readyState !== 'complete' || !window.GLR || GLR.pendingLinks) return false;
      for (const p of ['L', 'R']) { const s = window.__cmwPaneStatus && __cmwPaneStatus(p); if (s && (s.pending || s.compiling || s.refining)) return false; }
      if (document.getAnimations().some((a) => a.playState === 'running' && a.effect && Number.isFinite(a.effect.getComputedTiming().endTime))) return false;
      return !!(${until || 'true'}); } catch (e) { return false; } })()`);
    if (ok) return true;
    if (Date.now() - t0 > max) return false;
    await sleep(250);
  }
}
async function recordPlace(H, base, sc, x) {
  const ns = 'iab' + Date.now();
  await H.nav(base + 'blank.html');
  await H.ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(savedState(sc.state)))}); 1`);
  await H.nav(base + `test.html?ns=${ns}${sc.view === 'steps' ? '&view=steps' : ''}`);
  // (a page that is still busy when its time is up is recorded all the same: its transient keys leave the core)
  const ready = sc.view === 'steps' ? "typeof __cmwSteps === 'function'" : "typeof __cmwPaneStatus === 'function'";
  let settled = await quiet(H, ready, LOAD_MAX_MS);
  if (!settled && !await H.ev(ready)) throw new Error(`${sc.name}: the app did not start`);
  // (no half-resolution passes: the cost guard's budget out of reach, whatever the machine's speed)
  await H.ev('__cmwGuardOpts({ budget: 1e9, exit: 1e9 }), 1');
  await H.ev('window.__ab.on = true, 1');
  for (const c of sc.pre || []) { await H.ev(`(${c}), 1`); settled = await quiet(H, null, PLACE_MAX_MS) && settled; }
  // (a glide's place draws anew; a view as loaded draws its panes again, now recorded)
  await H.ev(x != null ? `__cmwSteps({ x: ${x} }), 1` : '__cmwHideStrokes(false), 1');
  settled = await quiet(H, x != null ? `__cmwSteps().x === ${x}` : null, PLACE_MAX_MS) && settled;
  if (x != null && !await H.ev(`__cmwSteps().x === ${x}`)) throw new Error(`${sc.name}@${x}: the glide did not reach its place`);
  if (sc.want) settled = await quiet(H, `Object.keys(window.__ab.rec).some((k) => new RegExp(${JSON.stringify(sc.want)}).test(k))`, WANT_MAX_MS) && settled;
  await sleep(FRAMES_PAUSE_MS);
  if (!settled) await H.ev("window.__ab.rec.unsettled = { h: '1', blank: false }, 1");
  return H.ev(`(() => { const rec = window.__ab.rec; for (const id of ['canvasL', 'canvasR']) { const cv = document.getElementById(id); if (!cv || !cv.width) continue; const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.drawImage(cv, 0, 0); const u = new Uint32Array(g.getImageData(0, 0, c.width, c.height).data.buffer); let a = 0x811c9dc5 | 0, blank = true; for (let i = 0; i < u.length; i++) { a = Math.imul(a ^ u[i], 0x01000193); if (u[i] !== u[0]) blank = false; } rec[id + '|' + c.width + 'x' + c.height] = { h: (a >>> 0).toString(16), blank }; } return JSON.stringify(rec); })()`).then(JSON.parse);
}
async function record(name, dir) {
  console.log(`${name}: recording ${dir}`);
  const dist = path.join(dir, 'dist');
  fs.writeFileSync(path.join(dist, 'blank.html'), '<!doctype html><title>b</title>');
  const { server, base } = await serve(dist);
  const H = await launch({ chrome: process.env.CHROME_BIN, inject: HOOK, width: 1440, height: 900 });
  const out = {};
  try {
    for (const sc of SCENES) {
      for (const x of sc.xs) {
        const key = `${sc.name}@${x}`;
        if (ONLY && !ONLY.test(key)) continue;
        const a = await recordPlace(H, base, sc, x), b = await recordPlace(H, base, sc, x);
        const NOTES = ['error', 'unsettled'], keys = new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => !NOTES.includes(k)));
        const core = {}, transient = [];
        for (const k of keys) { if (a[k] && b[k] && a[k].h === b[k].h) core[k] = a[k]; else transient.push(k); }
        out[key] = { core, transient, error: a.error || b.error || null, unsettled: !!(a.unsettled || b.unsettled) };
        const inv = Object.keys(core).filter((k) => k.startsWith('inv|'));
        console.log(`${name} ${key}: ${Object.keys(core).length} stable records (${inv.length} inverse draws: ${[...new Set(inv.map((k) => k.split('|')[1]))].join(' ')}), ${transient.length} transient${out[key].error ? ' ERROR ' + out[key].error : ''}${out[key].unsettled ? ' (a load did not settle)' : ''}`);
      }
    }
  } finally {
    await H.close();
    server.close();
  }
  fs.writeFileSync(path.join(work, name + '.json'), JSON.stringify(out, null, 1));
  return out;
}
// the keys that differ between two builds, per scene: a key of both cores with two hashes, or a key of one core that the
// other build never drew (a key transient in the other build is not compared); n: the keys compared
function diff(A, B) {
  const d = {};
  let n = 0;
  for (const sc of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const a = A[sc] || { core: {}, transient: [] }, b = B[sc] || { core: {}, transient: [] };
    for (const k of new Set([...Object.keys(a.core), ...Object.keys(b.core)])) {
      if ((!a.core[k] && a.transient.includes(k)) || (!b.core[k] && b.transient.includes(k))) continue;
      n++;
      if (!a.core[k] || !b.core[k] || a.core[k].h !== b.core[k].h) (d[sc] = d[sc] || []).push(k + (a.core[k] && b.core[k] ? '' : a.core[k] ? ' (first only)' : ' (second only)'));
    }
  }
  return { n, d };
}

(async () => {
  let code = 0;
  try {
    const A = await record('base', tree('base', BASE));
    const B = await record('head', tree('head', null));
    const C = argv.includes('--no-control') ? null : await record('control', tree('control', null, { 'src/gl/02-glsl-inverse.js': CONTROL }));
    const errors = Object.entries(A).concat(Object.entries(B)).filter(([, r]) => r.error).map(([k, r]) => `${k}: ${r.error}`);
    const ab = diff(A, B);
    const inv = Object.keys(B).reduce((s, sc) => s + Object.keys(B[sc].core).filter((k) => k.startsWith('inv|') && A[sc] && A[sc].core[k]).length, 0);
    console.log(`A/B: ${ab.n} records compared (${inv} of them inverse draws read back as float32), ${Object.values(ab.d).flat().length} differ`);
    for (const [sc, ks] of Object.entries(ab.d)) console.log(`  ${sc}: ${ks.slice(0, 8).join('; ')}${ks.length > 8 ? ` (+${ks.length - 8})` : ''}`);
    const transient = Object.keys(B).map((sc) => `${sc} ${(A[sc] || { transient: [] }).transient.length}/${B[sc].transient.length}`).join(', ');
    console.log(`transient keys, base/head: ${transient}`);
    if (errors.length) console.log(`hook errors: ${errors.join('; ')}`);
    let ctrl = null;
    if (C) {
      ctrl = diff(A, C);
      console.log(`control: ${Object.values(ctrl.d).flat().length} of ${ctrl.n} records differ from the base, in ${Object.keys(ctrl.d).length} of ${Object.keys(A).length} scenes (${Object.keys(ctrl.d).join(', ') || 'none'})`);
    }
    if (Object.keys(ab.d).length || !ab.n || !inv || errors.length || (ctrl && !Object.keys(ctrl.d).length)) code = 1;
    console.log(code ? 'FAIL' : ctrl ? 'PASS: 0 differing bits, and the control is seen' : 'PASS: 0 differing bits (no control run)');
  } catch (e) {
    console.log('FAIL ' + (e && e.stack || e));
    code = 1;
  } finally {
    if (!argv.includes('--keep')) fs.rmSync(work, { recursive: true, force: true });
    else console.log(`kept: ${work}`);
  }
  process.exit(code);
})();
