// The sound suites' shared helpers (test/lib/sound_kit.js): each is there, and each does what the suites that use it expect, with stubs
// for the page. A helper a suite needs and the kit lacks fails here by name.
//   node test/t_sound_kit.js
const fs = require('fs');
const path = require('path');

const KIT = path.join(__dirname, 'lib', 'sound_kit.js');
const NAMES = ['W', 'snd', 'circle', 'spy', 'made', 'hearInject', 'start', 'harpLoop'];
const A0_DEFAULT = 0.4, ARC_TOL = 1e-9, POINTS = (turns, n) => n * turns + 1;
let bad = 0, n = 0;
const ok = (name, cond, got) => { n++; if (!cond) { bad++; console.log('FAIL ' + name + (got === undefined ? '' : ': ' + JSON.stringify(got))); } };

(async () => {
  const log = [];
  const deps = {
    ev: async (e) => { log.push(['ev', e]); return e.includes('__cmwSound()') ? { phi: log.length } : e.includes('__hearCount') ? { up: 0, down: 0 } : e.includes('__cmwW2S') ? [0, 0] : 1; },
    send: async (m, p) => { log.push(['send', m, p]); return { identifier: 'x' }; },
    sleep: async () => {}, settled: async () => {}, move: async () => {}, click: async (x, y) => { log.push(['click', x, y]); },
    loadHere: async (ns, st) => { log.push(['loadHere', ns, st]); }, settle: async () => { log.push(['settle']); }, glide: async () => {},
    ns: 'sndkit', fn: (expr) => ({ expr }),
  };
  ok('the kit file exists', fs.existsSync(KIT), KIT);
  if (!fs.existsSync(KIT)) { console.log(n - bad + '/' + n + ' passed'); process.exit(1); }
  const kit = eval(fs.readFileSync(KIT, 'utf8'))(deps);
  for (const k of NAMES) ok('the kit has ' + k, typeof kit[k] === 'function', typeof kit[k]);
  const pts = [];
  const k2 = eval(fs.readFileSync(KIT, 'utf8'))(Object.assign({}, deps, { ev: async (e) => { const m = /__cmwW2S\('L', ([^,]+), ([^)]+)\)/.exec(e); if (m) { pts.push([+m[1], +m[2]]); return pts[pts.length - 1]; } return deps.ev(e); } }));
  const c = [0.5, -0.25], r = 2, turns = 2, steps = 8;
  const out = await k2.circle(c, r, turns, steps);
  ok('circle: n·turns + 1 points', out.length === POINTS(turns, steps), out.length);
  ok('circle: the first point is at a0 = 0.4 on the circle', Math.abs(pts[0][0] - (c[0] + r * Math.cos(A0_DEFAULT))) < ARC_TOL && Math.abs(pts[0][1] - (c[1] + r * Math.sin(A0_DEFAULT))) < ARC_TOL, pts[0]);
  ok('circle: it closes after a lap', Math.abs(pts[steps][0] - pts[0][0]) < ARC_TOL && Math.abs(pts[steps][1] - pts[0][1]) < ARC_TOL, [pts[0], pts[steps]]);
  log.length = 0; await kit.spy(); await kit.made();
  ok('spy wraps the catalogue; made reads and clears the list', log.length === 2 && /Sound\.CATALOG/.test(log[0][1]) && /__made\.length = 0/.test(log[1][1]), log);
  log.length = 0; await kit.hearInject();
  ok('hearInject installs __hearCount for every new document', log.length === 1 && log[0][1] === 'Page.addScriptToEvaluateOnNewDocument' && /window\.__hearCount = /.test(log[0][2].source), log);
  log.length = 0; await kit.start('z');
  ok('start loads the state, settles, clicks the page, turns sound on and spies', log[0][0] === 'loadHere' && log[0][1] === 'sndkit' && JSON.stringify(log[0][2]) === JSON.stringify({ expr: 'z' }) && log.some((l) => l[0] === 'click' && l[1] === 5 && l[2] === 300) && log.some((l) => l[0] === 'ev' && /Sound\.set\(\{ on: true/.test(l[1])) && log.some((l) => l[0] === 'ev' && /Sound\.CATALOG/.test(l[1])), log.map((l) => l[0]));
  const h = await kit.harpLoop([0, 0], 1, 1);
  ok('harpLoop returns the turn and the notes', 'dphi' in h && 'harp' in h && Number.isFinite(h.dphi), h);
  console.log(n - bad + '/' + n + ' passed');
  process.exit(bad ? 1 : 0);
})();
