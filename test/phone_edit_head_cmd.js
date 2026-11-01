// The phone's Edit sheet head (#606): Undo and × sit in a 44 px strip above the Inspector's scroller, not floating over it, so
// with the Inspector scrolled (top, 169 px, the end) nothing of the step's fields meets them. English, Russian and Italian
// at 360 and 390 px (and 740 × 360, the landscape side panel), the classic view and the steps view: the buttons are 44 × 44, 4 px apart, 4 px from the sheet's right
// edge; the strip ends where the scroller starts; the grabber's bar is centred; no visible control or field of the
// Inspector meets either button; a drag that starts on a button does not move the sheet.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, got) => { if (!pass) fails.push({ name, got }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const geo = (scrollTo) => ev(`(() => {
  const sh = document.querySelector('.ph-sheet.open');
  if (!sh) return null;
  const p = document.getElementById('propsPanel');
  let sc = null; for (let a = p; a && a !== document.body; a = a.parentElement) if (a.scrollHeight > a.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(a).overflowY)) { sc = a; break; }
  if (!sc) return { noScroller: true };
  const max = sc.scrollHeight - sc.clientHeight;
  sc.scrollTop = ${JSON.stringify(scrollTo)} === 'end' ? max : Math.min(${JSON.stringify(scrollTo)}, max);
  const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const head = sh.querySelector(':scope > .ph-sh'), und = sh.querySelector('.ph-hundo'), x = sh.querySelector('.ph-x'), grab = sh.querySelector('.ph-grab');
  const sr = R(sc), btn = [R(und), R(x)];
  const hit = [];
  for (const c of p.querySelectorAll('button, input, select, textarea, summary, a[href], [role="button"]')) {
    if (!c.checkVisibility()) continue;
    const b = R(c);
    // (only the part inside the scroller's visible box is on the screen)
    const v = { l: Math.max(b.l, sr.l), t: Math.max(b.t, sr.t), r: Math.min(b.r, sr.r), b: Math.min(b.b, sr.b) };
    if (v.r <= v.l || v.b <= v.t) continue;
    for (const [i, bb] of btn.entries()) if (bb && v.l < bb.r - 0.5 && v.r > bb.l + 0.5 && v.t < bb.b - 0.5 && v.b > bb.t + 0.5) hit.push((i ? 'x' : 'undo') + ' x ' + (c.id ? '#' + c.id : c.tagName.toLowerCase() + '.' + String(c.className).split(' ')[0]));
  }
  return { top: sc.scrollTop, max, sheet: R(sh), head: R(head), scroller: sr, und: btn[0], x: btn[1], grab: R(grab), hit };
})()`);
const touch = async (type, x, y) => send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
for (const [lang, w, vw] of [['en', 360, 'classic'], ['ru', 360, 'classic'], ['it', 360, 'classic'], ['it', 360, 'steps'], ['en', 390, 'classic'], ['ru', 390, 'classic'], ['it', 390, 'classic'], ['en', 740, 'classic'], ['it', 740, 'classic']]) {
  const tag = `${lang} ${w} ${vw}`;
  await view(w, w === 740 ? 360 : 780, false, true);   // (740 × 360 is the landscape side panel)
  await nav(`http://localhost:${PORT}/test.html?ns=peh${lang}${w}${vw[0]}${Date.now() % 100000}${lang === 'en' ? '' : '&lang=' + lang}${vw === 'steps' ? '&view=steps' : ''}`);
  await sleep(4500);
  await ev(`(Phone.open('edit'), 1)`);
  await sleep(2000);
  for (const at of [0, 169, 'end']) {
    const g = await geo(at);
    await sleep(250);
    const k = `${tag} scrolled ${at}`;
    if (!g || g.noScroller) { ok(`${k}: the Edit sheet is open with a scroller`, false, g); continue; }
    info[k] = { top: g.top, max: g.max, hit: g.hit };
    const near = (a, b, e = 0.75) => Math.abs(a - b) <= e;
    ok(`${k}: nothing of the Inspector meets Undo or ×`, g.hit.length === 0, g.hit);
    ok(`${k}: Undo and × are 44 × 44`, near(g.und.w, 44) && near(g.und.h, 44) && near(g.x.w, 44) && near(g.x.h, 44), [g.und, g.x]);
    ok(`${k}: they are 4 px apart, Undo first`, near(g.x.l - g.und.r, 4), [g.und.r, g.x.l]);
    ok(`${k}: × is 4 px from the sheet's right edge`, near(g.sheet.r - g.x.r, 4), [g.sheet.r, g.x.r]);
    ok(`${k}: the strip is 44 px, outside the scroller`, near(g.head.h, 44) && g.head.b <= g.scroller.t + 1, [g.head, g.scroller]);
    ok(`${k}: the buttons are inside the strip`, g.und.t >= g.head.t - 0.5 && g.und.b <= g.head.b + 0.5 && g.x.t >= g.head.t - 0.5 && g.x.b <= g.head.b + 0.5, [g.head, g.und, g.x]);
    // (the side panel has no grabber)
    if (g.grab && g.grab.w > 0) ok(`${k}: the grabber's bar is centred, clear of Undo`, near((g.grab.l + g.grab.r) / 2, (g.sheet.l + g.sheet.r) / 2, 1.5) && g.grab.r <= g.und.l + 0.5, [g.grab, g.sheet, g.und]);
  }
  // a drag that starts on a button does not move the sheet
  const g0 = await geo(0);
  if (g0 && g0.x) {
    const cx = (g0.x.l + g0.x.r) / 2, cy = (g0.x.t + g0.x.b) / 2, top0 = g0.sheet.t;
    await touch('touchStart', cx, cy); await sleep(60);
    for (let i = 1; i <= 8; i++) { await touch('touchMove', cx, cy - i * 14); await sleep(30); }
    await touch('touchEnd'); await sleep(700);
    const after = await ev(`(() => { const s = document.querySelector('.ph-sheet'); return s ? s.getBoundingClientRect().top : null; })()`);
    ok(`${tag}: a drag that starts on × does not move the sheet`, after != null && Math.abs(after - top0) <= 1, [top0, after]);
  }
}
return { pass: fails.length === 0, fails, info };
