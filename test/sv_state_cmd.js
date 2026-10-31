// The steps view in saves and undo (#366 issue C): a state saved with S.sv opens on it under ?view=steps (a parked, fractional
// `at` too), is written back by the next save, is kept by undo, is repaired when malformed, and is ignored (kept in the
// state) by the default view. A command file for a CDP daemon:  <runner> test/sv_state_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
const ns = 'svs' + Date.now();
await load(ns, {});
const base = await ev('location.origin');
// (a page is loaded once its test hook exists: the state in localStorage comes first, mid-load)
// (a link's payload is made asynchronously: wait for it, not a fixed time)
const linkMade = async () => { for (let i = 0; i < 40; i++) { const p = await ev('window.__svLink'); if (typeof p === 'string') return p; await sleep(250); } return null; };
const hooked = async () => { for (let i = 0; i < 40; i++) { if (await ev(`typeof __cmwSteps === 'function'`) === true) return true; await sleep(500); } return false; };
const steps = [{ type: 'pown', params: { n: 2 } }, { type: 'exp', params: {} }, { type: 'pown', params: { n: 3 } }];
const lsKey = `complex-map-workbench-v1:${ns}`;
const saved = () => ev(`(() => { const o = JSON.parse(localStorage.getItem(${JSON.stringify(lsKey)})); return o && o.sv; })()`);
const sv = { at: 1.4, T: 2, scope: 'in', surf: 'plane', speed: 'slow' };
await load(ns, { steps, sv });
await nav(`${base}/test.html?ns=${ns}&view=steps`); await sleep(2500); await hooked(); await sleep(500);
let st = await ev('__cmwSteps()');
info.open = st;
ok('opens parked between planes (fractional at)', st.on && Math.abs(st.x - 1.4) < 1e-6, st);
ok('opens on its colour plane and scope', st.T === 2 && st.scope === 'in' && st.speed === 'slow', st);
await ev('__cmwSteps({ park: 2.25 })'); await sleep(400);
await ev('window.dispatchEvent(new Event("pagehide")); 1'); await sleep(900);
const w = await saved();
info.written = w;
ok('the next save writes the place back (fractional)', w && Math.abs(w.at - 2.25) < 1e-6 && w.T === 2 && w.scope === 'in' && w.speed === 'slow', w);
// undo: an example replaces the state, undo brings the place back
await nav(`${base}/test.html?ns=${ns}&view=steps`); await sleep(2500); await hooked(); await sleep(500);
await ev('__cmwSteps({ go: 1, now: true })'); await sleep(300);
await ev('(__cmwExample(3), 1)'); await sleep(2500);
await ev(`document.getElementById('undoBtn').click(); 1`); await sleep(2000);
st = await ev('__cmwSteps()');
info.undo = st;
ok('undo returns to the saved place', Math.abs(st.x - 1) < 1e-6 || Math.abs(st.x - 2.25) < 1e-6, st);
// malformed sv is repaired
await load(ns, { steps, sv: { at: 99.5, T: 77, scope: 'x', surf: 'cube' } });
await nav(`${base}/test.html?ns=${ns}&view=steps`); await sleep(2500); await hooked(); await sleep(500);
st = await ev('__cmwSteps()');
info.bad = st;
ok('a malformed sv opens on defaults, clamped (an unknown speed: the device\'s, normal)', st.on && st.x === 3 && st.scope === 'all' && st.surf === 'plane' && st.speed === 'normal', st);
// the speed menu writes the state and the device's setting
await ev(`(() => { const m = document.querySelector('.sv-speed'); m.value = 'slower'; m.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`); await sleep(900);
const menu = await ev(`({ dev: localStorage.getItem('cmw-sv-speed'), st: (() => { const o = JSON.parse(localStorage.getItem(${JSON.stringify(lsKey)})); return o && o.sv && o.sv.speed; })() })`);
info.menu = menu;
ok('the speed menu writes both the state and the device', menu.dev === 'slower' && menu.st === 'slower', menu);
await ev(`localStorage.removeItem('cmw-sv-speed')`);
// the default view ignores it, and keeps it
await load(ns, { steps, sv });
await hooked(); await sleep(500);
await ev('window.dispatchEvent(new Event("pagehide")); 1'); await sleep(900);
st = await ev('__cmwSteps()');
ok('without ?view=steps the steps view is off', st.on === false, st);
const kept = await saved();
ok('and the state keeps sv', kept && Math.abs(kept.at - 1.4) < 1e-6, kept);
// old states open on their equivalent
for (const [name, o, want] of [['X → Y', { rightMode: 'image', shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1', ci: 0 }] }, { scope: 'in', surf: 'plane', main: 'xy' }], ['Phase', { rightMode: 'color' }, { scope: 'all', surf: 'plane', main: 'phase' }], ['Landscape', { rightMode: '3d' }, { scope: 'all', surf: 'land', main: 'land' }]]) {
  await load(ns, Object.assign({ steps }, o));
  await nav(`${base}/test.html?ns=${ns}&view=steps`); await sleep(name === 'Landscape' ? 8000 : 2500); await hooked(); await sleep(500);
  st = await ev('__cmwSteps()');
  info[name] = st;
  ok(`old ${name} opens on its equivalent`, st.on && st.T === 3 && st.scope === want.scope && st.surf === want.surf && st.x === 0, st);
}
// old links and saves open unchanged in the default view: a link made from an old state (rightMode of earlier builds) opens
// on its view, and nothing in the state or its saves gains an sv
for (const [name, o, main] of [['X → Y', { rightMode: 'image' }, 'xy'], ['Phase', { rightMode: 'color' }, 'phase'], ['Landscape', { rightMode: '3d', material: 'plaster' }, 'land']]) {
  await load(ns, {});
  await hooked();   // (Params exists once the page is up)
  await ev(`(window.__svLink = null, Params.encodeLink(${JSON.stringify(Object.assign({ v3: true, v4: true, shapes: [], steps, nextId: 50, focus: 0 }, o))}).then((p) => { window.__svLink = p; }), 1)`);
  const payload = await linkMade();
  const ns2 = ns + 'l' + main;   // (no saved state there: a link opens at once, with a saved one it asks)
  await nav(`${base}/test.html?ns=${ns2}#cmw=${payload}`); let r = null;
  for (let i = 0; i < 12 && !(r && r.n === 3 && r.steps !== 'nohook'); i++) {
    await sleep(1500);
    r = await ev(`(() => { const o = JSON.parse(localStorage.getItem(${JSON.stringify('complex-map-workbench-v1:' + ns2)}) || 'null'); return { sv: o && 'sv' in o, main: o && o.view && o.view.main, n: o && o.steps.length, steps: typeof __cmwSteps === 'function' ? __cmwSteps().on : 'nohook' }; })()`);
  }
  info['link ' + name] = r;
  ok(`old ${name} link opens in the default view, unchanged, with no sv`, r && r.sv === false && r.main === main && r.n === 3 && r.steps === false, r);
}
// old links opened under ?view=steps land on their equivalent: both link forms (1. compressed, 0. plain), a state of an
// earlier build (rightMode) for each of X → Y (with an area: Inside regions), Phase and Landscape. No saved state at the
// page's namespace, so the link opens at once; the page reloads on it
for (const form of ['1', '0']) {
  for (const [name, o, want] of [['X → Y', { rightMode: 'image', shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1', ci: 0 }] }, { scope: 'in', surf: 'plane', main: 'phase' }], ['Phase', { rightMode: 'color' }, { scope: 'all', surf: 'plane', main: 'phase' }], ['Landscape', { rightMode: '3d', material: 'plaster' }, { scope: 'all', surf: 'land', main: 'land' }]]) {
    await load(ns, {});
    await hooked();
    const state = Object.assign({ v3: true, v4: true, shapes: [], steps, nextId: 50, focus: 0 }, o);
    await ev(`(window.__svLink = null, ${form === '1' ? `Params.encodeLink(${JSON.stringify(state)})` : `Promise.resolve('0.' + btoa(JSON.stringify({ v: 1, s: ${JSON.stringify(state)} })).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, ''))`}.then((p) => { window.__svLink = p; }), 1)`);
    const payload = await linkMade();
    ok(`the form ${form}. link was made`, typeof payload === 'string' && payload.startsWith(form + '.'), String(payload).slice(0, 12));
    const nsl = ns + 's' + form + name.replace(/\W/g, '');   // (the steps view shows X → Y at z, coloured from the last plane, as Phase: main 'phase' with Inside regions)
    await nav(`${base}/test.html?ns=${nsl}&view=steps#cmw=${payload}`);
    let r = null;
    for (let i = 0; i < 20 && !(r && r.on && r.T === 3 && r.n === 3); i++) {
      await sleep(1500);
      r = await ev(`typeof __cmwSteps === 'function' ? Object.assign(__cmwSteps(), { n: __cmwSteps().planes.length - 1 }) : null`);
    }
    info[`steps link ${form} ${name}`] = r && { T: r.T, scope: r.scope, surf: r.surf, x: r.x, main: r.main, n: r.n };
    ok(`old ${name} link (form ${form}.) under ?view=steps opens on its equivalent`, r && r.on && r.T === 3 && r.scope === want.scope && r.surf === want.surf && r.main === want.main && r.x === 0 && r.n === 3, info[`steps link ${form} ${name}`]);
  }
}
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
