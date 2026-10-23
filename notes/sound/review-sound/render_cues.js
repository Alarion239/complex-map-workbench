await nav('file://<project>/notes/sound/prototype.html');
for (let i = 0; i < 150; i++) { const r = await ev('!!(window.__snd && __snd.LAB.done)'); if (r === true) break; await sleep(200); }
const lab = await ev('({rows: __snd.LAB.rows.map(r => ({n: r.name, len: r.len, peak: r.peak, rms: r.rms, end: r.end, hf: r.hf, ok: r.ok})), shep: __snd.LAB.shep, err: __snd.LAB.error || null})');
// helper in page: render and return base64 of interleaved float32
await ev(`window.__b64 = (buf) => { const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, a = new Float32Array(2 * n); for (let i = 0; i < n; i++) { a[2*i] = L[i]; a[2*i+1] = R[i]; } const u = new Uint8Array(a.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }; 1`);
const variants = await ev(`Object.entries(__snd.Sound.CATALOG).flatMap(([name, d]) => (name === 'zero' ? [{order:1},{order:2},{order:3}] : name === 'pole' ? [{order:1},{order:2}] : name === 'turn' ? [{dir:1},{dir:-1}] : name === 'morphTick' ? [{t:0},{t:0.5},{t:1}] : name === 'view' ? [{k:0},{k:1},{k:2}] : name === 'contour' ? [{k:-6},{k:0},{k:3},{k:8}] : [{}]).map(o => ({name, o})))`);
const out = [];
for (const v of variants) {
  for (const mode of ['full', 'dry', 'pan']) {
    const b64 = await ev(`await (async () => { const d = __snd.Sound.CATALOG[${JSON.stringify(v.name)}]; const o = Object.assign({}, ${JSON.stringify(v.o)}); if (${JSON.stringify(mode)} === 'pan') o.pan = 0.001; const buf = await __snd.Sound.render((G, t) => { if (${JSON.stringify(mode)} === 'dry') G.tier[d.tier].wet.gain.value = 0; d.make(G, t, o); }, 2.4, { noClip: true }); return __b64(buf); })()`);
    const f = `${v.name}_${Object.entries(v.o).map(([k, x]) => k + x).join('_') || 'x'}_${mode}.f32`;
    fs.writeFileSync(path.join(DIR, '..', 'wav', f), Buffer.from(b64, 'base64'));
    out.push(f);
  }
}
return { lab, files: out.length, logs: logs() };
