// The steps view's names (#435, part of #366), behind ?view=steps: on "Cayley, then cube" (w₁ = f₁(z) a Möbius map,
// w₂ = f₂(w₁) = w₁³), for the colour plane T = z, w₁ and w₂ on each of the three planes, in English and Russian:
//  - the plane's title reads "<shown plane> · phase of <the map from it into T>" ("w₁ · phase of f₂"), past T "colour of
//    T, carried", with no X and no F where the map is f₂;
//  - the probe's readout names that map ("f₂(w₁)") and reads its value on the plane under the pointer (not F of the point);
//  - the key's caption follows the same map; the last plane has one name, w₂;
//  - the left panel groups the shapes by plane ("In z", "In w₁") with no X or Y, and the phone's probe hint names the map.
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/steps_names_cmd.js
// Prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const txt = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
const num = (s) => parseFloat(String(s).replace(',', '.').replace('−', '-'));
const NUM = '(\\d+[.,]\\d+)';
// the expected title role by language and colour plane: [en, ru] per (T, plane)
const WORD = { en: { phase: 'phase of', carried: 'colour of' }, ru: { phase: 'фаза функции', carried: 'цвет' } };
// [colour plane T][plane k] -> [role kind, the map's name]
const WANT = [
  [['phase', 'z'], ['carried', 'z'], ['carried', 'z']],
  [['phase', 'f₁'], ['phase', 'w₁'], ['carried', 'w₁']],
  [['phase', 'F'], ['phase', 'f₂'], ['phase', 'w₂']],
];
const NAMES = ['z', 'w₁', 'w₂'];

