await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(path.join(DIR, '../rec_inj.js'), 'utf8') });
await nav('http://127.0.0.1:9053/notes/sound/v2/board.html?v=' + Date.now()); await sleep(400);
await view(1200, 1000, false);
await click(600, 200); await sleep(1200);
await ev(fs.readFileSync(path.join(DIR, '../drive.js'), 'utf8') + '; 1');
await ev(`__board.setFn('rat'); 1`);
const res = {};
for (const pal of ['A', 'B']) {
  await ev(`__board.setPal('${pal}'); 1`); await sleep(300);
  for (const sc of ['scrub', 'hover', 'ui']) {
    const ctxExpr = pal === 'A' ? 'Sound.debug().ctx' : 'SoundB.ctx()';
    await ev(`const c__ = ${ctxExpr}; if (c__.state !== 'running') await c__.resume(); await __rec.start(c__); 1`, 20000); await sleep(200);
    const blog0 = await ev(`SoundB.engine() ? SoundB.engine().log.length : 0`);
    await ev(`await __drive.${sc}(${sc === 'scrub' ? 8 : 7}); 1`, 60000); await sleep(1200);
    const r = await ev(`await __rec.stop()`, 60000);
    const meta = await ev(`const st__ = SoundB.engine() ? await SoundB.engine().stat() : null; ({ starts: __rec.onsets(), blog: SoundB.engine() ? SoundB.engine().log.slice(${blog0}) : [], stat: st__ })`, 20000);
    const name = `live_${pal}_${sc}`;
    fs.writeFileSync(path.join(DIR, '../rec', name + '.f32'), Buffer.from(r.b64, 'base64'));
    fs.writeFileSync(path.join(DIR, '../rec', name + '.json'), JSON.stringify({ f0: r.f0, fs: r.fs, pal, late: r.late, lateList: r.lateList, onsets: pal === 'A' ? meta.starts : meta.blog.flatMap((b) => b[2].map((d) => b[1] + d)), cues: meta.blog.map((b) => b[0]), stat: meta.stat }));
    res[name] = { secs: (Buffer.from(r.b64, 'base64').length / 8 / r.fs).toFixed(2), late: r.late, lateList: r.lateList, onsets: pal === 'A' ? meta.starts.length : meta.blog.length, stat: meta.stat };
  }
}
return { res, logs: logs() };
