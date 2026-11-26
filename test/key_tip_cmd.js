// A head key says how to open it from the keyboard as well as the pointer (#2122): the Height key (the steps view's
// Landscape), in English, Russian and Italian. Read from the accessibility
// tree, as a screen reader gets it: the name is the key's own (no instruction), and the description, which holds what the
// key draws, ends with the instruction "…; click it or press Enter to keep it open" in the page's words.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const VIEW_W = 1280, VIEW_H = 800, LOAD_WAIT = 30000;
const SEED = (surf) => ({ steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }], shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1' }], sv: { at: 0, T: 1, scope: 'all', surf } });
const KEYS = [
  // (standards-ok: the classic view's Regions key, in Y's head, goes with Y's pane, which the classic view does not draw, #994;
  // the Height key's rows read the same tip)
  { name: 'Height key', id: 'leftLegend', url: 'view=steps', seed: SEED('land') },
];
const HINT = 'Point at it to unfold; click it or press Enter to keep it open';
const ENTER = { en: /press Enter/, ru: /нажмите Enter/, it: /premi Invio/ };
// the key box's accessible name and description, as the accessibility tree gives them
const axOf = async (id) => {
  const { root } = await send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#' + id });
  const { nodes } = await send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
  const n = nodes && nodes[0];
  return n && !n.ignored ? { role: n.role && n.role.value, name: n.name && n.name.value, description: (n.description && n.description.value) || '' } : null;
};
await view(VIEW_W, VIEW_H, false, false);
for (const lang of ['en', 'ru', 'it']) for (const k of KEYS) {
  const tag = `${lang} ${k.name}`;
  const ns = `kt${lang}${Date.now() % 100000}`;
  if (k.seed) await seed(ns, k.seed);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&${k.url}`);
  await settled({ max: LOAD_WAIT, until: `(() => { const k = document.getElementById('${k.id}'); return !!k && !k.hidden && !!k.closest('.pane-head') && k.getClientRects().length > 0 && !!k.getAttribute('aria-describedby'); })()` });
  const ax = await axOf(k.id);
  const [own, hint] = await ev(`[$t(${JSON.stringify(k.name)}), $t(${JSON.stringify(HINT)})]`);
  info[tag] = ax;
  ok(`${tag}: the key is a button named for itself`, !!ax && ax.role === 'button' && ax.name === own, ax);
  ok(`${tag}: its name leaves the instruction out`, !!ax && !ENTER[lang].test(ax.name || ''), ax);
  ok(`${tag}: its description ends with the instruction (it names Enter and still says click)`, !!ax && ax.description.endsWith(hint) && ENTER[lang].test(hint), [ax, hint]);
  ok(`${tag}: its description still holds what the key draws, before the instruction`, !!ax && ax.description.length > hint.length, ax);
}
return { pass: fails.length === 0, fails, info };
