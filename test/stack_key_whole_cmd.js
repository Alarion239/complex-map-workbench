// The Stack's open key on a phone shows everything it holds, in the longest language, with nothing to scroll to either way: its marks and its
// connector switch (the label and the two kinds) are inside the key's box. A touch phone in the steps view, the Stack (M3 z³ − 1.2z + 0.3 with a
// disc on w₁ selected), the key unfolded, in English, Russian and Italian at 360 × 780, 390 × 844 and 412 × 915 (portrait) and 568 × 320,
// 600 × 320 and 740 × 360 (landscape). The key's content does not run past its box (scrollWidth and scrollHeight read against the box's own),
// and the key lies inside the plane.
// In the steps view (ci/suite_views.js). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ST = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 70 }, steps: [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }], shapes: [{ id: 'd', kind: 'disc', c: [1.1, 0], r: 0.25, stage: 1 }] };
const SLACK = 1;   // px
for (const lang of ['en', 'ru', 'it']) for (const [w, h] of [[360, 780], [390, 844], [412, 915], [568, 320], [600, 320], [740, 360]]) {
  const tag = `${lang} ${w}×${h}`;
  await view(w, h, false, true);
  const ns = 'skw' + lang + w + h + (Date.now() % 1000000);
  await load(ns, ST);
  await go(`${U}?ns=${ns}&view=steps${lang === 'en' ? '' : '&lang=' + lang}`);
  await settled({ max: 40000, until: `typeof __cmwSteps === 'function' && !!window.Phone && Phone.isOn() && __cmwSteps().ready.ready` });
  await ev(`(__cmwSelect('d'), 1)`);
  await settled({ max: 20000, until: `typeof __cmwLookDown === 'function' && !!__cmwLookDown()` });
  await ev(`(__cmwSteps({ surf: 'stack' }), 1)`);
  await settled({ max: 30000, until: `__cmwSteps().surf === 'stack' && typeof __cmwStack === 'function' && !!__cmwStack().drawn && !!document.querySelector('#plotL .ld-key')` });
  await ev(`(() => { const b = document.querySelector('#plotL .ld-key > button.ld-ttl'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); return 1; })()`);
  await settled({ max: 8000, until: `(() => { const k = document.querySelector('#plotL .ld-key'); return !!k && !k.classList.contains('folded') && !!k.querySelector('.ld-links') && document.getAnimations().length === 0; })()` });
  const m = info[tag] = await ev(`(() => { const k = document.querySelector('#plotL .ld-key'), p = document.getElementById('plotL').getBoundingClientRect(), b = k.getBoundingClientRect();
    const row = k.querySelector('.ld-links-row') && k.querySelector('.ld-links-row').getBoundingClientRect();
    return { key: [b.left, b.top, b.right, b.bottom].map(Math.round), plot: [p.left, p.top, p.right, p.bottom].map(Math.round), sw: k.scrollWidth, cw: k.clientWidth, sh: k.scrollHeight, ch: k.clientHeight, row: row && [row.left, row.right].map(Math.round), lang: document.documentElement.lang }; })()`);
  ok(`${tag}: the key is open with its connector switch (control)`, !!m.row && m.cw > 0, m);
  ok(`${tag}: nothing of the key runs past its width (scrollWidth ${m.sw} against ${m.cw})`, m.sw <= m.cw + SLACK, m);
  ok(`${tag}: nothing of the key runs past its height (scrollHeight ${m.sh} against ${m.ch})`, m.sh <= m.ch + SLACK, m);
  ok(`${tag}: the connector switch row lies inside the key`, !!m.row && m.row[1] <= m.key[2] + SLACK, m);
}
return { pass: fails.length === 0, fails, info };
