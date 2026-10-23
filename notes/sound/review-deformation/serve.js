const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.ROOT, OUT = process.env.OUT;
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/up') {
    const name = (u.searchParams.get('name') || 'rec').replace(/[^\w.-]/g, '_'), chunks = [];
    req.on('data', (d) => chunks.push(d));
    req.on('end', () => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name), Buffer.concat(chunks)); res.writeHead(200); res.end('ok'); });
    return;
  }
  const f = path.join(ROOT, path.normalize(u.pathname).replace(/^\/+/, ''));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(f));
}).listen(8952, '127.0.0.1', () => console.log('serving', ROOT, 'on 8952 ->', OUT));
