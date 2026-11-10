'use strict';
// Builds and runs dist/glsl-dh-polish.html (test/glsl_dh_polish_test.js) in headless Chrome and prints window.__dhPolish.
// Run: node test/glsl_dh_orbit_run.js   (CHROME_BIN, CMW_ANGLE and CMW_CHROME_ARGS as for ci/glsl.js)
const path = require('path');
const { ROOT, PY, serve, run } = require('../ci/lib');
const { launch, sleep } = require('./regress/perf/cdp');
(async () => {
  if (run(PY, ['test/make_glsl_dh_polish.py'], { cwd: ROOT }) !== 0) process.exit(2);
  const srv = await serve(path.join(ROOT, 'dist'));
  const B = await launch({ width: 1200, height: 800 });
  let r;
  try {
    await B.nav(srv.base + 'glsl-dh-polish.html');
    for (let i = 0; i < 1200 && !(await B.ev('window.__dhPolish && window.__dhPolish.done')) && !B.logs().some((l) => l.t === 'EXC'); i++) await sleep(500);
    r = await B.ev('JSON.stringify(window.__dhPolish)'); if (process.env.DH_LOGS) console.log(B.logs().slice(0, 10));
  } finally { await B.close(); srv.server.close(); }
  const o = JSON.parse(r || '{"errors":["page exception"]}');
  console.log(JSON.stringify(o, null, 1));
  
  process.exit(0);
})();
