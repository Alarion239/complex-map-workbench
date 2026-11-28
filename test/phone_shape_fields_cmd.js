// The Shapes sheet's expanded row on a 390 x 844 and a 430 x 932 phone (en, ru, it) gives each point field its words and its whole text: for a segment, a line, a
// ray and a half-plane, free and bound (the segment bound to w₁,₁ and to z₀′ reads "= w₁,₁" and "= z₀′"), no label is cut to an ellipsis
// and no field's text runs past its box. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const LOAD_MAX = 30000, SLACK = 1;
const STATE = { v3: true, v4: true, v5: true, v6: true, nextId: 70, focus: 0, rightMode: 'image', shapes: [
  { id: 'z0', kind: 'point', p: [0.5, 0.5], ci: 0, visible: true, num: 0 },
  { id: 's50', kind: 'point', ci: 1, visible: true, p: [0.35, 0.45], stage: 1, num: 1 },
  { id: 's51', kind: 'point', ci: 1, visible: true, p: [0.7, -0.35], stage: 1, num: 2 },
  { id: 's53', kind: 'segment', ci: 1, visible: true, a: [0.35, 0.45], b: [0.2, 0.1], stage: 1, at: { a: { s: 's50' }, b: { img: 'z0' } } },
  { id: 'sg', kind: 'segment', ci: 0, visible: true, a: [-1, -1], b: [1, 0.5] },
  { id: 'ln', kind: 'line', ci: 0, visible: true, a: [-1, 0.2], b: [1, 0.4] },
  { id: 'ry', kind: 'ray', ci: 0, visible: true, a: [-1, -0.2], b: [1, 0.1] },
  { id: 'hp', kind: 'halfplane', ci: 0, visible: true, a: [-1, 0.6], b: [1, 0.8] }],
  steps: [{ type: 'custom', params: { expr: 'z^2' }, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }] };
const read = (id) => ev(`(() => {
  const ed = document.querySelector('.sh-insp .shape-edit') || document.querySelector('.shape-edit');
  if (!ed) return null;
  return [...ed.querySelectorAll('.field')].map((f) => {
    const lab = f.querySelector(':scope > label, :scope > span'), inp = f.querySelector(':scope > input');
    return { label: lab ? lab.textContent.trim() : '', labCut: lab ? lab.scrollWidth - lab.clientWidth : 0, value: inp ? inp.value : '', inpCut: inp ? inp.scrollWidth - inp.clientWidth : 0, w: inp ? Math.round(inp.getBoundingClientRect().width) : 0 };
  });
})()`);
for (const [lang, w, h] of [['en', 390, 844], ['ru', 390, 844], ['it', 390, 844], ['en', 430, 932], ['ru', 430, 932], ['it', 430, 932]]) {
  await view(w, h, false, true);
  const ns = 'psf' + lang + (Date.now() % 1000000);
  await go(`${U.replace('test.html', 'gl-helpers.html')}`); await sleep(350);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(STATE))}); 1`);
  await go(`${U}?ns=${ns}&view=steps&lang=${lang}`);
  await settled({ max: LOAD_MAX, until: "typeof __cmwSteps === 'function' && __cmwSteps().on && !!window.Phone && Phone.isOn() && __cmwSteps().planes.length > 2" });
  for (const id of ['s53', 'sg', 'ln', 'ry', 'hp']) {
    await ev(`(__cmwSelect('${id}'), Phone.open('tools', { tab: 'shapes', edit: '${id}' }), 1)`);
    await settled({ max: 8000, floor: 400, until: `!!document.querySelector('.shape-edit .field')` });
    const f = await read(id);
    const tag = `${lang} ${w} ${id}`;
    info[tag] = f;
    ok(`${tag}: the expanded row has its point fields`, !!f && f.length >= 2, f);
    for (const x of f || []) {
      ok(`${tag}: the label "${x.label}" is not cut to an ellipsis`, x.labCut <= SLACK, x);
      ok(`${tag}: the field "${x.value}" shows its whole text`, x.inpCut <= SLACK, x);
    }
    const sw = await ev('[document.documentElement.scrollWidth, innerWidth]');
    ok(`${tag}: the page does not scroll sideways`, sw[0] <= sw[1], sw);
    await ev(`(Phone.close(true), 1)`);
    await settled({ max: 4000, floor: 300, until: `!document.querySelector('.ph-sheet.in, .ph-sheet[open]')` }).catch(() => {});
  }
}
return { pass: fails.length === 0, fails: fails.slice(0, 40), info };
