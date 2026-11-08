// The steps view's glides wait behind the prestart (#1157): with every link held (?glhold) a press of Play or an arrow
// starts no glide and marks that button busy (a ring over a faint track, after 300 ms and not before), Esc or the button
// again cancels the wait, after 10 s a message offers Retry (which keeps the ring) and Cancel, and once the links are
// released the pressed glide starts. Run at 1440 px and at 360 px, and under reduced motion.
// A command file for a CDP daemon:  <runner> test/svplay_gate_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const BUSY = '!!document.querySelector(".sv-play[aria-busy]")';
const state = (sel) => `(() => { const b = document.querySelector("${sel}"); return { busy: b.hasAttribute("aria-busy"), label: b.getAttribute("aria-label"), fill: b.style.getPropertyValue("--wait"), play: __cmwSteps().play, anim: !!__cmwSteps().anim, ring: getComputedStyle(b, "::after").backgroundImage.includes("conic-gradient"), spin: getComputedStyle(b, "::after").animationName }; })()`;
const esc = () => ev('(document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })), 1)');
const ns = 'svg' + Date.now();
// window.__played turns true when a play starts. The Play button changes in the same task that starts it, so a mutation
// observer sees the start even when the first frames of a cold page run so long that a short play ends before a timer
// could poll it
const WATCH_PLAY = `(window.__played = false, new MutationObserver((_, o) => { if (__cmwSteps().play !== null) { window.__played = true; o.disconnect(); } }).observe(document.querySelector(".sv-play"), { attributes: true, childList: true, subtree: true }))`;


