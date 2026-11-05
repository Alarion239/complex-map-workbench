// The Repeat examples' Try lines close when the user does what they ask (issue #34, #398), in the classic views: the Repeat
// of a block from a card's ⋯ menu and its N in the card bracket (Julia sets, Douady's rabbit, Newton's method, z² + i).
// example_try_repeat_cmd.js asks the same in the steps view. A command file for a CDP daemon (test/cdp_kit README); prints
// { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const lane = () => ev(`!!document.querySelector('.tour-lane[data-lane="example"]')`);
const idx = {};
const byName = async (re) => ev(`(() => { for (let i = 0; i < 60; i++) { try { __cmwExample(i); } catch (e) { return -1; } const l = document.querySelector('#examplesBtn .exlabel'); if (l && ${re}.test(l.textContent)) return i; } return -1; })()`);
await view(1440, 900, false, false);
await load('exev' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1200);
for (const [k, re] of [['julia', '/A Julia set that its map keeps/'], ['rabbit', /Douady.s rabbit/.toString()], ['newton', /Newton.s method for/.toString()],
  ['juliai', /The Julia set of z. \+ i/.toString()]]) idx[k] = await byName(re);
info.idx = idx;
ok('the examples exist', Object.values(idx).every((i) => i >= 0), idx);
const open = async (k) => { await ev(`__cmwExample(${idx[k]})`); await settle(1600); };
const stays = async (k) => { ok(`${k}: the line is there after the example opens`, await lane(), null); };
const closes = async (k, what) => { await settle(700); ok(`${k}: ${what} closes it`, !(await lane()), null); };
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

return { pass: fails.length === 0, fails, info };
