// In the steps view the Repeat examples' Try lines close when the user does what they ask (issue #34, #398): the Repeat of
// a block from a step chip's ⋯ menu and its N in the Inspector's Repeat row (Julia sets, Douady's rabbit, Newton's method,
// z² + i). Each line is there after its example opens, says nothing of cards, and closes after its own action, and not on
// the example's own opening. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const { press, pickItem, typeN } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'repeat_kit.js'), 'utf8'))({ ev, settled });
const { selectStep } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'step_pick_kit.js'), 'utf8'))({ ev, settled, ok });
const laneText = () => ev(`(() => { const l = document.querySelector('.tour-lane[data-lane="example"]'); return l ? l.textContent : null; })()`);
const idx = {};
const byName = async (re) => ev(`(() => { for (let i = 0; i < 60; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && ${re}.test(l.textContent)) return i; } return -1; })()`);
await view(1440, 900, false, false);
await load('exrp' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1200);
ok('the page is the steps view', await ev('!!window.__cmwSteps && __cmwSteps().on'), null);
for (const [k, re] of [['julia', '/A Julia set that its map keeps/'], ['rabbit', /Douady.s rabbit/.toString()], ['newton', /Newton.s method for/.toString()], ['juliai', /The Julia set of z. \+ i/.toString()]]) idx[k] = await byName(re);
info.idx = idx;
ok('the examples exist', Object.values(idx).every((i) => i >= 0), idx);
const open = async (k) => { await ev(`__cmwExample(${idx[k]})`); await settle(1600); };
const stays = async (k) => {
  const t = await laneText();
  ok(`${k}: the line is there after the example opens, and says nothing of a card or a bracket`, !!t && !/\bcard\b|bracket/i.test(t), t);
};
const closes = async (k, what) => { await settle(700); ok(`${k}: ${what} closes it`, (await laneText()) === null, await laneText()); };
// the menu of step k's chip, then its items in turn (a step with one way to repeat has the single item Repeat…)
const repeatOf = async (k, ...items) => {
  ok(`the ⋯ of the chip f${k} is there`, await press(`#svStrip .sv-step[data-k="${k}"] .sv-more`), null);
  await settle(300);
  for (const item of items) { ok(`${item} is there`, await pickItem(item), null); await settle(300); }
  await settle(200);
};

// a Julia set: Repeat this step, then raise N
await open('julia'); await stays('julia');
await repeatOf(1, 'Repeat…');
ok('julia: the Repeat alone does not close it (it asks for N too)', (await laneText()) !== null, await laneText());
await typeN('3');
await closes('julia', 'raising N');

// Douady's rabbit: Repeat, N = 3
await open('rabbit'); await stays('rabbit');
await repeatOf(1, 'Repeat…');
ok('rabbit: N = 2 does not close it', (await laneText()) !== null, await laneText());
await typeN('3');
await closes('rabbit', 'N = 3');

// Newton: lower N of the repeat the example has, in the Inspector's row for its step
await open('newton'); await stays('newton');
await selectStep(1); await settle(500);
await typeN('2');
await closes('newton', 'lowering N');

// z² + i: Repeat f₁–f₂, then N = 3
await open('juliai'); await stays('juliai');
await repeatOf(2, 'Repeat', 'f₁–f₂, twice');
ok('juliai: N = 2 does not close it', (await laneText()) !== null, await laneText());
await typeN('3');
await closes('juliai', 'N = 3 over two steps');
// the Russian lines say nothing of a card or a bracket either
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await nav(`http://localhost:${PORT}/test.html?ns=exrpru${Date.now() % 1000000}&view=steps&lang=ru`);
await settle(2000);
for (const [k, re] of [['julia', /Множество Жюлиа, которое сохраняет/], ['rabbit', /Кролик Дуади/], ['newton', /Метод Ньютона для/], ['juliai', /Множество Жюлиа для z² \+ i/]]) {
  const i = await byName(re);
  ok(`ru ${k}: the example exists`, i >= 0, i);
  if (i < 0) continue;
  await ev(`__cmwExample(${i})`); await settle(1600);
  const t = await laneText();
  ok(`ru ${k}: the line is there and says nothing of a card or a bracket`, !!t && !/карточк|скобк/i.test(t), t);
}
return { pass: fails.length === 0, fails, info };
