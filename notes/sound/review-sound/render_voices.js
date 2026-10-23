const W = async (name, body, dur) => {
  const b64 = await ev(`await (async () => { const S = __snd.Sound; const buf = await S.render((G, t, c) => { ${body} }, ${dur}, { noClip: true }); return __b64(buf); })()`);
  if (typeof b64 !== 'string') return name + ': ' + JSON.stringify(b64);
  fs.writeFileSync(path.join(DIR, '..', 'wav', name + '.f32'), Buffer.from(b64, 'base64')); return name;
};
const res = [];
// S1: live voice at fixed ln|F|, rising 0.5 turn/s for 3 s, 60 Hz updates
for (const la of [-8, -4, -2, -1, 0, 1, 2, 4, 8]) res.push(await W('voice_la' + la, `const v = S.ShepardVoice(G); v.set(0, ${la}, 0, 0.1); v.gate(true, 0.1, 0.02); for (let s = 0.1 + 1/60; s <= 3.1; s += 1/60) v.set(0.5 * (s - 0.1), ${la}, 0, s); v.gate(false, 3.1, 0.05); v.stop(3.5);`, 3.6));
// S2: listen-along buffer, constant ln|F| = 0, rising 0.5 turn/s for 3 s, routed exactly as Sound.curve does (out(G,'sonify',0,0.1))
res.push(await W('curve_la0', `const M = 900, phi = new Float64Array(M), la = new Float64Array(M); for (let j = 0; j < M; j++) phi[j] = 1.5 * j / (M - 1); const s = c.createBufferSource(); s.buffer = S.curveBuffer(c, phi, la, 3); const send = c.createGain(); send.gain.value = 0.1; s.connect(G.tier.sonify.dry); s.connect(send); send.connect(G.tier.sonify.wet); s.start(0.1);`, 3.6));
// S3: the live voice (ln|F| = 0, panned 0.3) with a turn bell up at 1.5 s, as during a drag
res.push(await W('voice_bell', `const v = S.ShepardVoice(G); v.set(0, 0, 0.3, 0.1); v.gate(true, 0.1, 0.02); for (let s = 0.1 + 1/60; s <= 3.1; s += 1/60) v.set(0.5 * (s - 0.1), 0, 0.3, s); v.gate(false, 3.1, 0.05); v.stop(3.5); S.CATALOG.turn.make(G, 1.5, {dir: 1, pan: 0.3});`, 3.6));
res.push(await W('voice_only_ref', `const v = S.ShepardVoice(G); v.set(0, 0, 0.3, 0.1); v.gate(true, 0.1, 0.02); for (let s = 0.1 + 1/60; s <= 3.1; s += 1/60) v.set(0.5 * (s - 0.1), 0, 0.3, s); v.gate(false, 3.1, 0.05); v.stop(3.5);`, 3.6));
// S4: the glide model on one oscillator (1 kHz), 60 Hz updates, three pitch speeds: the engine's cancelAndHold + setTarget(τ = 12 ms)
for (const rate of [1, 4, 12]) {
  res.push(await W('glide_tau_' + rate, `const o = c.createOscillator(), g = c.createGain(); g.gain.value = 0.25; o.frequency.value = 500; o.connect(g); g.connect(G.master); o.start(0); for (let s = 0.1; s <= 2.1; s += 1/60) { o.detune.cancelAndHoldAtTime(s); o.detune.setTargetAtTime(1200 * ${rate} * 0.25 * (s - 0.1) % 2400, s, 0.012); } o.stop(2.3);`, 2.4));
  res.push(await W('glide_lin_' + rate, `const o = c.createOscillator(), g = c.createGain(); g.gain.value = 0.25; o.frequency.value = 500; o.connect(g); g.connect(G.master); o.start(0); for (let s = 0.1; s <= 2.1; s += 1/60) { o.detune.cancelAndHoldAtTime(s); o.detune.linearRampToValueAtTime(1200 * ${rate} * 0.25 * (s - 0.1) % 2400, s + 1/60); } o.stop(2.3);`, 2.4));
}
// S5: height voice through a sweep of ln|F| from -6 to 6 over 4 s
res.push(await W('height_sweep', `const v = S.HeightVoice(G); v.set(-6, 0, 0.1); v.gate(true, 0.1, 0.02); for (let s = 0.1; s <= 4.1; s += 1/60) v.set(-6 + 3 * (s - 0.1), 0, s); v.gate(false, 4.1, 0.05); v.stop(4.5);`, 4.6));
return { res, logs: logs() };