async function open(w, h, lang = '') {
  await view(w, h, false);
  await load(ns, {});
  await ev('(__cmwExample(1), 1)');
  const o = await ev('location.origin');
  await nav(`${o}/test.html?ns=${ns}&glhold&view=steps${lang ? '&lang=' + lang : ''}`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && typeof GLR === "object" && GLR.ok && __cmwSteps().on' });
  await ev('(__cmwSteps({ go: 0, now: true }), 1)');
  await settled({ max: 30000, only: true, until: '__cmwSteps().ready.total > 0' });
}

async function section(tag, w, h) {
  await open(w, h);
  // Play
  await ev('(__cmwSteps({ play: true }), 1)');
  ok(`${tag} under 300 ms: no ring`, (await ev(BUSY)) === false);
  await settled({ max: 3000, only: true, until: BUSY });
  const wait = await ev(state('.sv-play'));
  info[tag + 'Wait'] = wait;
  ok(`${tag} held: a press starts no glide`, wait.play === null && !wait.anim, wait);
  ok(`${tag} held: the button is Cancel with a ring and a fill`, wait.busy && wait.label === 'Cancel' && wait.fill !== '' && wait.ring, wait);
  ok(`${tag} the ring does not spin`, wait.spin === 'none', wait);
  await esc();
  const cancelled = await ev(state('.sv-play'));
  ok(`${tag} Esc cancels the wait`, !cancelled.busy && cancelled.play === null && cancelled.label === 'Play', cancelled);
  // the arrow
  await ev('(document.querySelector(".sv-next").click(), 1)');
  await settled({ max: 3000, only: true, until: '!!document.querySelector(".sv-next[aria-busy]")' });
  const arrow = await ev(state('.sv-next'));
  info[tag + 'Arrow'] = arrow;
  ok(`${tag} an arrow waits too: no glide, its ring`, arrow.busy && arrow.label === 'Cancel' && !arrow.anim && arrow.ring, arrow);
  await ev('(document.querySelector(".sv-next").click(), 1)');
  const again = await ev(state('.sv-next'));
  ok(`${tag} the arrow again cancels, and its label returns`, !again.busy && again.label === 'Next plane' && !again.anim, again);
  return;
}

await section('wide', 1440, 900);

// the Landscape steps a plane at a time with no frames between planes: an arrow waits for nothing, however much is
// unprepared, and a press of Play still waits
await open(1440, 900);
await ev('(__cmwSteps({ surf: "land" }), 1)');
await ev('(document.querySelector(".sv-next").click(), 1)');
await ev('new Promise((r) => setTimeout(() => r(1), 600))');
const landArrow = await ev(state('.sv-next'));
ok('Landscape: an arrow waits for nothing', !landArrow.busy, landArrow);
await ev('(__cmwSteps({ play: true }), 1)');
await settled({ max: 3000, only: true, until: BUSY });
const landPlay = await ev(state('.sv-play'));
ok('Landscape: a press of Play still waits', landPlay.busy && landPlay.play === null, landPlay);
await ev('(__cmwSteps({ play: false }), 1)');
await ev('(__cmwSteps({ play: false, surf: "plane" }), 1)');

// 10 s: Retry keeps the ring, Cancel ends it, a release starts the glide
await ev('(__cmwSteps({ play: true }), 1)');
await settled({ max: 14000, only: true, until: '!!document.querySelector("#toastHost .toast")' });
const hung = await ev('Array.from(document.querySelectorAll("#toastHost .toast button")).map((b) => b.textContent)');
info.hung = hung;
ok('after 10 s: the message offers Retry and Cancel', hung.includes('Retry') && hung.includes('Cancel'), hung);
await ev('(Array.from(document.querySelectorAll("#toastHost .toast button")).find((b) => b.textContent === "Retry").click(), 1)');
const retry = await ev(state('.sv-play'));
info.retry = retry;
ok('Retry keeps the ring with no gap', retry.busy && retry.ring && retry.label === 'Cancel', retry);
await ev(`(${WATCH_PLAY}, 1)`);
await ev('(GLR.holdLinks(false), 1)');
await settled({ max: 40000, only: true, until: 'window.__played === true' });
const run = await ev(state('.sv-play'));
info.run = run;
ok('released: the glide starts', await ev('window.__played'), run);
ok('released: the button is no longer busy', !run.busy, run);

await section('narrow', 360, 780);

// the 10 s message at 360 px, in English and Russian: the words on a row of their own and Retry, Cancel and the close
// button together on the row below (the toast two rows tall, not three), inside the viewport
// (the toast's most: its padding (6 + 6), the words on two lines of 18 px (Italian at 360 px), one row of 44 px buttons; the
// measured heights are 74-76 px. HANG_WAIT_MS: the hang guard's 10 s and the poll's slack; ROW_EDGE_PX: a layout rounds a
// rect's edge to a pixel, so the buttons' top may sit that far above the words' bottom)
const GATE_TOAST_PAD = 12, GATE_TOAST_WORDS_MAX = 2 * 18, GATE_TOAST_BUTTON_ROW = 44, GATE_HANG_WAIT_MS = 14000, ROW_EDGE_PX = 1;
for (const lang of ['en', 'ru']) {
  await open(360, 780, lang);
  await ev('(__cmwSteps({ play: true }), 1)');
  await settled({ max: GATE_HANG_WAIT_MS, only: true, until: '!!document.querySelector("#toastHost .toast")' });
  const gt = await ev(`(() => { const t = document.querySelector('#toastHost .toast'), r = t.getBoundingClientRect(), w = t.querySelector('span').getBoundingClientRect(); const tops = [...t.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top)); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), wordsBottom: Math.round(w.bottom), tops: [...new Set(tops)], vw: innerWidth, vh: innerHeight }; })()`);
  info['gateToast_' + lang] = gt;
  ok(`narrow ${lang}: the 10 s message keeps its buttons on one row`, gt.tops.length === 1, gt);
  ok(`narrow ${lang}: the buttons are below the words`, gt.tops[0] >= gt.wordsBottom - ROW_EDGE_PX, gt);
  ok(`narrow ${lang}: the message is two rows (words, buttons) and inside the viewport`, gt.bottom - gt.top <= GATE_TOAST_PAD + GATE_TOAST_WORDS_MAX + GATE_TOAST_BUTTON_ROW && gt.left >= 0 && gt.right <= gt.vw && gt.bottom <= gt.vh, gt);
}

// the idle jobs (pole tracks, ring, meshes) are part of the wait: with the programs linked and the warm draw made but a
// job left, a press of Play starts nothing; when the job is done the glide starts
{
  const ns2 = 'svj' + Date.now();
  await view(1440, 900, false);
  await load(ns2, {});
  await ev('(__cmwExample(1), 1)');
  const o = await ev('location.origin');
  await nav(`${o}/test.html?ns=${ns2}&view=steps`);
  await settled({ max: 60000, only: true, until: 'typeof __cmwSteps === "function" && typeof GLR === "object" && GLR.ok && __cmwSteps().on && __cmwSteps().ready.ready' });
  await ev('(__cmwSteps({ go: 0, now: true, holdJobs: true }), 1)');
  await ev('(__cmwSteps({ play: true }), 1)');
  // (the wait's ring shows after 300 ms: the press is being held)
  await settled({ max: 10000, only: true, until: BUSY });
  const held = await ev(state('.sv-play'));
  info.jobsHeld = held;
  ok('a job left: a press of Play starts no glide', held.play === null && !held.anim, held);
  ok('a job left: the wait is under way', await ev('__cmwSteps().moving'), held);
  await ev(`(${WATCH_PLAY}, 1)`);
  await ev('(__cmwSteps({ holdJobs: false }), 1)');
  await settled({ max: 20000, only: true, until: 'window.__played === true' });
  ok('the job done: the glide starts', await ev('window.__played'), held);
}

const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
