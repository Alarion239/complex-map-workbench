// node table.js <res...json> : prints markdown rows for the AUDIT
const fs = require('fs');
const all = {};
for (const f of process.argv.slice(2)) { try { Object.assign(all, JSON.parse(fs.readFileSync(f, 'utf8'))); } catch (e) { console.error('skip', f, e.message); } }
const fr = (x) => (x && x.p50 != null ? `${x.p50}/${x.p95}` : '-');
const pth = (s) => (s || '').split(' ').filter((t) => t.startsWith('Rs1')).map((t) => t.replace('Rs1:', '').replace(/\(.*\)/, '')).join('') || '-';
const tex = (r) => { const st = r && r.cards; return ''; };
console.log('| scene | path (R) | render ms | pan p50/p95 | settle ms | param p50/p95 | morph render ms | morph p50/p95 | lamps |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const [k, r] of Object.entries(all)) {
  if (r.err) { console.log(`| ${k} | ERR ${r.err.slice(0, 60)} |`); continue; }
  const lamps = (r.lamps || '').split(' ').filter((l) => l.startsWith('●')).map((l) => l.slice(1)).join(' ');
  console.log(`| ${k} | ${pth(r.paths)}${r.pathsAfterPan && pth(r.pathsAfterPan) !== pth(r.paths) ? '→' + pth(r.pathsAfterPan) : ''} | ${r.time ? r.time.R : '-'} | ${fr(r.pan)} | ${r.settleMs ?? '-'} | ${r.param ? fr(r.param) + (r.paramSettleMs > 50 ? ' (+' + r.paramSettleMs + ')' : '') : ''} | ${r.morphTime ?? ''} | ${fr(r.morph)} | ${lamps} |`);
}
