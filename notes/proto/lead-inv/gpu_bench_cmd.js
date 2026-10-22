// run with: test/<you>_cdp/q.sh notes/proto/lead-inv/gpu_bench_cmd.js   (PNG of z^i(H) saved to <cdp>/shots/)
const src = fs.readFileSync(path.join(DIR, '../../notes/proto/lead-inv/gpu_bench_page.js'), 'utf8');
await nav('about:blank');
const res = {};
for (const alpha of [1, 0.85]) {
  await ev(src + `; window.__res = null; runBench({alpha: ${alpha}}).then((r) => { window.__res = JSON.stringify(r); }, (e) => { window.__res = JSON.stringify({error: String(e)}); }); 1`);
  let s = null;
  for (let i = 0; i < 600 && !s; i++) { await sleep(200); s = await ev('window.__res'); }
  const r = JSON.parse(s);
  if (r && r.results) for (const x of r.results) if (x.png) { fs.writeFileSync(path.join(DIR, 'shots', 'gpu_' + x.name + '_' + alpha + '.png'), Buffer.from(x.png.split(',')[1], 'base64')); delete x.png; }
  res['alpha' + alpha] = r;
}
res.logs = logs();
return res;
