// The steps view's pane header names the plane the thread is nearest to while it is held between two planes: the header turns over at the
// half of the glide, as the picture does, not on arrival. The thread is held (a scrub on the rail, not let go: test/lib/held_frames.js's
// hold) at x = 0.25, 0.75, 1.25 and 1.75 on the default chain (z, w₁, w₂); the header's name is the nearest plane's. The header
// is read again once the thread is let go on a plane, so the suite cannot pass on a header that never changes.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
await view(1440, 900, false, false);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=headglide${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && __cmwSteps().planes && __cmwSteps().planes.length === 3' });
const { hold } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const NAME = [/^z\b/, /^w\s*1/, /^w\s*2/];
const head = () => ev(`(document.querySelector('.sv-title') || {}).textContent || ''`);
// (read the header at rest on each plane first: its name is what a held frame near that plane is compared with)
for (const x of [0.25, 0.75, 1.25, 1.75]) {
  const near = Math.round(x);
  const r = await hold(x, false);
  ok(`x = ${x}: the thread is held there`, r && r.ok !== false, r);
  await settled({ max: 8000, only: true, until: `(document.querySelector('.sv-title') || {}).textContent !== undefined` });
  const t = info[`x ${x}`] = await head();
  const cp = await ev(`(document.querySelector('.sv-cp') || {}).textContent || ''`);
  info[`cp ${x}`] = cp;
  ok(`x = ${x}: the colour button reads for the nearest plane (the colour plane is w₂)`, near === 2 ? /Colour plane/.test(cp) : /Colour from here/.test(cp), cp);
  ok(`x = ${x}: the header names the nearest plane (${['z', 'w₁', 'w₂'][near]})`, NAME[near].test(t), t);
  await ev('window.__svScrubUp(), 1');
  await ev(`__cmwSteps({ go: 0, now: true }); 1`);
  await settled({ max: 20000, only: true, until: `!__cmwSteps().moving` });
}
ok('at rest on z the header names z', NAME[0].test(await head()), await head());
return { pass: fails.length === 0, fails, info };
