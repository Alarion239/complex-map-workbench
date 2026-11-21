// The head key's accessible name says how to keep its panel open from the keyboard as well as from the pointer (#2122): the Regions key
// (the classic view's right pane) and the Height key (the steps view's Landscape), each in English, Russian and Italian (the Colour key's
// tip is set only for a colour key in a pane head, and Phase's key lies on the plot). The name leads with the key's own words and names Enter: "…; click it or press Enter to keep it open". A command file for a CDP
// daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const SEED = (surf) => ({ steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }], shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1' }], sv: { at: 0, T: 1, scope: 'all', surf } });
const KEYS = [
  { name: 'Regions key', id: 'rightLegend', url: 'view=classic' },
  { name: 'Height key', id: 'leftLegend', url: 'view=steps', seed: SEED('land') },
];
const WORD = { en: /press Enter/, ru: /нажмите Enter/, it: /premi Invio/ };
const LEAD = { en: { 'Regions key': 'Regions key', 'Height key': 'Height key', 'Colour key': 'Colour key' }, ru: { 'Regions key': 'Шкала областей', 'Height key': 'Шкала высоты', 'Colour key': 'Шкала цвета' }, it: { 'Regions key': 'Legenda delle regioni', 'Height key': "Legenda dell'altezza", 'Colour key': 'Legenda dei colori' } };
await view(1280, 800, false, false);
for (const lang of ['en', 'ru', 'it']) for (const k of KEYS) {
  const tag = `${lang} ${k.name}`;
  const ns = `kt${lang}${Date.now() % 100000}`;
  if (k.seed) await seed(ns, k.seed);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&${k.url}`);
  await settled({ max: 30000, until: `(() => { const k = document.getElementById('${k.id}'); return !!k && !k.hidden && !!k.closest('.pane-head') && k.getClientRects().length > 0 && !!k.getAttribute('aria-label'); })()` });
  const name = await ev(`document.getElementById('${k.id}').getAttribute('aria-label')`);
  info[tag] = name;
  ok(`${tag}: its name names the keyboard (Enter)`, WORD[lang].test(name || ''), name);
  ok(`${tag}: its name keeps the pointer's way (it still says click)`, /щёлкните|fai clic|click/.test(name || ''), name);
  ok(`${tag}: its name holds the key's own words`, (name || '').includes(LEAD[lang][k.name]), name);
}
return { pass: fails.length === 0, fails, info };
