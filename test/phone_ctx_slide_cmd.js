// [#463] Selecting a shape on a phone: the chain bar (the function overlay) and the planes stay exactly where they are and
// fully opaque through select and release, and the shape's bar slides up from behind the chain bar to sit above it (it
// used to push the chain bar up 56 px at once and show itself where the chain bar had been). Under prefers-reduced-motion
// the slide has no duration. Portrait 390 x 844 and 360 x 640, the default view and ?view=steps (its strip is the chain bar).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const ST = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }, { id: 's2', kind: 'rect', a: [-2, -1], b: [1, 0.5] }], steps: [{ type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }] };
const waitPh = async () => { for (let i = 0; i < 40; i++) { if (await ev(`document.documentElement.classList.contains('ph')`)) break; await sleep(250); } await settle(900); };
for (const [w, h] of [[390, 844], [360, 640]]) {
  for (const v of ['', '&view=steps']) {
    await view(w, h, false, true); await load('pcs' + w + v.length + '-' + Date.now(), ST);
    if (v) await send('Page.navigate', { url: `${U}?ns=pcs${w}x-${Date.now()}${v}` });
    await waitPh();
    const tag = `${w}×${h}${v ? ' steps' : ''}`;
    // (the sampler runs in the page every 25 ms: the chain bar's (or the strip's) top, its opacity, the plane's height, the bar's top)
    await ev(`(() => { const chain = () => document.querySelector(document.documentElement.classList.contains('sv') ? '#svStrip' : '.pipe-wrap');
      window.__cs = []; const t0 = performance.now();
      window.__civ = setInterval(() => { const c = chain().getBoundingClientRect(), p = document.getElementById('paneL').getBoundingClientRect(), x = document.querySelector('.ph-ctx'), q = x && !x.hidden ? x.getBoundingClientRect() : null;
        window.__cs.push({ t: Math.round(performance.now() - t0), ct: Math.round(c.top), co: +getComputedStyle(chain()).opacity, ph: Math.round(p.height), bt: q ? Math.round(q.top) : null, bo: q ? +getComputedStyle(x).opacity : null }); }, 25); return 1; })()`);
    await sleep(300);
    await ev(`__cmwSelect('s1'), 1`); await sleep(900);
    await ev(`__cmwSelect('s2'), 1`); await sleep(500);
    await ev(`__cmwSelect(null), 1`); await sleep(700);
    const cs = await ev(`clearInterval(window.__civ), window.__cs`);
    const ct0 = cs[0].ct, ph0 = cs[0].ph;
    const moved = cs.filter((x) => x.ct !== ct0 || x.ph !== ph0 || x.co !== 1);
    ok(`${tag}: the chain bar and the planes stay put, fully opaque, through select, re-select and release`, !moved.length, moved.slice(0, 3));
    const bs = cs.filter((x) => x.bt !== null);
    ok(`${tag}: the shape's bar was seen`, bs.length >= 5, bs.length);
    const top = Math.min(...bs.map((x) => x.bt));
    ok(`${tag}: the bar ends directly above the chain bar`, top === ct0 - 56, { ct0, top });
    ok(`${tag}: the bar starts behind the chain bar (its top never below the chain bar's top plus its own height)`, bs.every((x) => x.bt <= ct0 + 1), bs[0]);
    // (it only ever moves up while it comes in)
    const up = bs.slice(0, bs.findIndex((x) => x.bt === ct0 - 56) + 1);
    ok(`${tag}: it slides up (no step back down)`, up.every((x, i) => !i || x.bt <= up[i - 1].bt), up.map((x) => x.bt));
    info[tag] = { ct0, ph0, seen: bs.length };
  }
}
// reduced motion: no slide
await view(390, 844, false, true); await load('pcsrm-' + Date.now(), ST); await waitPh();
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await ev(`__cmwSelect('s1'), 1`); await settle(500);
const rm = await ev(`(() => { const x = document.querySelector('.ph-ctx'); const c = getComputedStyle(x); return { dur: c.transitionDuration, shown: !x.hidden }; })()`);
ok('reduced motion: the bar has no transition', rm.shown && /^(0s,? ?)+$/.test(rm.dur), rm);
await send('Emulation.setEmulatedMedia', { features: [] });
return { pass: fails.length === 0, fails, info };
