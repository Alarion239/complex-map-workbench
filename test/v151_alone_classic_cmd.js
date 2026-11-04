// The language switch with a step shown alone (v15.1 verify-8, the classic view): f1 shown alone, f2 selected, then the
// switch to Russian and back keeps f2 selected and its Inspector in the language. "Show alone" is the classic view's; the
// steps view looks at another step by showing its plane, in v151_cmd.js. A command file for a CDP daemon
// (test/cdp_kit README); prints { pass, fails, info }.
const P = { port: (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1] }, base = `http://localhost:${P.port}/test.html`, out = { port: P.port };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const open = async (ns, st, q = '') => {
  await nav(`http://localhost:${P.port}/__blank_for_storage`);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await nav(`${base}?ns=${ns}${q}`); await settle(1500);
};
const SH = [{ id: 's1', kind: 'formula', expr: '|\\Im z| < 0.8' }];
await view(1440, 900, false);
// f1 shown alone, f2 selected, then the language switch
let ns = 'pr8' + Date.now();
await open(ns, { shapes: SH, steps: [{ type: 'exp', params: {}, on: true }, { type: 'zp', params: { a: '1', zeros: '0.5', poles: '-0.5' }, on: true }], focus: 1 });
await ev(`(() => { const c = document.querySelector('#pipeline .card[data-k="2"]'); c.click(); return 1; })()`); await settle(600);
const selState = `(() => { const C = __cmwCards(); return { focus: C.focus, sel: C.sel, insp: (document.querySelector('#propsPanel .insp-step .ihead .ttl') || {}).textContent || null, k: (document.querySelector('#propsPanel .insp-step') || { dataset: {} }).dataset.k }; })()`;
out.v8 = { before: await ev(selState) };
await ev(`(() => { I18N.setPref('ru'); return 1; })()`); await sleep(3000); await settle(800);
out.v8.after = await ev(selState);
await ev(`(() => { I18N.setPref('en'); return 1; })()`); await sleep(3000); await settle(500);
out.v8.back = await ev(selState);
out.logs = (await logs()).filter((l) => l.t === 'EXC' || l.t === 'error').slice(0, 8);
const fails = [];
// (Russian typography: a no-break space after short words and before a dash; compared as a plain space)
const sp = (t) => String(t == null ? '' : t).replace(/\u00a0/g, ' ');
const ok = (name, cond, info) => { if (!cond) fails.push({ name, info }); };
const same = (a, b) => a && b && a.focus === b.focus && a.sel === b.sel && a.k === b.k;
ok('verify-8: the switch keeps f2 selected while f1 is shown alone (and back)', out.v8.before.focus === 1 && out.v8.before.sel === 2 && same(out.v8.before, out.v8.after) && same(out.v8.before, out.v8.back) && /Нули и полюсы/.test(sp(out.v8.after.insp)), out.v8);
ok('no exceptions', out.logs.length === 0, out.logs);
return { pass: fails.length === 0, fails, info: out };
