// In the steps view an example's Try line closes when the user does what it asks (issue #34, #398): flipping a sheet of the
// square root in the Inspector that its chip opens, typing in the formula of the custom step, adding a ray of the
// Douady-Hubbard map. Each line is there after its example opens and closes after its own action, and not on the
// example's own opening. The Repeat examples are example_try_repeat_cmd.js. A command file for a CDP daemon (test/cdp_kit
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
ok('the page is the steps view', await ev('!!window.__cmwSteps && __cmwSteps().on'), null);
for (const [k, re] of [['root', '/Square root and its sheets/'], ['latex', '/A formula in LaTeX/'], ['dh', /The Douady.Hubbard map/.toString()]]) idx[k] = await byName(re);
info.idx = idx;
ok('the examples exist', Object.values(idx).every((i) => i >= 0), idx);
const open = async (k) => { await ev(`__cmwExample(${idx[k]})`); await settle(1600); };
const stays = async (k) => { ok(`${k}: the line is there after the example opens`, await lane(), null); };
const closes = async (k, what) => { await settle(700); ok(`${k}: ${what} closes it`, !(await lane()), null); };
const { selectStep } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'step_pick_kit.js'), 'utf8'))({ ev, settled, ok });

// the square root: ‹ › on its sheet
await open('root'); await stays('root');
await selectStep(1); await settle(500);
ok('root: the sheet buttons are there', await ev(`!!document.querySelector('#propsPanel .sh-next')`), null);
await ev(`document.querySelector('#propsPanel .sh-next').click()`);
await closes('root', 'flipping the sheet');

// the formula of the custom step: typing in it
await open('latex'); await stays('latex');
await selectStep(1); await settle(500);
const fx = await ev(`(() => { const i = document.querySelector('#propsPanel input[data-pkey="expr"]'); if (!i) return false; i.value = i.value + ' '; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
ok('latex: the formula field is there', fx, null);
await closes('latex', 'typing in the formula');

// the Douady-Hubbard map: a ray of one's own
await open('dh'); await stays('dh');
await selectStep(1); await settle(600);
const added = await ev(`(() => { const f = document.querySelector('#propsPanel .pf.dh-add .btn'); if (!f) return false; f.click(); return true; })()`);
ok('dh: the Add ray button is there', added, null);
await closes('dh', 'adding a ray');
return { pass: fails.length === 0, fails, info };
