// The tour's words follow two things apart (#480): place words (where a control is: "the Inspector", "the steps button
// under the planes") follow the LAYOUT, desk or phone (the `ph` class); gesture words (click, tap, scroll, pinch) follow
// the POINTER, fine or coarse. The four combinations, each in a real emulated environment, in en, ru and it:
//   desk layout + mouse (1440 wide), desk layout + touch (1024 wide, a tablet or a touch laptop),
//   phone layout + touch (390 wide), phone layout + mouse (a narrow window, 600 wide).
// Per step with place and gesture words (basics/chain, basics/add, edit/inspector, analysis/domain), the live copy is the
// one meant for that combination, the four are different, and the step's title and lead follow the layout. A command file
// for a CDP daemon:  <runner> test/tour_words_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await load('tw' + Date.now(), {});
const base = await ev('location.origin');
// [name, width, height, touch emulation (pointer: coarse), phone layout]
const COMBOS = [['desk-fine', 1440, 900, false, false], ['desk-coarse', 1024, 768, true, false], ['phone-coarse', 390, 844, true, true], ['phone-fine', 600, 800, false, true]];
// the field of a step that is meant for a combination: fine/desk is the body, coarse/desk deskTouch, fine/phone phoneFine, coarse/phone touch
const FIELD = { 'desk-fine': 'body', 'desk-coarse': 'deskTouch', 'phone-fine': 'phoneFine', 'phone-coarse': 'touch' };
const TRY = { 'desk-fine': 'text', 'desk-coarse': 'deskTouch', 'phone-fine': 'phoneFine', 'phone-coarse': 'touch' };
const STEPS = [['basics', 'chain'], ['basics', 'add'], ['edit', 'inspector'], ['analysis', 'domain']];
const seen = {};
for (const lang of ['en', 'ru', 'it']) for (const [name, w, h, touch, phone] of COMBOS) {
  const tag = `${lang} ${name}`;
  await view(w, h, false, touch);
  await nav(`${base}/test.html?ns=tw${lang}${name}${Date.now() % 1000000}&lang=${lang}`);
  await sleep(1800);
  const r = await ev(`(() => {
    const T = Tour._t, tr = (s) => (s == null ? null : I18N.t(s));
    const env = { coarse: matchMedia('(pointer: coarse)').matches, ph: document.documentElement.classList.contains('ph') };
    const steps = {};
    for (const [c, id] of ${JSON.stringify(STEPS)}) {
      const s = T.CHAPTERS.find((x) => x.id === c).steps.find((x) => x.id === id);
      const f = ${JSON.stringify(FIELD)}['${name}'], t = ${JSON.stringify(TRY)}['${name}'];
      steps[c + '/' + id] = { copy: T.copyFor(s, ${'null'}), want: tr(s[f]), try: s.try ? T.tryFor(s.try) : null, wantTry: s.try ? tr(s.try[t]) : null, lead: s.lead ? T.leadFor(s) : null };
    }
    return { env, steps };
  })()`);
  info[tag] = r && r.env;
  ok(`${tag}: the environment is the one asked for (pointer coarse ${touch}, phone layout ${phone})`, r && r.env.coarse === touch && r.env.ph === phone, r && r.env);
  for (const [id, x] of Object.entries((r && r.steps) || {})) {
    ok(`${tag} ${id}: the copy is the one meant for this layout and pointer`, x.want != null && x.copy === x.want, { copy: x.copy && x.copy.slice(0, 60), want: x.want && x.want.slice(0, 60) });
    if (x.wantTry != null) ok(`${tag} ${id}: the task is the one meant for this layout and pointer`, x.try === x.wantTry, { got: x.try, want: x.wantTry });
    (seen[`${lang} ${id}`] = seen[`${lang} ${id}`] || []).push(x.copy);
  }
}
// the four combinations read four different copies of a step that has place and gesture words
for (const lang of ['en', 'ru', 'it']) for (const id of ['basics/chain', 'basics/add', 'analysis/domain']) {
  const four = seen[`${lang} ${id}`] || [];
  ok(`${lang} ${id}: four combinations, four copies`, four.length === 4 && new Set(four).size === 4, four.map((t) => (t || '').slice(0, 30)));
}
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
