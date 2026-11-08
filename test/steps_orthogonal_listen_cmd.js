// The steps view's Orthogonal tool and Listen:
//   - Orthogonal picked on the globe says to switch to the plane to pick the curve; on the plane it does not;
//   - the planes stay where they are when Listen starts the melody, and the Listening-along note appears.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const BASE = `http://localhost:${(/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]}`;
const NS = 'svol' + (Date.now() % 100000);
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 250) => { await settled({ floor: ms }); };
const rect = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); })()`);
const mchip = () => ev(`(() => { const e = [...document.querySelectorAll('.cm-chip')].find((x) => x.offsetParent); return e ? e.textContent.trim() : null; })()`);
const tool = async (id) => { const r = await ev(`(() => { const b = [...document.querySelectorAll('[data-tool="${id}"]')].find((e) => e.offsetParent); if (!b) return 0; b.click(); return 1; })()`); await settle(300); return r; };
const SWITCH = /Switch to the plane to pick the curve/;
await view(1366, 768, false, false);

// Orthogonal: the plane's chip, then the globe's
await load(NS, { v3: true, v4: true, v5: true, v6: true, unit: false, snap: true, shapes: [{ id: 'C', kind: 'circle', c: [0, 0], r: 0.8, ci: 0, visible: true }], nextId: 30, focus: 0,
  steps: [{ type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }] });
await nav(`${BASE}/test.html?ns=${NS}&lang=en&view=steps`); await settle(1500);
ok('Orthogonal on the plane: a tool is picked', await tool('perp') === 1, null);
ok('Orthogonal on the plane does not ask to switch to it', !SWITCH.test(await mchip() || ''), await mchip());
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), 1`); await settle(300);
await ev(`__cmwSteps({ surf: 'sphere' }), 1`); await settle(1500);
ok('the globe is shown', (await ev(`__cmwSteps().surf`)) === 'sphere', await ev(`__cmwSteps().surf`));
ok('Orthogonal on the globe: a tool is picked', await tool('perp') === 1, null);
ok('Orthogonal on the globe says to switch to the plane to pick the curve', SWITCH.test(await mchip() || ''), await mchip());

// Listen: the planes stay put
await nav(`${BASE}/test.html?ns=${NS}snd&lang=en&view=steps`); await settle(1500);
await ev(`document.querySelector('#examplesBtn').click()`); await settle(600);
await ev(`document.querySelector('#popHost .examples .ex-snd').closest('.ex-item').click()`); await settle(2500);
const p0 = await rect('#plotL');
const lb = await ev(`(() => { const b = document.querySelector('.tour-lane .btn.primary'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
ok('the sound example offers Listen, and the plane is on screen', !!lb && !!p0, [lb, p0]);
if (lb) {
  await click(lb[0], lb[1]); await settle(1200);
  ok('Listen has started: the Listening-along note shows', /Listening along/.test(await ev(`document.body.innerText`)), null);
  ok('the planes do not move when Listen starts the melody', JSON.stringify(await rect('#plotL')) === JSON.stringify(p0), [p0, await rect('#plotL')]);
}
info.checks = 'steps view: Orthogonal hint on the globe, Listen keeps the planes';
return { pass: fails.length === 0, fails, info };
