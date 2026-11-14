// The sound suites' shared page helpers: the pointer and the loops, the engine's note counts and the spy on the sound catalogue.
// Used by a command file for a CDP daemon:
//   const { W, snd, circle, spy, made, hearInject, start, harpLoop } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'sound_kit.js'), 'utf8'))({ ev, send, move, click, settled, loadHere, settle, glide, ns, fn });
// W(re, im) is the screen point of a plane point; circle(c, r, turns, n, a0) a pointer loop's points (a0 = 0.4: where it starts);
// spy() wraps every sound in the catalogue and made() reads the names made since the last call; hearInject() puts __hearCount() on
// every new page; start(expr) loads the function, turns sound on and spies; harpLoop(c, r, laps) is a loop's turn and notes.
({ ev, send, move, click, settled, loadHere, settle, glide, ns, fn }) => {
  const W = (re, im) => ev(`__cmwW2S('L', ${re}, ${im})`);
  const snd = () => ev('__cmwSound()');
  const circle = async (c, r, turns = 1, n = 48, a0 = 0.4) => { const out = []; for (let i = 0; i <= n * turns; i++) { const a = a0 + 2 * Math.PI * i / n; out.push(await W(c[0] + r * Math.cos(a), c[1] + r * Math.sin(a))); } return out; };
  const spy = () => ev(`(() => { window.__made = []; for (const [k, d] of Object.entries(Sound.CATALOG)) { if (d.__spy) continue; const m = d.make; d.make = (Pt, o) => { __made.push(k); return m(Pt, o); }; d.__spy = 1; } return 1; })()`);
  const made = () => ev(`(() => { const m = __made.slice(); __made.length = 0; return m; })()`);
  // (the engine's Sound.hear.state().counts run since load; __hearCount() reads them as __hearCount() did, since
  // its last call: up and down the red line's crossings (line k ≡ 0 mod n, the low D), notes the notes played, merged
  // the crossings merged into one note, cracks the cuts; as sound_cmd.js's hearCount)
  const hearInject = () => send('Page.addScriptToEvaluateOnNewDocument', { source: '(() => { window.__hearCount = () => { const c = Sound.hear.state().counts, p = window.__hc0 || { dUp: 0, dDown: 0, notes: 0, merged: 0, cracks: 0 }; window.__hc0 = { dUp: c.dUp, dDown: c.dDown, notes: c.notes, merged: c.merged, cracks: c.cracks }; return { up: c.dUp - p.dUp, down: c.dDown - p.dDown, notes: c.notes - p.notes, merged: c.merged - p.merged, cracks: c.cracks - p.cracks }; }; })();' });
  const start = async (expr) => {
    await loadHere(ns, fn(expr));
    await ev(`__cmwSetMain('phase')`); await settle();
    await click(5, 300); await settle();
    await ev(`Sound.set({ on: true, vol: 0.7, ui: true, events: true, sonify: true }, { quiet: true }); 1`);
    await settled({ until: `Sound.state().audio === 'running'`, max: 4000, panes: false });
    await ev(`__cmwSet('loop', false); 1`);
    await spy();
  };
  // a pointer loop round c (radius r, laps), the notes' count over it
  const harpLoop = async (c, r, laps = 1) => {
    const pts = await circle(c, r, laps, 64);
    await move(pts[0][0], pts[0][1]); await settle();
    const phi0 = (await snd()).phi; await ev('__hearCount()');
    await glide(pts); await settle();
    return { dphi: +((await snd()).phi - phi0).toFixed(6), harp: await ev('__hearCount()') };
  };
  return { W, snd, circle, spy, made, hearInject, start, harpLoop };
}
