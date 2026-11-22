// While a play or a glide waits for its programs (svLinkHold), the picture stays at the held place, and what describes the
// thread stays with it: the scrubber's spoken value (aria-valuetext) says the held place, its thumb stands there, and in a
// play the head and the live region name the plane the picture shows. None of them changes for the whole wait, and once
// the links land none goes back; the one exception is the gate's words in the live region (a play's hold that lasts
// SV_GATE_SHOW_MS says "Preparing the glide…", once, and the play's words as it ends: test/steps_late_links_cmd.js). z + 1/z, then z⁴ + z, on pages whose links land SECOND_LINK_MS late (test/lib/late_links.js),
// the motion's time PLAY_STEP_MS a frame (__cmwSteps({ clock })): ▶ from plane z, held for the programs of each glide, and a
// glide from plane 2 to plane z, held the same way. After every animation frame the page records the thread's place and
// the four readouts; the spoken value is checked against the place by the scrubber's own wording (svReadout).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const names = exampleNames();
// (z + 1/z)
const POLE_EX = 'Cauchy: a regular part and a pole';
// ms a link reads not complete; the motion's time (ms) each frame adds; the waits (ms) for a page and a motion; the frames
// in a row the thread stays put that make a hold
const SECOND_LINK_MS = 15000, PLAY_STEP_MS = 47, READY_MS = 60000, PLAY_MS = 180000, STILL_FRAMES = 3;
// the place within which the scrubber calls the thread a plane, svReadout's (read from the app's source)
const SV_REST_U = +(/const SV_REST_U = ([0-9.e-]+)/.exec(fs.readFileSync(path.join(DIR, '..', '..', 'src', 'app', '19-steps-view.js'), 'utf8')) || [])[1];
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const PREPARING = 'Preparing the glide…';
const svName = (k) => (k === 0 ? 'z' : 'w' + String(k).split('').map((d) => SUB[+d]).join(''));
// the scrubber's spoken value at place x of a chain of n planes 0, 1, …, n − 1 (svReadout, in English, no range, no d/dz)
const said = (x, n) => {
  const r = Math.round(x);
  if (Math.abs(x - r) <= SV_REST_U) return `Plane ${svName(r)}, ${r + 1} of ${n}`;
  const a = Math.floor(x);
  return `Step ${a + 1} of ${n - 1} · f${svName(a + 1).slice(1)} · ${Math.round(100 * (x - a))} %`;
};
await view(1280, 800, false);
const loaded = 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR';
const slow = await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lateLinkMs = ${SECOND_LINK_MS};\n` + fs.readFileSync(path.join(DIR, '..', 'lib', 'late_links.js'), 'utf8') });
// a fresh page with z + 1/z, then z⁴ + z, Everywhere, sheets off
const chain = async (ns) => {
  await go(`${BASE}/test.html?ns=${ns}${Date.now()}&lang=en&view=steps`);
  await settled({ max: READY_MS, until: loaded });
  await ev(`__cmwExample(${names.indexOf(POLE_EX)}), 1`);
  await settled({ max: READY_MS, until: '__cmwSteps().adopted && !__cmwSteps().moving' });
  await ev(`__cmwSet('sheets', false), __cmwSteps({ bare: true, scope: 'all', gate: false }), 1`);
  await ev("__cmwAddStep('custom', { expr: 'z^4+z', cut: 180 }, 1), 1");
  await settled({ max: READY_MS, until: '__cmwSteps().planes.length === 3' });
};
// in the page, from now on: after every animation frame, the thread's place and the readouts (the scrubber's spoken value
// and its thumb's offset, the head's plane, the live region), and the frames in a row the place has stayed put
const record = () => ev(`(() => {
  const s = window.__hr = { rows: [], still: 0, last: __cmwSvX(), done: false };
  // (the steps view's live region: the polite one the view puts in #stage)
  const thumb = document.querySelector('.sv-thumb'), title = document.querySelector('.sv-title'), live = document.querySelector('#stage > .sr-only[aria-live="polite"]');
  const tick = () => setTimeout(() => {
    const x = __cmwSvX(), m = /translateX\\((-?[0-9.]+)px\\)/.exec(thumb.style.transform || '');
    s.still = x === s.last ? s.still + 1 : 0; s.last = x;
    s.rows.push({ x, vt: thumb.getAttribute('aria-valuetext'), tx: m ? +m[1] : null, head: (title.textContent.split(' · ')[0] || '').trim(), live: live ? live.textContent : null });
    if (!s.done) requestAnimationFrame(tick);
  }, 0);
  requestAnimationFrame(tick);
  return !!live; })()`);
const rows = () => ev('(() => { const s = window.__hr; s.done = true; return s.rows; })()');
// the frames of a recording where the thread stayed put STILL_FRAMES or more in a row, between its first and last frames:
// the holds, [first, last] each
const holds = (r) => {
  const out = [];
  let i0 = 0;
  for (let i = 1; i <= r.length; i++) {
    if (i < r.length && r[i].x === r[i - 1].x) continue;
    if (i - i0 >= STILL_FRAMES && i0 > 0 && i < r.length) out.push([i0, i - 1]);
    i0 = i;
  }
  return out;
};
// the readouts of the frames of a recording that disagree with the place drawn: the spoken value, and (play) the head's
// plane and the live region's ("Plane w₁, 2 of 3, …")
const wrong = (r, play) => r.map((e, i) => {
  const bad = [];
  if (e.vt !== said(e.x, 3)) bad.push(`vt ${e.vt} (${said(e.x, 3)})`);
  if (play) {
    const k = Math.round(e.x), hn = svName(k).replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d)));
    if (e.head !== hn) bad.push(`head ${e.head} (${hn})`);
    const lv = /^Plane (\S+), /.exec(e.live || '');
    if (lv && lv[1] !== svName(k)) bad.push(`live ${e.live} (${svName(k)})`);
  }
  return bad.length ? { i, x: e.x, bad } : null;
}).filter(Boolean);
// the steps that go back against the motion's direction (dir +1 forward, −1 back), in the thumb's offset and in the spoken
// value's place, over the frames after the first hold
const backs = (r, dir, from) => {
  const out = [];
  for (let i = from + 1; i < r.length; i++) {
    const a = r[i - 1], b = r[i];
    if (a.tx != null && b.tx != null && dir * (b.tx - a.tx) < -0.5) out.push({ i, tx: [a.tx, b.tx], vt: [a.vt, b.vt] });
  }
  return out;
};
try {
  // ---- ▶ from plane z: held for each glide's programs, then on to plane 2
  await chain('hrp');
  const liveOk = await record();
  await ev(`__cmwSteps({ clock: ${PLAY_STEP_MS} }), __cmwSteps({ play: true }), 1`);
  const end = await settled({ only: true, max: PLAY_MS, until: '__cmwSvX() === 2 && !__cmwSteps().play' });
  const r = await rows();
  const h = holds(r), bad = wrong(r, true), heldBad = bad.filter((b) => h.some(([i0, i1]) => b.i >= i0 && b.i <= i1));
  const gates = (c) => c.k === 'live' && (c.from === PREPARING || c.to === PREPARING);
  const moved = h.map(([i0, i1]) => ({ x: r[i0].x, frames: i1 - i0 + 1, changes: r.slice(i0, i1 + 1).map((e, j, a) => (j ? ['vt', 'tx', 'head', 'live'].filter((k) => e[k] !== a[j - 1][k]).map((k) => ({ j, k, from: a[j - 1][k], to: e[k] })) : [])).flat() }));
  const back = h.length ? backs(r, 1, h[0][0]) : [];
  info.play = { end, frames: r.length, holds: moved, bad: bad.slice(0, 6), back: back.slice(0, 4), liveOk };
  ok('play: the live region is found (control)', liveOk, liveOk);
  ok('play: it is held at least once while its links land late, and reaches plane 2 (control)', end.ok && h.length > 0 && h.some(([i0]) => r[i0].x > 0.3), { end, holds: moved });
  ok('play: while held, the spoken value, the head and the live region describe the place the picture is held at', heldBad.length === 0, heldBad.slice(0, 6));
  ok('play: while held, none of the readouts changes, but the live region says the gate\'s words once and the play\'s as it ends', moved.every((m) => m.changes.filter((c) => !gates(c)).length === 0 && m.changes.filter(gates).length <= 2), moved);
  ok('play: on every frame, the spoken value, the head and the live region describe the place drawn', bad.length === 0, bad.slice(0, 6));
  ok('play: after a hold the thumb never goes back', back.length === 0, back.slice(0, 4));
  // ---- a glide from plane 2 to plane z: held for each glide's programs
  await chain('hrg');
  await ev(`__cmwSteps({ go: 2, now: true }), 1`);
  await settled({ max: READY_MS, until: '__cmwSvX() === 2 && !__cmwSteps().moving' });
  await record();
  await ev(`__cmwSteps({ clock: ${PLAY_STEP_MS} }), __cmwSteps({ go: 0 }), 1`);
  const end2 = await settled({ only: true, max: PLAY_MS, until: '__cmwSvX() === 0 && !__cmwSteps().anim' });
  const g = await rows();
  const gh = holds(g), gbad = wrong(g, false), gheldBad = gbad.filter((b) => gh.some(([i0, i1]) => b.i >= i0 && b.i <= i1));
  const gmoved = gh.map(([i0, i1]) => ({ x: g[i0].x, frames: i1 - i0 + 1, changes: g.slice(i0, i1 + 1).map((e, j, a) => (j ? ['vt', 'tx'].filter((k) => e[k] !== a[j - 1][k]).map((k) => ({ j, k, from: a[j - 1][k], to: e[k] })) : [])).flat() }));
  const gback = gh.length ? backs(g, -1, gh[0][0]) : [];
  info.glide = { end: end2, frames: g.length, holds: gmoved, bad: gbad.slice(0, 6), back: gback.slice(0, 4) };
  ok('glide 2 → z: it is held at least once while its links land late, and reaches plane z (control)', end2.ok && gh.length > 0, { end: end2, holds: gmoved });
  ok('glide 2 → z: while held, the spoken value describes the place the picture is held at', gheldBad.length === 0, gheldBad.slice(0, 6));
  ok('glide 2 → z: while held, the spoken value and the thumb do not change', gmoved.every((m) => m.changes.length === 0), gmoved);
  ok('glide 2 → z: on every frame, the spoken value describes the place drawn', gbad.length === 0, gbad.slice(0, 6));
  ok('glide 2 → z: after a hold the thumb never goes back', gback.length === 0, gback.slice(0, 4));
} finally {
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: slow.identifier });
}
return { pass: fails.length === 0, fails, info };
