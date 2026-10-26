const R = {};
await view(1440, 900, false, false);
await nav('http://localhost:9507/test.html?ns=fx16mk' + Date.now()); await sleep(3000);
const i = await ev(`(() => { for (let i = 0; i < 40; i++) { __cmwExample(i); const l = document.querySelector('#examplesBtn .exlabel'); if (l && /Mountain/.test(l.textContent)) return i; } return -1; })()`);
await sleep(600);
R.i = i;
R.toast = await ev(`(() => { const t = document.querySelector('#toastHost .toast'); return t ? { text: t.textContent, act: [...t.querySelectorAll('button')].map((b) => b.textContent || b.getAttribute('aria-label')) } : null; })()`);
await shot('fx-mk-open');
await sleep(9500);
R.toastAfter9s = await ev(`!!document.querySelector('#toastHost .toast')`);
// sound off: the listen ask toast is sticky
await ev(`(() => { try { Sound.set({ on: false }); } catch (e) {} return 1; })()`);
await ev(`(() => { const b = document.querySelector('#toastHost .toast .toast-act'); return 1; })()`);
R.chipIdle = await ev(`(() => { const c = document.getElementById('sphereChipL'); return c ? { hidden: c.hidden, text: c.textContent } : null; })()`);
R.logs = (await logs()).filter((x) => x.t === 'EXC' || x.t === 'error').slice(0, 5);
return R;