for (const lang of ['en', 'ru']) {
  await view(1440, 900, false);
  await nav(`${U}/test.html?ns=stepnames-${lang}-${Date.now()}&view=steps&lang=${lang}`); await settle(2500);
  await logs();
  ok(`${lang}: the steps view is on`, await ev('typeof __cmwSteps === "function" && __cmwSteps().on'), null);
  ok(`${lang}: Cayley, then cube loads`, await ev('__cmwExample(8)'), null);
  await settle(1000);
  const P = await ev('__cmwP().steps.map((s) => s.type)');
  ok(`${lang}: two steps`, P.length === 2, P);
  for (let T = 0; T < 3; T++) for (let k = 0; k < 3; k++) {
    const tag = `${lang} T=${NAMES[T]} on ${NAMES[k]}`;
    await ev(`__cmwSteps({ T: ${T} }); __cmwSteps({ go: ${k}, now: true }); 1`); await settle(700);
    const s = await ev('__cmwSteps()');
    ok(`${tag}: the colour plane and the plane are as asked`, s.T === T && s.i === k, { T: s.T, i: s.i });
    const [kind, map] = WANT[T][k];
    const title = await txt('.sv-title');
    const w = WORD[lang][kind];
    // (the shown plane's name, then its role: "w₁ · phase of f₂"; the name is w₂ for the last plane too)
    const plain = (t) => t.replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080));
    const want = `${plain(NAMES[k])} · ${w} ${map}`;
    ok(`${tag}: the title reads "${want}"`, kind === 'phase' ? title === want : !!title && title.startsWith(want), title);
    ok(`${tag}: the title names no X and no Y`, !/\bX\b|\bY\b/.test(title) && !/w₂ =|= f/.test(title), title);
    const hidden = await txt('#leftTitle');
    ok(`${tag}: the pane title agrees`, hidden !== null && hidden.includes(w) && !/\bX\b/.test(hidden), hidden);
    // the key's caption: the same map (T's plane itself: its own variable)
    ok(`${tag}: the key names the map`, s.names.key === (kind === 'phase' ? map : NAMES[k]) , s.names);
    ok(`${tag}: one name for the plane (the live label)`, s.label.includes(NAMES[k]) && (k !== 2 || !/Plane w,|Плоскость w,/.test(s.label)), s.label);
    // the probe: a point of the plane under the pointer
    const c = await ev(`(() => { const r = document.getElementById('plotL').getBoundingClientRect(); return [r.left + r.width * 0.6, r.top + r.height * 0.4]; })()`);
    await move(c[0], c[1]); await settle(300);
    const ro = await txt('#leftReadout');
    const m = new RegExp(`${NUM} [+−-] ${NUM}i`).exec(ro || '');
    ok(`${tag}: the readout shows the point`, !!m, ro);
    if (kind === 'phase' && map !== NAMES[k]) {
      // (f₂(w₁): the value of the map into T at the point under the pointer, in the readout's own unit)
      const call = k === 0 ? `${plain(map)}(z)` : `${plain(map)}(w1)`;
      ok(`${tag}: the readout names ${call}`, plain(ro || '').includes(call), ro);
      const mod = new RegExp(`${call.replace(/[()]/g, '\\$&')} ${NUM} ∠`).exec(plain(ro || ''));
      ok(`${tag}: and reads its value`, !!mod, ro);
      if (mod && m) {
        const zr = ro.match(new RegExp(`${NUM} ([+−-]) ${NUM}i`));
        const re = num(zr[1]), im = (zr[2] === '+' ? 1 : -1) * num(zr[3]);
        let wantMod = null;
        if (k === 0 && T === 2) wantMod = await ev(`(() => { const w = __cmwEval('F', null, [[${re}, ${im}]])[0]; return w && Math.hypot(w[0], w[1]); })()`);
        else if (k === 1 && T === 2) wantMod = Math.pow(Math.hypot(re, im), 3);   // f₂ = the cube
        if (wantMod != null) ok(`${tag}: |${call}| is ${wantMod.toFixed(3)}`, Math.abs(num(mod[1]) - wantMod) <= 2e-3 * Math.max(1, wantMod), { got: mod[1], want: wantMod });
      }
    } else if (kind === 'carried') {
      ok(`${tag}: no map line past the colour plane`, !/f₁\(|f₂\(|F\(/.test(plain(ro || '')), ro);
    }
    info[tag] = { title, ro };
  }
  // the left panel: shapes by plane, no X and no Y
  await ev(`__cmwSteps({ T: 2 }); __cmwSteps({ go: 0, now: true }); 1`); await settle(500);
  const heads = await ev(`[...document.querySelectorAll('#shapeList .shapes-sub')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
  ok(`${lang}: the left panel names its planes, not X and Y`, heads.length >= 1 && heads.every((t) => !/\bX\b|\bY\b/.test(t)) && /\bz\b/.test(heads[0]), heads);
  ok(`${lang}: no "draw in Y" note`, !(await ev(`/Y/.test((document.querySelector('#shapeList .empty-note') || { textContent: '' }).textContent)`)), null);
  info[`${lang} heads`] = heads;
}

// the phone: the probe hint names the map into the colour plane (T = w₂ on z: F(z); on w₁: f₂(w₁))
for (const lang of ['en', 'ru']) {
  await view(390, 844, false, true);
  // (the hint shows once a session, and never after a first probe: both memories cleared)
  await nav(`${U}/gl-helpers.html`); await sleep(300);
  await ev(`(() => { try { sessionStorage.removeItem('cmw-probe-taught'); localStorage.removeItem('cmw-probe-learned'); } catch (e) { /* */ } return 1; })()`);
  await nav(`${U}/test.html?ns=stepnames-ph-${lang}-${Date.now()}&view=steps&lang=${lang}`); await settle(2500);
  await ev('__cmwExample(8)'); await settle(1000);
  ok(`${lang} phone: the phone layout`, await ev('!!Phone._state().on'), null);
  const hint = async (k) => { await ev(`__cmwSteps({ T: 2 }); __cmwSteps({ go: ${k}, now: true }); 1`); await settle(700); return txt('#leftReadout .rteach'); };
  const h0 = await hint(0), h1 = await hint(1);
  ok(`${lang} phone: the hint on z names F(z)`, h0 !== null && /F\(z\)/.test(h0), h0);
  ok(`${lang} phone: the hint on w₁ names f₂(w₁)`, h1 !== null && /f₂\(w₁\)/.test(h1), h1);
  info[`${lang} phone`] = { h0, h1 };
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no page errors', errs.length === 0, errs.slice(0, 3));
return { pass: fails.length === 0, fails, info };
