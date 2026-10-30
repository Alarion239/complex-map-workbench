// An example's Try line closes when the user does what it asks, for every example that has one (issue #34, #398): flipping a
// sheet of the square root, typing in the formula of the custom step, the Repeat of a block and its N, adding a ray of the
// Douady-Hubbard map, dragging a number (the disc map's a, Boettcher's c). Each line is there after its example opens and
// closes after its own action, and not on the example's own opening. A command file for a CDP daemon (test/cdp_kit
// README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const lane = () => ev(`!!document.querySelector('.tour-lane[data-lane="example"]')`);
const idx = {};
const byName = async (re) => ev(`(() => { for (let i = 0; i < 60; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && ${re}.test(l.textContent)) return i; } return -1; })()`);
await view(1440, 900, false, false);
await load('exev' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1200);
for (const [k, re] of [['root', '/Square root and its sheets/'], ['latex', '/A formula in LaTeX/'], ['julia', '/A Julia set that its map keeps/'], ['rabbit', /Douady.s rabbit/.toString()], ['newton', /Newton.s method for/.toString()],
  ['juliai', /The Julia set of z. \+ i/.toString()], ['dh', /The Douady.Hubbard map/.toString()]]) idx[k] = await byName(re);
info.idx = idx;
ok('the examples exist', Object.values(idx).every((i) => i >= 0), idx);
const open = async (k) => { await ev(`__cmwExample(${idx[k]})`); await settle(1600); };
const stays = async (k) => { ok(`${k}: the line is there after the example opens`, await lane(), null); };
const closes = async (k, what) => { await settle(700); ok(`${k}: ${what} closes it`, !(await lane()), null); };
const clickCard = (n) => ev(`(() => { const c = document.querySelector('#pipeline .card[data-k="${n}"]'); if (!c) return false; c.click(); return true; })()`);
// the ⋯ menu of card n: its item by label (and a sub-item)
const menuPick = async (n, labels) => {
  await ev(`document.querySelector('#pipeline .card[data-k="${n}"] .more').click()`); await settle(400);
  for (const lab of labels) {
    const hit = await ev(`(() => { const it = [...document.querySelectorAll('[role=menuitem]')].find((e) => e.textContent.trim().startsWith(${JSON.stringify(lab)})); if (!it) return false; it.click(); return true; })()`);
    if (!hit) return false;
    await settle(400);
  }
  return true;
};

// the square root: ‹ › on its sheet
await open('root'); await stays('root');
await clickCard(1); await settle(500);
ok('root: the sheet buttons are there', await ev(`!!document.querySelector('#propsPanel .sh-next')`), null);
await ev(`document.querySelector('#propsPanel .sh-next').click()`);
await closes('root', 'flipping the sheet');

// the formula of the custom step: typing in it
await open('latex'); await stays('latex');
await clickCard(1); await settle(500);
const fx = await ev(`(() => { const i = document.querySelector('#propsPanel input[data-pkey="expr"]'); if (!i) return false; i.value = i.value + ' '; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
ok('latex: the formula field is there', fx, null);
await closes('latex', 'typing in the formula');

// Repeat: the menu's Repeat sets the block (N = 2), the chip's N raises it
await open('julia'); await stays('julia');
const rp = await menuPick(1, ['Repeat', 'This step, twice']);
ok('julia: the Repeat menu is there', rp, null);
await settle(500);
ok('julia: the Repeat alone does not close it (it asks for N too)', await lane(), null);
await ev(`(() => { const i = document.querySelector('#pipeline .rep-bracket .rep-n'); i.value = '3'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await closes('julia', 'raising N');

// Douady's rabbit: Repeat, N = 3
await open('rabbit'); await stays('rabbit');
await menuPick(1, ['Repeat', 'This step, twice']); await settle(500);
ok('rabbit: N = 2 does not close it', await lane(), null);
await ev(`(() => { const i = document.querySelector('#pipeline .rep-bracket .rep-n'); i.value = '3'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await closes('rabbit', 'N = 3');

// Newton: lower N in the bracket the example has
await open('newton'); await stays('newton');
const nb = await ev(`!!document.querySelector('#pipeline .rep-bracket .rep-n')`);
ok('newton: the bracket is there', nb, null);
await ev(`(() => { const i = document.querySelector('#pipeline .rep-bracket .rep-n'); i.value = '2'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await closes('newton', 'lowering N');

// z² + i: Repeat f₁–f₂, then N = 3
await open('juliai'); await stays('juliai');
const r2 = await menuPick(2, ['Repeat', 'f₁–f₂, twice']);
ok('juliai: the f₁–f₂ item is there', r2, null);
await settle(500);
ok('juliai: N = 2 does not close it', await lane(), null);
await ev(`(() => { const i = document.querySelector('#pipeline .rep-bracket .rep-n'); i.value = '3'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await closes('juliai', 'N = 3 over two steps');

// the Douady-Hubbard map: a ray of one's own
await open('dh'); await stays('dh');
await clickCard(1); await settle(600);
const added = await ev(`(() => { const f = document.querySelector('#propsPanel .pf.dh-add .btn'); if (!f) return false; f.click(); return true; })()`);
ok('dh: the Add ray button is there', added, null);
await closes('dh', 'adding a ray');
return { pass: fails.length === 0, fails, info };
