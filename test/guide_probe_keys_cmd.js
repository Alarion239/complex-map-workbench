// The guide's Keys list names the arrows that move the sound probe on a focused plane: in the classic view the plain ← → ↑ ↓ (the probe moves
// with them there), in the steps view Alt with them (its plain arrows go to the thread), in en, ru and it. A command file for a CDP daemon
// (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const rows = () => ev(`(() => { const m = document.querySelector('.modal'); if (!m) return null;
  return [...m.querySelectorAll('table.keys tr')].map((tr) => ({ keys: [...tr.children[0].querySelectorAll('.kbd')].map((k) => k.textContent.trim()), text: tr.children[1].textContent.trim() })); })()`);
for (const [lang, probe] of [['en', /move the probe/], ['ru', /указатель/], ['it', /sonda/]]) for (const vw of ['classic', 'steps']) {
  const tag = `${lang} ${vw}`;
  await view(1440, 900, false, false);
  await go(`${U}${vw === 'steps' ? '?view=steps' : '?view=classic'}&lang=${lang}`);
  await settled({ max: 20000, until: `typeof __cmwSteps === 'function' && document.readyState === 'complete'` });
  await key('?', 0);
  await settled({ max: 8000, until: `!!document.querySelector('.modal table.keys')` });
  const r = await rows();
  info[tag] = r && r.filter((x) => probe.test(x.text));
  const row = r && r.find((x) => probe.test(x.text) && x.keys.includes('←') && x.keys.includes('↓'));
  ok(`${tag}: the Keys list has a row for the probe's arrows`, !!row, r && r.map((x) => x.keys.join(' ') + ' | ' + x.text));
  if (row) ok(`${tag}: the row's keys are ${vw === 'steps' ? 'Alt with the arrows' : 'the plain arrows'}`, vw === 'steps' ? row.keys[0] === 'Alt' : !row.keys.includes('Alt'), row.keys);
}
return { pass: fails.length === 0, fails: fails.slice(0, 20), info };
