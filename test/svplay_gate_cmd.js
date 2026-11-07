// The steps view's Play waits behind the prestart (#1157 P2): with every link held (?glhold) a press starts no glide and
// marks the button busy, Esc cancels the wait, and once the links are released the pressed Play starts the glide.
// The ring and ✕ show after 300 ms, not before; after 10 s a message offers Retry and Cancel.
// A command file for a CDP daemon:  <runner> test/svplay_gate_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1440, 900, false);
const ns = 'svg' + Date.now();
await load(ns, {});
await ev('(__cmwExample(1), 1)');
const base = await ev('location.origin');
await nav(`${base}/test.html?ns=${ns}&glhold&view=steps`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && typeof GLR === "object" && GLR.ok && __cmwSteps().on' });
await ev('(__cmwSteps({ go: 0, now: true }), 1)');
await settled({ max: 30000, only: true, until: '__cmwSteps().ready.total > 0' });
await ev('(__cmwSteps({ play: true }), 1)');
const early = await ev('!!document.querySelector(".sv-play[aria-busy]")');
ok('under 300 ms: no ring', early === false, early);
await settled({ max: 3000, only: true, until: '!!document.querySelector(".sv-play[aria-busy]")' });
const waiting = await ev('({ play: __cmwSteps().play, busy: !!document.querySelector(".sv-play[aria-busy]"), label: document.querySelector(".sv-play").getAttribute("aria-label"), ring: document.querySelector(".sv-play").style.getPropertyValue("--wait") })');
info.waiting = waiting;
ok('held: the ✕ is labelled Cancel and the ring has a fill', waiting.label === 'Cancel' && waiting.ring !== '', waiting);
ok('held: a press starts no glide', waiting.play === null, waiting);
ok('held: the button is busy', waiting.busy === true, waiting);
await ev('(document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })), 1)');
const esc = await ev('({ play: __cmwSteps().play, busy: !!document.querySelector(".sv-play[aria-busy]") })');
info.esc = esc;
ok('Esc cancels the wait', esc.play === null && esc.busy === false, esc);
await ev('(__cmwSteps({ play: true }), 1)');
await settled({ max: 14000, only: true, until: '!!document.querySelector("#toastHost .toast")' });
const hung = await ev('Array.from(document.querySelectorAll("#toastHost .toast button")).map((b) => b.textContent)');
info.hung = hung;
ok('after 10 s: the message offers Retry and Cancel', hung.includes('Retry') && hung.includes('Cancel'), hung);
await ev('(GLR.holdLinks(false), 1)');
await settled({ max: 40000, only: true, until: '__cmwSteps().play !== null' });
const run = await ev('({ play: __cmwSteps().play, ready: __cmwSteps().ready.ready, busy: !!document.querySelector(".sv-play[aria-busy]") })');
info.run = run;
ok('released: the glide starts', run.play === 'glide', run);
ok('released: the button is no longer busy', run.busy === false, run);
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
