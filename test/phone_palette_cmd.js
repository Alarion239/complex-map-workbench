// [#464] The function palette (Add a function, Insert, Replace) rises from below on a phone but stops above the chain bar, so
// the chain it adds to stays in sight (it covered the chain and the tool row to the screen's foot); with the on-screen keyboard
// up (Phone._kb) it stops above the keyboard too, its search field in view under the header. Portrait 390 x 844 and
// 360 x 640, a phone sideways 740 x 360 and 915 x 412; the default view and ?view=steps (its strip is the chain bar).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const ST = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'power', params: { n: '2' }, on: true }] };
const waitPh = async () => { for (let i = 0; i < 40; i++) { if (await ev(`document.documentElement.classList.contains('ph')`)) break; await sleep(250); } await settle(900); };
const geo = () => ev(`(() => { const sv = document.documentElement.classList.contains('sv'), c = document.querySelector(sv ? '#svStrip' : '.pipe-wrap'), p = document.querySelector('.pop.palette'), i = document.querySelector('.pal-input');
  if (!p || !c) return null; const q = p.getBoundingClientRect(), cr = c.getBoundingClientRect(), ir = i.getBoundingClientRect(), hd = document.querySelector('.top').getBoundingClientRect();
  return { pal: [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)], chain: [Math.round(cr.left), Math.round(cr.top), Math.round(cr.right), Math.round(cr.bottom)], input: [Math.round(ir.top), Math.round(ir.bottom)], head: Math.round(hd.bottom), vh: innerHeight, focus: document.activeElement === i }; })()`);
for (const [w, h, kbh] of [[390, 844, 320], [360, 640, 280], [740, 360, 150], [915, 412, 150]]) {
  for (const v of ['', '&view=steps']) {
    await view(w, h, false, true); await load('pp' + w + v.length + '-' + Date.now(), ST);
    if (v) await send('Page.navigate', { url: `${U}?ns=pps${w}-${Date.now()}${v}` });
    await waitPh();
    const tag = `${w}×${h}${v ? ' steps' : ''}`;
    const opened = await ev(`(() => { const b = document.querySelector(document.documentElement.classList.contains('sv') ? '#svStrip .sv-add' : '#addStepBtn, .add-card'); if (!b) return 'none'; b.click(); return 'ok'; })()`);
    if (v && opened === 'none') { info[tag] = 'the steps view has no add button yet (#469)'; continue; }
    ok(`${tag}: the add button opens the palette`, opened === 'ok', opened);
    await settle(1000);
    const g = await geo(); info[tag] = g;
    ok(`${tag}: the palette is there with its search field focused`, g && g.focus, g);
    if (!g) continue;
    ok(`${tag}: it ends above the chain bar (does not cover it)`, g.pal[3] <= g.chain[1] + 1, g);
    ok(`${tag}: it starts under the header`, g.pal[1] >= g.head - 1, g);
    await ev(`Phone._kb(${kbh}), 1`); await settle(700);
    const k = await geo(); info[tag + ' kb'] = k;
    ok(`${tag} with the keyboard (${kbh} px): it ends above the keyboard, its search field in view`, k && k.pal[3] <= h - kbh + 1 && k.input[0] >= k.head - 1 && k.input[1] <= k.pal[3], k);
    await ev(`Phone._kb(0), 1`); await key('Escape'); await settle(400);
  }
}
return { pass: fails.length === 0, fails, info };
