// The undo history names a Split as the Split (#1649). A formula step split into steps (the Split offer in the Inspector), then Undo
// and Redo: the Undo and Redo messages (a toast, or the steps view's live region when the focus is on its thread) and the
// buttons' tips say "split f₂ into f₂–f₄: Integer power → Translation → Sine", in the
// words of the Split's own message ("Split f₂ into f₂–f₄: …"), not "add f₅ Sine". In English, Russian and Italian:
// - the Split's own message names the range and the new steps (the control: what the history must name);
// - Undo's message is "Undid: <the Split>.", Redo's is "Redid: <the Split>.";
// - the Undo button's tip after the Split, and the Redo button's after the Undo, name the Split too.
// A control: a step added by the palette's way (the steps view's + Step) is still "add f₄ …", not a Split.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const LOAD_MS = 40000, SETTLE_MS = 20000;
const until = (expr, max = SETTLE_MS) => settled({ until: expr, max });
const F1 = (expr) => ({ type: 'custom', params: { expr, cut: 180 }, on: true });
// step 2 of exp, <formula>, ×2 is a formula that splits into n steps, f₂ to f₍₁₊ₙ₎ (the chain's thread has 4 planes, 3 + n - 1 after)
const SPLIT_K = 2, PLANES_BEFORE = 4;
const CASES = [
  { expr: '\\sin(z^2+1)', n: 3, last: 'f₄' },   // three steps: the history once said "add f₂–f₄"
  { expr: '2\\sin z', n: 2, last: 'f₃' },       // two steps: it once said "add f₃ Sine", one step added
];
const chainOf = (expr) => [{ type: 'exp', params: {}, on: true }, F1(expr), { type: 'mul', params: { c: '2' }, on: true }];
// by language: the Split's own message (the chain is its group 1), and the frames the history puts the Split in
const langs = (last) => ({
  en: { splitStart: 'Split f₂ into', split: new RegExp(`^Split f₂ into f₂–${last}: (.+)\\.$`), named: (c) => `split f₂ into f₂–${last}: ${c}`, undid: 'Undid: ', redid: 'Redid: ', undo: 'Undo: ', redo: 'Redo: ' },
  ru: { splitStart: 'Шаг f₂ разложен', split: new RegExp(`^Шаг f₂ разложен на шаги f₂–${last}: (.+)\\.$`), named: (c) => `разложение f₂ на шаги f₂–${last}: ${c}`, undid: 'Отменено: ', redid: 'Повторено: ', undo: 'Отменить: ', redo: 'Повторить: ' },
  it: { splitStart: 'Passo f₂ scomposto', split: new RegExp(`^Passo f₂ scomposto in f₂–${last}: (.+)\\.$`), named: (c) => `scomposizione di f₂ in f₂–${last}: ${c}`, undid: 'Annullato: ', redid: 'Ripetuto: ', undo: 'Annulla: ', redo: 'Ripeti: ' },
});
const ns = 'ssh' + Date.now();
const tipOf = (id) => ev(`(() => { const b = document.getElementById(${JSON.stringify(id)}); b.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); return b.dataset.tip || null; })()`);
let opened = 0;
const open = async (lang, expr) => {
  const nsn = `${ns}${lang}${++opened}`;
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 }, steps: chainOf(expr) };
  await view(1440, 900, false, false);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${nsn}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${nsn}&lang=${lang}&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane') && __cmwSteps().planes.length > 1", LOAD_MS);
};
// the messages now said: the toasts and the steps view's live region (a quiet toast goes there)
const SAID = "#toastHost .toast, .sr-only[aria-live='polite']";
const saidNow = () => ev(`[...document.querySelectorAll(${JSON.stringify(SAID)})].map((e) => (e.firstElementChild && e.classList.contains('toast') ? e.firstElementChild.textContent : e.textContent).trim()).filter(Boolean)`);
// waits for a message that starts with prefix; returns the messages said that start with it
const said = async (prefix) => { await until(`[...document.querySelectorAll(${JSON.stringify(SAID)})].some((e) => (e.firstElementChild && e.classList.contains('toast') ? e.firstElementChild.textContent : e.textContent).trim().startsWith(${JSON.stringify(prefix)}))`); return (await saidNow()).filter((t) => t.startsWith(prefix)); };
for (const C of CASES) for (const [lang, L] of Object.entries(langs(C.last))) {
  const PLANES_AFTER_SPLIT = PLANES_BEFORE + C.n - 1;
  await open(lang, C.expr);
  await clickSel(`#svStrip .sv-step[data-k="${SPLIT_K}"] .sv-fchip`);
  await until("!!document.querySelector('#propsPanel .split-offer .so-btn')");
  await clickSel('#propsPanel .split-offer .so-btn');
  await until(`__cmwSteps().planes.length === ${PLANES_AFTER_SPLIT}`);
  const splitMsg = (await said(L.splitStart))[0];
  const m = L.split.exec(splitMsg || '');
  ok(`${lang} ${C.n} steps: the Split's own message names the range and the new steps`, !!m, splitMsg);
  if (!m) continue;
  const named = L.named(m[1]);
  info[`${lang} ${C.n}`] = { split: splitMsg, named };
  // the Undo button's tip, before the Undo
  const tipU = await tipOf('undoBtn');
  ok(`${lang} ${C.n} steps: the Undo button's tip names the Split`, !!tipU && tipU.startsWith(L.undo + named), tipU);
  await ev(`document.getElementById('undoBtn').click(), 1`);
  await until(`__cmwSteps().planes.length === ${PLANES_BEFORE}`);
  const undid = await said(L.undid);
  ok(`${lang} ${C.n} steps: Undo's message names the Split`, undid.includes(`${L.undid}${named}.`), undid);
  const tipR = await tipOf('redoBtn');
  ok(`${lang} ${C.n} steps: the Redo button's tip names the Split`, !!tipR && tipR.startsWith(L.redo + named), tipR);
  await ev(`document.getElementById('redoBtn').click(), 1`);
  await until(`__cmwSteps().planes.length === ${PLANES_AFTER_SPLIT}`);
  const redid = await said(L.redid);
  ok(`${lang} ${C.n} steps: Redo's message names the Split`, redid.includes(`${L.redid}${named}.`), redid);
}
// the control, in English: a step added is still "add f…", so the Split's wording is not used for any longer chain
await open('en', CASES[0].expr);
await ev(`__cmwAddStep('exp'), 1`);
await until(`__cmwSteps().planes.length === ${PLANES_BEFORE + 1}`);
const tipAdd = await tipOf('undoBtn');
info.control = tipAdd;
ok('control: a step added is "add f₄ …", not a Split', !!tipAdd && /^Undo: add f₄ /.test(tipAdd), tipAdd);
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
