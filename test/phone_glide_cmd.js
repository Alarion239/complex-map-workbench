// ‹ › on a phone's chain glide Y's picture between the planes with no transport (issue #362): the deformation does not
// open, its dock and the merged layout do not appear, the X and Y panes keep their rects during and after, Y's picture
// moves while it glides and rests on the plane after the step, the chain row names that step, and ‹ › past the last step
// (or a change to the chain, or the Deformation button) end the glide. 390 x 844 with touch, Y large so its picture shows.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
// (a picture's FNV-1a hash: the suite has no require)
const fnv = (b) => { let h = 0x811c9dc5; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
const ns = 'pg' + Date.now();
await view(390, 844, false, true);
await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'k1', kind: 'disc', c: [0.3, 0], r: 0.6, ci: 0, visible: true }],
  steps: [{ type: 'affine', params: { a: '1', b: '0.5' }, on: true }, { type: 'sin', params: {}, on: true }, { type: 'exp', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en` }); await sleep(3000); await settle(500);
ok('the phone layout', await ev('!!Phone._state().on'), null);
// (Y large: the swap button of the inset)
await ev(`(document.querySelector('.ph-swap') || document.querySelector('[class*="swap"]') || { click() {} }).click(); 1`); await settle(800);
// (the spring's tail: until it rests)
const rest = async () => { for (let i = 0; i < 60; i++) { if (!(await ev('__cmwGlide().moving'))) return; await sleep(100); } };
const layout = () => ev(`(() => { const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round).join(','); };
  const dock = document.querySelector('.tdock');
  return { L: r('paneL'), R: r('paneR'), cls: [...document.documentElement.classList].filter((c) => /^ph-(morph|one)|merged/.test(c)).join(' ') + [...document.getElementById('panes').classList].filter((c) => /merged|ph-one/.test(c)).join(' '),
    dock: !!dock && dock.getClientRects().length > 0, chip: (document.querySelector('.ph-cchip') || {}).textContent, g: __cmwGlide() }; })()`);
const clip = await ev(`(() => { const b = document.getElementById('paneR').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height, scale: 1 }; })()`);
const hash = async (name) => { await shot(name, clip); return fnv(fs.readFileSync(`${DIR}/shots/${name}.png`)); };
const base = await layout();
const hF = await hash('pg_F');
ok('at rest: F, no glide', base.g.peek === false && base.g.open === false && /Exponential/.test(base.chip), base);
// ‹: the glide
await ev('__cmwGlide(-1)');
const seen = new Set(), lays = [];
for (let i = 0; i < 12; i++) { await sleep(110); const l = await layout(); lays.push(l); seen.add(await hash('pg_s' + (i % 3))); }
ok('the deformation never opens while it glides', lays.every((l) => l.g.open === false), lays.map((l) => l.g.open));
ok('the panes keep their rects and the layout while it glides', lays.every((l) => l.L === base.L && l.R === base.R && l.cls === base.cls && !l.dock), { base, bad: lays.find((l) => l.L !== base.L || l.R !== base.R || l.cls !== base.cls || l.dock) });
ok('Y\'s picture moves while it glides', seen.size >= 3, seen.size);
await rest(); await settle(300);
const p1 = await layout(), h1 = await hash('pg_p1');
ok('it rests on the plane after step 2, the chain row naming Sine', p1.g.peek === true && p1.g.moving === false && Math.abs(p1.g.x - 2) < 1e-6 && /Sine/.test(p1.chip), p1);
ok('its picture is not F\'s', h1 !== hF, null);
ok('still no deformation, no layout change at rest', p1.g.open === false && p1.L === base.L && p1.R === base.R && !p1.dock && p1.cls === base.cls, p1);
// ‹ again, then › twice: back to F, the glide over
await ev('__cmwGlide(-1)'); await rest(); await settle(300);
const p2 = await layout();
ok('‹ again: the plane after step 1', Math.abs(p2.g.x - 1) < 1e-6 && /Affine/.test(p2.chip) && p2.g.peek, p2);
await ev('__cmwGlide(1)'); await ev('__cmwGlide(1)'); await rest(); await settle(600);
const p3 = await layout(), h3 = await hash('pg_back');
ok('› to the end: F again, the glide over', p3.g.peek === false && p3.g.at === -1 && /Exponential/.test(p3.chip) && p3.g.open === false, p3);
ok('… and Y shows F\'s picture', h3 === hF, [h3, hF]);
// a change to the chain ends it
await ev('__cmwGlide(-1)'); await rest(); await settle(300);
ok('parked again', (await layout()).g.peek === true, null);
// (a step bypassed from its card: a change of the chain)
await ev(`document.querySelector('#pipeline .card .bypass').click(); 1`); await settle(700);
const ch = await layout();
ok('a change to the chain ends the glide', ch.g.peek === false && ch.g.at === -1 && ch.g.open === false, ch.g);
await ev(`document.querySelector('#pipeline .card .bypass').click(); 1`); await settle(700);
// the Deformation button opens the inspectable version, paused at the step Y is on, and ends the glide
await ev('__cmwGlide(-1)'); await rest(); await settle(300);
ok('parked once more', (await layout()).g.peek === true, null);
await ev(`document.getElementById('morphBtn').click(); 1`); await settle(900);
const d = await layout();
ok('the Deformation button opens the transport at the parked step, paused, and ends the glide', d.g.open === true && d.g.peek === false && Math.abs(d.g.T - 2) < 1e-6 && d.g.playing === false, d.g);
// a tap on Y ends the glide (a pan does not)
await ev(`document.getElementById('morphBtn').click(); 1`); await settle(700);
ok('the transport closed again', (await layout()).g.open === false, null);
await ev('__cmwGlide(-1)'); await rest(); await settle(300);
const rc = await ev(`(() => { const b = document.getElementById('paneR').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
await drag(rc.x, rc.y, rc.x + 40, rc.y + 10, 6, 15); await settle(300);
ok('a pan of Y keeps the glide parked', (await layout()).g.peek === true, (await layout()).g);
await click(rc.x, rc.y); await settle(500);
ok('a tap on Y ends the glide', (await layout()).g.peek === false, (await layout()).g);
return { pass: fails.length === 0, fails, info };
