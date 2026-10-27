'use strict';
// Helpers shared by the CI scripts (ci/README.md): a static server for a dist/ folder, the job summary, commands.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PY = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
// serves dir on 127.0.0.1 at a free port (or the given one); -> {server, base}
function serve(dir, port = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.resolve(dir, rel);
      if (!file.startsWith(path.resolve(dir)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}/` }));
  });
}

// appends markdown to the job summary (GitHub Actions), or prints it
function summary(md) {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (f) fs.appendFileSync(f, md.endsWith('\n') ? md : md + '\n');
  else process.stdout.write('\n' + md + '\n');
}

// runs a command, inheriting stdio; -> exit status (a missing command or a signal counts as 2)
function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
  const r = spawnSync(cmd, args, Object.assign({ stdio: 'inherit', cwd: ROOT }, opts));
  if (r.error) { console.error(r.error.message); return 2; }
  return r.status == null ? 2 : r.status;
}

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

module.exports = { ROOT, PY, serve, summary, run, esc };
