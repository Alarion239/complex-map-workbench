'use strict';
// Visual inspection of a design change (#470): builds two refs, walks both over the layout matrix
// (test/lib/layout_matrix.js) in one headless Chrome, and writes an HTML gallery: each point's base and head side by
// side (and their difference), the share of pixels that changed with the box around them, and the layout checks'
// results (test/lib/layout.js) with what is new at the head and what went.
//   node tools/inspect.js --base <ref> [--head <ref>] [--out DIR] [--full] [--langs en,ru] [--views classic,steps]
//                         [--devices phone,desktop] [--sizes 390,1280] [--themes light,dark] [--states 'start,menu export']
// --head defaults to the checkout as it is (built here); --base to the integration branch. The default matrix is
// quick: en; 360, 390, 740×360, 1024 and 1440; light and dark; the classic view and ?view=steps; every state. --full is
// every language and size. DIR defaults to .ci/inspect/<base>-<head>/ and holds index.html with its pictures (publish
// it as it is: a private Artifact for each review, never into the repository).
// On a Mac it uses Chrome and its GPU (ANGLE Metal); in a cloud sandbox set CHROME_BIN, CMW_ANGLE=swiftshader,
// CMW_CHROME_ARGS=--no-sandbox, and CMW_VENDOR=1 for MathJax and the fonts without the CDNs (ci/README.md).
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { ROOT, PY, serve, run } = require('../ci/lib');
const { buildReference } = require('../ci/reference');
const decode = require('../test/cdp_kit/png.js');

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const list = (k, d) => (opt(k) ? opt(k).split(',').map((s) => s.trim()).filter(Boolean) : d);
const FULL = argv.includes('--full');
const BASE = opt('--base', 'origin/claude/funny-darwin-l5uis3'), HEAD = opt('--head', null);
const CFG = {
  langs: list('--langs', FULL ? ['en', 'ru', 'it'] : ['en']),
  views: list('--views', ['classic', 'steps']),
  devices: list('--devices', ['phone', 'desktop']),
  themes: list('--themes', ['light', 'dark']),
  sizes: list('--sizes', FULL ? null : ['360', '390', '740x360', '1024', '1440']),
  states: list('--states', null),
};
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (ref) => (ref ? git('rev-parse', '--short=9', `${ref}^{commit}`) : 'checkout');

// the head: the checkout as it is (built here), or another ref's build
function buildHead() {
  if (HEAD) return buildReference(HEAD);
  if (run(PY, ['build.py']) !== 0) throw new Error('the checkout did not build');
  return { sha: short('HEAD') + (git('status', '--porcelain', '--', 'src', 'build.py') ? '+' : ''), dist: path.join(ROOT, 'dist') };
}

// a copy of the CDP daemon kit (in test/, as ci/browser.js makes it: the kit finds dist/ and vendor/ two levels up), started; -> { dir, run(body) -> result, stop() }
async function daemon(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'test', 'cdp_kit'), dir, { recursive: true, filter: (s) => !/[\\/](q|shots|chprof-[^\\/]*)$/.test(s) });
  const child = spawn(process.execPath, [path.join(dir, 'cdpd.js')], { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'], detached: process.platform !== 'win32' });
  const Q = path.join(dir, 'q');
  for (let i = 0; !fs.existsSync(path.join(Q, 'READY')); i++) {
    if (fs.existsSync(path.join(Q, 'FATAL')) || child.exitCode != null || i > 1800) throw new Error('the browser daemon did not start: ' + (fs.existsSync(path.join(Q, 'FATAL')) ? fs.readFileSync(path.join(Q, 'FATAL'), 'utf8') : 'no READY'));
    await sleep(100);
  }
  let n = 0;
  return {
    async run(body) {
      n++;
      fs.writeFileSync(path.join(Q, `${n}.tmp`), body);
      fs.renameSync(path.join(Q, `${n}.tmp`), path.join(Q, `${n}.js`));
      const out = path.join(Q, `${n}.out`);
      while (!fs.existsSync(out)) { if (fs.existsSync(path.join(Q, 'FATAL'))) throw new Error(fs.readFileSync(path.join(Q, 'FATAL'), 'utf8')); await sleep(250); }
      await sleep(100);
      const r = JSON.parse(fs.readFileSync(out, 'utf8'));
      if (r && r.__daemonError) throw new Error(r.__daemonError);
      return r;
    },
    async stop() {
      fs.writeFileSync(path.join(Q, 'QUIT'), '');
      for (let i = 0; i < 50 && child.exitCode == null; i++) await sleep(100);
      try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill(); } catch (e) { /* gone */ }
    },
  };
}

