// The walk shared by test/tour_words_cmd.js (the steps view's tour) and test/tour_words_classic_cmd.js (the classic views' tour):
// for each language and each of the four environments (desk or phone layout, fine or coarse pointer) the page is opened in
// that environment, and for each step in `steps` ([chapter id, step id]) the live copy and task are the ones meant for it.
// A suite evals this file and gets { run }.
//   run({ ev, go, settled, isSteps, view, logs, base, steps, fourCopies, wantSteps })  -> { pass, nfails, fails, info }
//   steps       the steps checked in every environment
//   fourCopies  the step ids (chapter/step) whose four environments must read four different copies
//   wantSteps   true when the page must be in the steps view, false when it must be in the classic view
(() => {
  // [name, width, height, touch emulation (pointer: coarse), phone layout]
  const COMBOS = [['desk-fine', 1440, 900, false, false], ['desk-coarse', 1024, 768, true, false], ['phone-coarse', 390, 844, true, true], ['phone-fine', 600, 800, false, true]];
  // the field of a step that is meant for a combination: fine/desk is the body, coarse/desk deskTouch, fine/phone phoneFine, coarse/phone touch
  const FIELD = { 'desk-fine': 'body', 'desk-coarse': 'deskTouch', 'phone-fine': 'phoneFine', 'phone-coarse': 'touch' };
  const TRY = { 'desk-fine': 'text', 'desk-coarse': 'deskTouch', 'phone-fine': 'phoneFine', 'phone-coarse': 'touch' };
  const run = async ({ ev, go, settled, isSteps, view, logs, base, steps, fourCopies, wantSteps }) => {
    const fails = [], info = {};
    const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
    const seen = {};
    for (const lang of ['en', 'ru', 'it']) for (const [name, w, h, touch, phone] of COMBOS) {
      const tag = `${lang} ${name}`;
      await view(w, h, false, touch);
      await go(`${base}/test.html?ns=tw${lang}${name}${Date.now() % 1000000}&lang=${lang}`);
      await settled({ until: `typeof Tour === 'object' && typeof I18N === 'object' && I18N.lang === '${lang}'` });
      const sv = await isSteps();
      if (sv !== wantSteps) return { pass: false, nfails: 1, fails: [{ name: `the page is not in the ${wantSteps ? 'steps' : 'classic'} view (the suite's tag in ci/suite_views.js)`, got: { sv } }], info };
      const r = await ev(`(() => {
        const T = Tour._t, tr = (s) => (s == null ? null : I18N.t(s));
        const env = { coarse: matchMedia('(pointer: coarse)').matches, ph: document.documentElement.classList.contains('ph') };
        const out = {};
        for (const [c, id] of ${JSON.stringify(steps)}) {
          const ch = T.CHAPTERS.find((x) => x.id === c), s = ch && ch.steps.find((x) => x.id === id);
          if (!s) { out[c + '/' + id] = null; continue; }
          const f = ${JSON.stringify(FIELD)}['${name}'], t = ${JSON.stringify(TRY)}['${name}'];
          out[c + '/' + id] = { copy: T.copyFor(s, null), want: tr(s[f]), try: s.try ? T.tryFor(s.try) : null, wantTry: s.try ? tr(s.try[t]) : null, lead: s.lead ? T.leadFor(s) : null };
        }
        return { env, steps: out };
      })()`);
      info[tag] = r && r.env;
      ok(`${tag}: the environment is the one asked for (pointer coarse ${touch}, phone layout ${phone})`, r && r.env && r.env.coarse === touch && r.env.ph === phone, r && r.env);
      for (const [id, x] of Object.entries((r && r.steps) || {})) {
        ok(`${tag} ${id}: the step is in this tour`, !!x, id);
        if (!x) continue;
        ok(`${tag} ${id}: the copy is the one meant for this layout and pointer`, x.want != null && x.copy === x.want, { copy: x.copy && x.copy.slice(0, 60), want: x.want && x.want.slice(0, 60) });
        if (x.wantTry != null) ok(`${tag} ${id}: the task is the one meant for this layout and pointer`, x.try === x.wantTry, { got: x.try, want: x.wantTry });
        (seen[`${lang} ${id}`] = seen[`${lang} ${id}`] || []).push(x.copy);
      }
    }
    // the four combinations read four different copies of a step that has place and gesture words
    for (const lang of ['en', 'ru', 'it']) for (const id of fourCopies) {
      const four = seen[`${lang} ${id}`] || [];
      ok(`${lang} ${id}: four combinations, four copies`, four.length === 4 && new Set(four).size === 4, four.map((t) => (t || '').slice(0, 30)));
    }
    const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
    ok('no console errors', exc.length === 0, exc.slice(0, 4));
    return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };
  };
  return { run };
})()
