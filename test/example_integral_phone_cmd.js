// The example "A residue by integration" opens its Line integral popover by itself on the desktop; on a phone layout it
// does not, because the popover would cover much of the plane: the Try line asks the user to open it, and the line
// closes when they do. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const POP = '.int-pop', LANE = '.tour-lane[data-lane="example"]';
const count = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const palette = async (q) => {
  await key('k', 4);
  await settled({ only: true, until: `!!document.querySelector('#popHost .palette') && !!document.getElementById('palInput')` });
  await ev(`(() => { const i = document.getElementById('palInput'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input')); })()`);
  await settled({ only: true, until: `(() => { const i = document.getElementById('palInput'); return !!i && i.value === ${JSON.stringify(q)} && !!document.querySelector('#popHost .palette .pal-item'); })()` });
};
const legs = [['desktop 1280×800', 1280, 800, false, true], ['phone 360×640', 360, 640, true, false], ['phone 412×915', 412, 915, true, false], ['phone landscape 740×360', 740, 360, true, false]];
let EXAMPLE_AT = -1;   // the example's place in the page's list
for (const [name, w, h, touch, pops] of legs) {
  await view(w, h, false, touch);
  await go(`http://localhost:${PORT}/test.html?ns=exint${w}${Date.now() % 100000}&lang=en`);
  await settled({ max: 30000, until: 'typeof __cmwExample === "function"' });
  await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); return 1; })()`);
  // (the example by its name: the page's own list, not an index)
  const idx = await ev(`(() => { for (let i = 0; i < 80; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && /A residue by integration/.test(l.textContent)) return i; } return -1; })()`);
  ok(`${name}: the example is found`, idx >= 0, idx);
  if (idx >= 0) EXAMPLE_AT = idx;
  if (idx < 0) continue;
  await ev(`__cmwExample(${idx}); 1`);
  await frames(); await settled({ max: 10000 });
  await settled({ max: 20000, until: `!!document.querySelector(${JSON.stringify(LANE)})` });
  // (the popover opens a frame after the planes have their size: two frames on, and the page quiet, a delayed open would be there)
  await frames(); await settled({ max: 10000 });
  const n = await count(POP);
  info[name] = { pops: n };
  ok(`${name}: the Line integral popover is ${pops ? 'open' : 'not open'} after the example loads`, pops ? n === 1 : n === 0, n);
  if (pops) continue;
  // the user opens it, as the line asks: the line closes
  ok(`${name}: the Try line is showing`, (await count(LANE)) === 1, await count(LANE));
  await palette('integrate');
  await ev(`(() => { const r = [...document.querySelectorAll('#popHost .palette .pal-item')].find((e) => /^(∮ .* around |Integrate .* along )/.test(e.querySelector('.pal-label').textContent)); if (r) r.click(); return !!r; })()`);
  await settled({ max: 10000, until: `document.querySelectorAll(${JSON.stringify(POP)}).length >= 1` });
  ok(`${name}: choosing the integral opens the popover`, (await count(POP)) >= 1, await count(POP));
  await settled({ max: 10000, until: `!document.querySelector(${JSON.stringify(LANE)})` });
  ok(`${name}: the Try line closes once the user opens the integral`, (await count(LANE)) === 0, await count(LANE));
}
// the gallery card's description names the menu item the line names: on touch (a long press) it says ∮, in en, ru and it, and neither
// it nor the mouse's right-click version names the open curve's "Integrate"
for (const [lang, w, h, touch] of [['en', 360, 640, true], ['ru', 360, 640, true], ['it', 360, 640, true], ['en', 1280, 800, false]]) {
  const tag = `${lang} ${touch ? 'touch' : 'mouse'}: the gallery card`;
  await view(w, h, false, touch);
  await go(`http://localhost:${PORT}/test.html?ns=exblurb${lang}${Date.now() % 100000}&lang=${lang}`);
  await settled({ max: 30000, until: 'typeof __cmwExample === "function"' });
  await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); return 1; })()`);
  await ev(`document.getElementById('examplesBtn').click(); 1`);
  await settled({ max: 20000, until: `document.querySelectorAll('#popHost .examples .ex-item').length > ${EXAMPLE_AT}` });
  const blurb = await ev(`(() => { const b = document.querySelectorAll('#popHost .examples .ex-item')[${EXAMPLE_AT}]; return b ? b.querySelector('.ex-blurb').textContent : null; })()`);
  info[tag] = blurb;
  if (touch) ok(`${tag} names the menu item ∮`, !!blurb && blurb.includes('∮'), blurb);
  ok(`${tag} does not name an Integrate item (the circle's menu has none)`, !!blurb && !/Integrate|Integra»|Вычислить интеграл/.test(blurb), blurb);
}
return { pass: fails.length === 0, fails, info };