// the share of pixels that differ (any channel by more than 16) and the box around them; null when the sizes differ
function diff(fa, fb) {
  const a = decode(fs.readFileSync(fa)), b = decode(fs.readFileSync(fb));
  if (a.w !== b.w || a.h !== b.h) return null;
  let n = 0, l = a.w, t = a.h, r = -1, bt = -1;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const i = (y * a.w + x) * a.ch, j = (y * b.w + x) * b.ch;
    if (Math.abs(a.data[i] - b.data[j]) > 16 || Math.abs(a.data[i + 1] - b.data[j + 1]) > 16 || Math.abs(a.data[i + 2] - b.data[j + 2]) > 16) {
      n++; if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > bt) bt = y;
    }
  }
  return { pct: +(100 * n / (a.w * a.h)).toFixed(2), box: n ? { l, t, r: r + 1, b: bt + 1 } : null };
}

const vid = (v) => `${v.check} ${v.key}${v.okey ? ' × ' + v.okey : ''}`;
const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function gallery(meta, rows) {
  const changed = rows.filter((r) => r.d && r.d.pct > 0).length, newV = rows.reduce((s, r) => s + r.added.length, 0), goneV = rows.reduce((s, r) => s + r.gone.length, 0);
  const vrow = (v, cls) => `<li class="${cls}"><b>${escH(v.check)}</b> ${escH(v.el)}${v.other ? ` <i>×</i> ${escH(v.other)}` : ''} <code>${escH(JSON.stringify(v.detail || {}))}</code></li>`;
  const card = (r) => `
<section class="pt${r.d && r.d.pct > 0 ? ' ch' : ''}${r.added.length ? ' nv' : ''}" data-lang="${r.lang}" data-view="${r.view}" data-size="${r.size}" data-theme="${r.theme}" data-state="${escH(r.state)}">
  <h3>${escH(r.state)} <span>${r.lang} · ${r.view} · ${r.size} · ${r.theme}</span>
    <em>${r.d ? (r.d.pct > 0 ? `${r.d.pct} % of pixels changed` : 'no change') : r.base ? 'sizes differ' : 'new at the head'}</em>
    ${r.added.length ? `<em class="bad">${r.added.length} new violation${r.added.length > 1 ? 's' : ''}</em>` : ''}${r.gone.length ? `<em class="good">${r.gone.length} gone</em>` : ''}</h3>
  <div class="pair" style="--ar:${r.w}/${r.h}">
    <figure><figcaption>base</figcaption>${r.base ? `<a href="base/${r.id}.jpg" target="_blank"><img loading="lazy" src="base/${r.id}.jpg" alt="base: ${escH(r.state)}"></a>` : '<div class="none">not at the base</div>'}</figure>
    <figure><figcaption>head</figcaption><a href="head/${r.id}.jpg" target="_blank"><img loading="lazy" src="head/${r.id}.jpg" alt="head: ${escH(r.state)}"></a>${r.d && r.d.box ? `<div class="box" style="left:${100 * r.d.box.l / r.w}%;top:${100 * r.d.box.t / r.h}%;width:${100 * (r.d.box.r - r.d.box.l) / r.w}%;height:${100 * (r.d.box.b - r.d.box.t) / r.h}%"></div>` : ''}</figure>
    ${r.base ? `<figure class="dif"><figcaption>difference</figcaption><div class="stack"><img loading="lazy" src="base/${r.id}.jpg" alt=""><img loading="lazy" src="head/${r.id}.jpg" alt=""></div></figure>` : ''}
  </div>
  <ul class="v">${r.added.map((v) => vrow(v, 'add')).join('')}${r.gone.map((v) => vrow(v, 'gone')).join('')}${r.kept.map((v) => vrow(v, 'kept')).join('')}</ul>
</section>`;
  const opts = (k) => [...new Set(rows.map((r) => r[k]))].map((v) => `<option>${escH(v)}</option>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Inspection ${escH(meta.base.split(' ')[0].replace(/^origin\//, ''))} → ${escH(String(meta.head).split(' ')[0])}</title><meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#f6f7f8;--fg:#1b1f23;--mut:#5b6670;--card:#fff;--line:#d9dee3;--bad:#c62828;--good:#2e7d32;--acc:#0a6a87}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#15181b;--fg:#e6e9ec;--mut:#9aa5ae;--card:#1e2226;--line:#333a40;--bad:#ef6b6b;--good:#6fcf75;--acc:#5ab8d6;color-scheme:dark}}
:root[data-theme=dark]{--bg:#15181b;--fg:#e6e9ec;--mut:#9aa5ae;--card:#1e2226;--line:#333a40;--bad:#ef6b6b;--good:#6fcf75;--acc:#5ab8d6;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
header{position:sticky;top:env(safe-area-inset-top,0px);z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding-block:12px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:18px;margin:0 0 4px}header p{margin:0;color:var(--mut)}code{font:12px ui-monospace,Menlo,monospace;color:var(--mut)}
.f{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;align-items:center}.f label{display:flex;gap:4px;align-items:center}
select,input{font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:3px 6px}
main{padding-block:12px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:16px}.pt{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.pt h3{margin:0 0 8px;font-size:15px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}.pt h3 span{color:var(--mut);font-weight:400}
em{font-style:normal;font-size:12px;color:var(--mut)}em.bad{color:var(--bad);font-weight:600}em.good{color:var(--good)}
.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px;align-items:start}
figure{margin:0;position:relative}figcaption{font-size:12px;color:var(--mut);margin-bottom:2px}
figure img{display:block;width:100%;height:auto;aspect-ratio:var(--ar);border:1px solid var(--line);border-radius:4px}
.box{position:absolute;outline:2px dashed var(--acc);pointer-events:none;margin-top:20px}
.stack{position:relative;aspect-ratio:var(--ar)}.stack img{position:absolute;inset:0}.stack img+img{mix-blend-mode:difference}
.none{border:1px dashed var(--line);border-radius:4px;padding:24px;color:var(--mut);text-align:center}
ul.v{margin:8px 0 0;padding-left:18px}ul.v li{margin:2px 0;overflow-wrap:anywhere}li.add{color:var(--bad)}li.gone{color:var(--good);text-decoration:line-through}li.kept{color:var(--mut)}
body.only .pt:not(.ch):not(.nv){display:none}
</style></head><body>
<header><h1>Visual inspection: ${escH(meta.base)} → ${escH(meta.head)}</h1>
<p>${rows.length} points · ${changed} changed · <b${newV ? ' style="color:var(--bad)"' : ''}>${newV} new violation${newV === 1 ? '' : 's'}</b> · ${goneV} gone · renderer: ${escH(meta.renderer)} · ${escH(meta.when)}</p>
<p>The layout checks (test/lib/layout.js) at each point: red is new at the head, green struck out went, grey was there before. The dashed box is around the pixels that changed; the third picture is the difference.</p>
<div class="f"><label><input type="checkbox" id="only" checked> only changed or new violations</label>
${['lang', 'view', 'size', 'theme', 'state'].map((k) => `<label>${k} <select data-k="${k}"><option value="">all</option>${opts(k)}</select></label>`).join('')}</div>
${meta.skipped.length ? `<details><summary>${meta.skipped.length} points skipped</summary><code>${meta.skipped.map(escH).join('<br>')}</code></details>` : ''}</header>
<main>${rows.map(card).join('')}</main>
<script>
const f = () => { document.body.classList.toggle('only', document.getElementById('only').checked);
  const sel = [...document.querySelectorAll('select[data-k]')].map((s) => [s.dataset.k, s.value]);
  for (const p of document.querySelectorAll('.pt')) p.hidden = sel.some(([k, v]) => v && p.dataset[k] !== v); };
for (const e of document.querySelectorAll('#only, select[data-k]')) e.addEventListener('change', f); f();
</script></body></html>`;
}

(async () => {
  const base = buildReference(BASE), head = buildHead();
  const tag = `${base.sha.slice(0, 9)}-${String(head.sha).slice(0, 10)}`;
  const OUT = path.resolve(opt('--out', path.join(ROOT, '.ci', 'inspect', tag)));
  fs.rmSync(OUT, { recursive: true, force: true });
  const sb = await serve(base.dist), sh = await serve(head.dist);
  const d = await daemon(path.join(ROOT, 'test', 'inspect_cdp'));
  const res = {};
  try {
    for (const [side, srv] of [['base', sb], ['head', sh]]) {
      const INSPECT = { url: srv.base + 'test.html', lib: path.join(ROOT, 'test', 'lib', 'layout.js'), matrix: path.join(ROOT, 'test', 'lib', 'layout_matrix.js'), out: path.join(OUT, side), cfg: CFG };
      console.log(`${side}: ${side === 'base' ? base.sha : head.sha} at ${INSPECT.url}`);
      res[side] = await d.run(`const INSPECT = ${JSON.stringify(INSPECT)}; ` + fs.readFileSync(path.join(ROOT, 'test', 'lib', 'inspect_page.js'), 'utf8'));
      console.log(`${side}: ${res[side].points.length} points in ${(res[side].ms / 1000).toFixed(0)} s`);
    }
  } finally {
    await d.stop();
    sb.server.close(); sh.server.close();
  }
  const byB = new Map(res.base.points.map((p) => [p.id, p]));
  const rows = res.head.points.map((p) => {
    const b = byB.get(p.id);
    const bv = new Map((b ? b.v : []).map((v) => [vid(v), v])), hv = new Map(p.v.map((v) => [vid(v), v]));
    const pf = (side) => path.join(OUT, side, p.id + '.png');
    return Object.assign({}, p, { base: !!b, d: b ? diff(pf('base'), pf('head')) : null,
      added: [...hv.keys()].filter((k) => !bv.has(k)).map((k) => hv.get(k)), gone: [...bv.keys()].filter((k) => !hv.has(k)).map((k) => bv.get(k)),
      kept: [...hv.keys()].filter((k) => bv.has(k)).map((k) => hv.get(k)) });
  });
  // (the PNGs were for the diff; the gallery shows the JPEGs)
  for (const side of ['base', 'head']) for (const f of fs.readdirSync(path.join(OUT, side))) if (f.endsWith('.png')) fs.rmSync(path.join(OUT, side, f));
  const meta = { base: `${BASE} (${base.sha.slice(0, 9)})`, head: `${HEAD || 'the checkout'} (${String(head.sha).slice(0, 10)})`, renderer: res.head.renderer, when: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    skipped: [...new Set(res.base.skipped.map((s) => 'base: ' + s).concat(res.head.skipped.map((s) => 'head: ' + s)))] };
  fs.writeFileSync(path.join(OUT, 'index.html'), gallery(meta, rows));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ meta, cfg: CFG, rows: rows.map((r) => Object.assign({}, r, { v: undefined })) }, null, 1));
  const ch = rows.filter((r) => r.d && r.d.pct > 0).length, nv = rows.reduce((s, r) => s + r.added.length, 0);
  console.log(`${rows.length} points, ${ch} changed, ${nv} new violations: ${path.join(OUT, 'index.html')}`);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
