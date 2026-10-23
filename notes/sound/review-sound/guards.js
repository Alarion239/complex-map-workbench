await ev(`localStorage.removeItem('cmw-sound'); 1`);
await nav('file://<project>/notes/sound/prototype.html');
await clickSel('#sndBtn'); await sleep(400);
const st = await ev(`__snd.Sound.state()`);
await ev(`__snd.Sound.set({sonify: true}, {quiet: true}); 1`); await sleep(300);
// a drag step that adds 2.3 turns in one pointer event (fast motion near a zero): turnBells rings while phi >= k+1
const turns = await ev(`(() => { const L = {phi: 0, k: 0}, r = []; L.phi = 2.3; while (L.phi >= L.k + 1) { L.k++; r.push(__snd.Sound.play('turn', {dir: 1})); } return r; })()`);
await sleep(300);
// five turns over 0.3 s, as in a quick circle around an order-5 zero (one per 60 ms)
const quick = await ev(`await (async () => { const r = []; for (let i = 0; i < 5; i++) { r.push(__snd.Sound.play('turn', {dir: 1})); await new Promise(f => setTimeout(f, 60)); } return r; })()`);
await sleep(500);
// zero pings are forced: no gap, no storm guard (20 zeros entered within 1 s, e.g. zeros accumulating at an essential singularity)
const zeros = await ev(`await (async () => { let n = 0; for (let i = 0; i < 20; i++) { if (__snd.Sound.play('zero', {order: 1, force: true})) n++; await new Promise(f => setTimeout(f, 40)); } return n; })()`);
await sleep(800);
await clickSel('#sndBtn'); await sleep(500);
return { st, turnsOneEvent: turns, quickFiveTurns: quick, forcedZerosPlayedOf20: zeros, logs: logs() };
