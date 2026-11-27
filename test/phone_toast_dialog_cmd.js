// A phone's message when a dialog opens over it. 390 × 844 with touch, the steps view, in en, ru and it: an example
// is opened (its "Opened …" message with Undo is up) and the export dialog is opened over it.
//  - from the dialog's first frame (two animation frames after its backdrop is added) no message lies over the dialog, and
//    none does once the dialog is built: a message that was up when it opened is old news, and its Undo stays on the bar;
//  - a message raised while the dialog is open (what the dialog itself says: "LaTeX copied.", a save, an error) shows over it,
//    with no action or with one; its action takes a press, and it covers no point of the dialog's Save or its ×;
//  - once the dialog is closed, the example's opening is still undone by the phone's Undo button (en, it) or by ⌘Z (ru):
//    the shapes are the saved state's again.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ST = { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
const LOAD_MS = 30000, TOAST_MS = 15000, DIALOG_MS = 20000, CLOSE_MS = 5000, K = 3;
// (the boxes of the dialog and of each message in the host, and which messages lie over the dialog)
const OVER = `(() => {
  const bg = document.querySelector('.modal-bg'), m = bg && bg.querySelector('.modal');
  if (!m) return null;
  const d = m.getBoundingClientRect(), box = (r) => [r.left, r.top, r.right, r.bottom].map(Math.round);
  const msgs = [...document.querySelectorAll('#toastHost .toast')].map((t) => ({ r: t.getBoundingClientRect(), words: t.textContent.slice(0, 48), undo: t.hasAttribute('data-undo') }));
  const over = msgs.filter(({ r }) => r.width > 0 && r.right > d.left && r.left < d.right && r.bottom > d.top && r.top < d.bottom);
  return { dialog: box(d), msgs: msgs.length, over: over.map((o) => ({ box: box(o.r), words: o.words, undo: o.undo })) };
})()`;
// (how many of a K × K grid of points on each of the dialog's Save and × lie under a message, by elementFromPoint)
const COVERED = `(() => {
  const out = {};
  for (const [k, e] of [['save', document.getElementById('xfSave')], ['close', document.querySelector('.modal-bg .xf-x')]]) {
    if (!e || !e.getClientRects().length) { out[k] = null; continue; }
    const r = e.getBoundingClientRect();
    let under = 0;
    for (let i = 0; i < ${K}; i++) for (let j = 0; j < ${K}; j++) {
      const p = document.elementFromPoint(r.left + (i + 0.5) * r.width / ${K}, r.top + (j + 0.5) * r.height / ${K});
      if (p && p.closest('#toastHost')) under++;
    }
    out[k] = under;
  }
  return out;
})()`;
await view(390, 844, false, true);
for (const lang of ['en', 'ru', 'it']) {
  const tag = `390 × 844, ${lang}`;
  await loadView('steps', 'phtdlg' + lang + Date.now(), ST, { lang });
  const up = await settled({ max: LOAD_MS, until: `!!window.__cmwSteps && __cmwSteps().on && typeof __cmwExample === 'function' && typeof __cmwToast === 'function'` });
  ok(`${tag}: the page is up in the steps view`, up.ok, up);
  await ev('__cmwExample(1), 1');
  const shown = await settled({ only: true, max: TOAST_MS, until: `!!document.querySelector('#toastHost .toast[data-undo]')` });
  ok(`${tag}: opening an example shows its message with Undo`, shown.ok, await ev(`[...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent.slice(0, 48))`));
  // (the dialog's first frame: read two animation frames after its backdrop is added)
  await ev(`(() => { window.__tdFirst = null; new MutationObserver((_, ob) => { if (!document.querySelector('.modal-bg')) return; ob.disconnect(); requestAnimationFrame(() => requestAnimationFrame(() => { window.__tdFirst = ${OVER}; })); }).observe(document.body, { childList: true }); })()`);
  await key('e', 2);
  const opened = await settled({ only: true, max: DIALOG_MS, until: `window.__tdFirst !== null && !!document.querySelector('.modal-bg #xfMore')` });
  ok(`${tag}: the export dialog opens`, opened.ok, opened);
  const first = await ev('window.__tdFirst'), built = await ev(OVER);
  info[lang] = { first, built };
  ok(`${tag}: from the dialog's first frame no message lies over it`, !!first && first.over.length === 0, first);
  ok(`${tag}: no message lies over the built dialog`, !!built && built.over.length === 0, built);
  ok(`${tag}: the example's Undo stays on the bar`, await ev(`document.getElementById('undoBtn').disabled === false`), null);
  // (what the dialog itself says while it is open stays up over it)
  await ev(`(__cmwToast('LaTeX copied.', null, { ms: 60000 }), 1)`);
  const said = await settled({ only: true, max: TOAST_MS, until: `!!document.querySelector('#toastHost .toast:not(.toast-out)')` });
  ok(`${tag}: a message raised while the dialog is open shows`, said.ok && (await ev(`document.querySelector('#toastHost .toast').textContent.startsWith('LaTeX copied.')`)), said);
  await ev(`(__cmwToast('Saved strip.pdf.', 'Do', { ms: 60000 }), 1)`);
  await settled({ only: true, max: TOAST_MS, until: `!!document.querySelector('#toastHost .toast .toast-act')` });
  const act = await ev(`(() => { const b = document.querySelector('#toastHost .toast .toast-act'); if (!b) return null; const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { box: [r.left, r.top, r.right, r.bottom].map(Math.round), hit: !!e && b.contains(e) }; })()`);
  ok(`${tag}: a message with an action raised over the dialog takes a press on its action`, !!act && act.hit, act);
  const cov = await ev(COVERED);
  info[lang].covered = cov;
  ok(`${tag}: it covers no point of the dialog's Save or ×`, cov.save === 0 && cov.close === 0, cov);
  await key('Escape');
  const closed = await settled({ only: true, max: CLOSE_MS, until: `!document.querySelector('.modal-bg')` });
  ok(`${tag}: Esc closes the dialog`, closed.ok, closed);
  // (the example's opening is the last edit: Undo takes the shapes back to the saved state's, which has none)
  const before = await ev('__cmwKeys().shapeIds.length');
  const how = lang === 'ru' ? '⌘Z' : 'the Undo button';
  if (lang === 'ru') await key('z', 2);
  else {
    const at = await ev(`(() => { const b = [...document.querySelectorAll('.ph-undo, .ph-hundo')].find((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    ok(`${tag}: the phone shows an Undo button`, !!at, at);
    if (at) await click(at[0], at[1]);
  }
  const undone = await settled({ only: true, max: CLOSE_MS, until: '__cmwKeys().shapeIds.length === 0' });
  ok(`${tag}: after the dialog, ${how} still undoes the example's opening`, before > 0 && undone.ok, { before, after: await ev('__cmwKeys().shapeIds.length') });
}
return { pass: fails.length === 0, fails, info };
