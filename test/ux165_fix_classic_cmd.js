// The deformation bar, Orthogonal on the Sphere view and the Listen layout, classic view only:
//   - with example 8's deformation open, the deformation bar (the classic transport dock) is one row at 1366 × 768;
//   - Orthogonal on the Sphere view says to switch to the plane (the steps view's globe takes no such pick yet);
//   - the planes stay put when Listen starts the melody (the steps view's Listening-along note moves the plane: the
//     sound port).
// The other fixes are in ux165_fix_cmd.js. A command file for a CDP daemon (test/cdp_kit README).
const BASE = `http://localhost:${(/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]}`;
const NS = 'ux165fixc' + (Date.now() % 100000);
const fails = [];
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 250) => { await settled({ floor: ms }); };
const rect = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); })()`);
const mchip = async () => ev(`(()=>{const e=[...document.querySelectorAll('.cm-chip')].find(e=>e.offsetParent); return e? e.textContent.trim() : null})()`);
const tool = async (id) => { const r = await ev(`(() => { const b = [...document.querySelectorAll('[data-tool="${id}"]')].find((e) => e.offsetParent) || document.querySelector('[data-tool="${id}"]'); if(!b) return 0; b.click(); return 1; })()`); await settle(120); return r; };
const U0 = (extra) => Object.assign({ unit: true, snap: true, shapes: [], nextId: 10 }, extra || {});

await view(1366, 768, false, false);
await load(NS, U0({ v3: true, v4: true, focus: 0 }));
await settled({});
await ev(`document.getElementById('examplesBtn').click(), 1`);
await settled({ until: `document.querySelectorAll('#popHost .examples .ex-item').length > 8` });
await ev(`[...document.querySelectorAll('#popHost .examples .ex-item')][8].click(), 1`);
await settled({ until: `!document.querySelector('#popHost .examples')`, floor: 1500 });
await key('m');
await settled({ until: `!!document.querySelector('.tdock:not([hidden])')`, floor: 600 });
{ const d = await rect('.tdock:not([hidden])'); ok('regress-1: the deformation bar is one row at 1366 × 768', d && d[3] - d[1] <= 44, d); }

await load(NS + 'sp', U0({ unit: false, shapes: [{ id: 'C', kind: 'circle', c: [0, 0], r: 0.8, ci: 0, visible: true }], nextId: 30 })); await settle(900);
await ev(`__cmwSetView('L', 'sphere'), 1`); await settle(1200);
{ const q = await ev(`(() => { const P = Region.Globe.lift(0.8 * Math.cos(Math.PI / 3), 0.8 * Math.sin(Math.PI / 3)); return __cmwCI({ gs: ['L', P] }); })()`);
  await tool('perp'); await click(q[0], q[1]); await settle(200);
  ok('rail-5: Orthogonal on the globe says to switch to the plane', /Switch to the plane to pick the curve/.test(await mchip()), await mchip()); }

// regress-5: Listen keeps the planes where they are
await nav(`${BASE}/test.html?ns=${NS}snd`); await settle(1500);
await ev(`document.querySelector('#examplesBtn').click()`); await settle(600);
await ev(`document.querySelector('#popHost .examples .ex-snd').closest('.ex-item').click()`); await settle(2500);
{ const p0 = await rect('#plotL'); const lb = await ev(`(() => { const b = document.querySelector('.tour-lane .btn.primary'); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await click(lb[0], lb[1]); await settle(1200);
  ok('regress-5: the planes do not move when Listen starts the melody', JSON.stringify(await rect('#plotL')) === JSON.stringify(p0), [p0, await rect('#plotL')]); }
return { pass: fails.length === 0, fails };
