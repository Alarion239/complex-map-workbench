#!/usr/bin/env node
// q.sh for any platform: node test/<you>_cdp/q.js <file.js | -> runs the body in this folder's CDP daemon (cdpd.js)
// and prints the JSON result (Q_TIMEOUT: seconds to wait, default 300)
const fs = require('fs');
const path = require('path');
const Q = path.join(__dirname, 'q');
const n = Math.max(0, ...fs.readdirSync(Q).filter((f) => /^\d+\.js$/.test(f)).map((f) => parseInt(f, 10))) + 1;
const body = process.argv[2] === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(process.argv[2], 'utf8');
fs.writeFileSync(path.join(Q, n + '.tmp'), body);
fs.renameSync(path.join(Q, n + '.tmp'), path.join(Q, n + '.js'));
const out = path.join(Q, n + '.out'), fatal = path.join(Q, 'FATAL');
const t0 = Date.now();
(function poll() {
  if (fs.existsSync(out)) { process.stdout.write(fs.readFileSync(out, 'utf8') + '\n'); process.exit(0); }
  if (fs.existsSync(fatal)) { process.stdout.write(fs.readFileSync(fatal, 'utf8') + '\n'); process.exit(1); }
  if (Date.now() - t0 > (+process.env.Q_TIMEOUT || 300) * 1000) { console.log('TIMEOUT'); process.exit(1); }
  setTimeout(poll, 100);
})();
