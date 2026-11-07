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

async function open(w, h) {
  await view(w, h, false);
  await load(ns, {});
  await ev('(__cmwExample(1), 1)');
  const o = await ev('location.origin');
  await nav(`${o}/test.html?ns=${ns}&glhold&view=steps`);
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
// (a play on a short chain can end between two polls from here: the page records that it started)
await ev('(window.__played = false, window.__playPoll = setInterval(() => { if (__cmwSteps().play !== null) { window.__played = true; clearInterval(window.__playPoll); } }, 5), 1)');
await ev('(GLR.holdLinks(false), 1)');
await settled({ max: 40000, only: true, until: 'window.__played === true' });
const run = await ev(state('.sv-play'));
info.run = run;
ok('released: the glide starts', await ev('window.__played'), run);
ok('released: the button is no longer busy', !run.busy, run);

await section('narrow', 360, 780);

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
  await ev('await new Promise((r) => setTimeout(r, 1500)), 1');
  const held = await ev(state('.sv-play'));
  info.jobsHeld = held;
  ok('a job left: a press of Play starts no glide', held.play === null && !held.anim, held);
  ok('a job left: the wait is under way', await ev('__cmwSteps().moving'), held);
  await ev('(window.__played = false, window.__playPoll = setInterval(() => { if (__cmwSteps().play !== null) { window.__played = true; clearInterval(window.__playPoll); } }, 5), 1)');
  await ev('(__cmwSteps({ holdJobs: false }), 1)');
  await settled({ max: 20000, only: true, until: 'window.__played === true' });
  ok('the job done: the glide starts', await ev('window.__played'), held);
}

const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
