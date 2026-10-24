// body: scenes from SCENES_FILE; returns per-scene measurements
const scenes = JSON.parse(fs.readFileSync(SCENES_FILE, 'utf8'));
const out = {};
const shapes = [{ id: 's1', kind: 'rect', a: [-1.5, -1.2], b: [1.5, 1.2] }, { id: 's2', kind: 'cgrid', a: [-1.5, -1.2], b: [1.5, 1.2], n: 6 }];
await view(1440, 900, false);
for (const sc of scenes) {
  const r = { id: sc.id };
  try {
    await load('fr' + sc.id.replace(/\W/g, '') + Date.now(), Object.assign({ shapes: sc.shapes || shapes, steps: sc.steps, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 } }, sc.params ? { params: sc.params } : {}));
    await sleep(900);
    r.cards = await ev('__qa.cards()');
    r.lamps = await ev('__qa.lamps()');
    r.paths = await ev('__cmwPaths().map((p) => p.role + p.id + ":" + p.path + (p.reason ? "(" + p.reason + ")" : "")).join(" ")');
    r.time = await ev('(() => { const t = __cmwTime(5); return { L: t.left, R: t.right }; })()');
    const v = await ev("__cmwPlaneMenu().view('R')");
    const c = await ev(`__cmwPlaneMenu().w2s('R', ${v.cx}, ${v.cy})`);
    await ev('window.__frP = __qa.frames(1300); 1');
    await drag(c[0] - 140, c[1] - 40, c[0] + 140, c[1] + 50, 70, 16);
    r.pan = await ev('await window.__frP', 30000);
    const t0 = Date.now();
    for (let i = 0; i < 100; i++) { const s = await ev('(() => { const s = __cmwSphere(); return s.running || s.jobs.length ? 1 : 0; })()'); if (!s) break; await sleep(50); }
    r.settleMs = Date.now() - t0;
    r.pathsAfterPan = await ev('__cmwPaths().map((p) => p.role + p.id + ":" + p.path).join(" ")');
    r.sm = await ev('(() => { const s = __cmwSphere(); return { entries: s.entries.length, built: s.stats.built, ms: Math.round(s.stats.ms) }; })()');
    if (sc.params) {
      const a0 = sc.params[0].value, amp = sc.amp || 0.3;
      r.param = await ev(`await (async () => { const fr = __qa.frames(1300); const t0 = performance.now(); await new Promise((res) => { const f = () => { const u = (performance.now() - t0) / 1300; Params.set('a', ${a0} + ${amp} * Math.sin(u * 2 * Math.PI)); if (u < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); return await fr; })()`, 30000);
      const t1 = Date.now();
      for (let i = 0; i < 100; i++) { const s = await ev('(() => { const s = __cmwSphere(); return s.running || s.jobs.length ? 1 : 0; })()'); if (!s) break; await sleep(50); }
      r.paramSettleMs = Date.now() - t1;
    }
    if (!sc.noMorph) {
      await ev('__cmwMorph({ open: true, T: 0.5, playing: false })'); await sleep(900);
      r.morphTime = await ev('(() => { const t = __cmwTime(3); return t.right; })()');
      r.morphPaths = await ev('__cmwPaths().map((p) => p.role + p.id + ":" + p.path).join(" ")');
      if (sc.shotMorph) r.shot = await shot('morph_' + sc.id);
      await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(200);
      r.morph = await ev('await (async () => await __qa.frames(1500))()', 30000);
      await ev('__cmwMorph({ playing: false, open: false })'); await sleep(200);
    }
    if (sc.shot) r.shot = await shot(sc.id);
    const lg = logs().filter((x) => x.t === 'EXC' || x.t === 'error');
    if (lg.length) r.errors = lg.slice(0, 3);
  } catch (e) { r.err = String(e && e.stack || e).slice(0, 400); }
  out[sc.id] = r;
}
return out;
