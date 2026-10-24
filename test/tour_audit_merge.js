// Merges the audit shards (test/tour_audit_cmd.js, one JSON per kit folder) into one summary:
// node test/tour_audit_merge.js <tag> [kit folders...]   (default: every test/*_cdp/audit/<tag>-*.json and <tag>.json)
const fs = require('fs'), path = require('path');
const tag = process.argv[2] || 'audit';
let files = process.argv.slice(3).filter((a) => !a.startsWith('--'));
if (!files.length) {
  for (const d of fs.readdirSync(__dirname)) {
    const a = path.join(__dirname, d, 'audit');
    if (!/_cdp$/.test(d) || !fs.existsSync(a)) continue;
    for (const f of fs.readdirSync(a)) if (f === tag + '.json' || (f.startsWith(tag + '-') && /^\d+\.json$/.test(f.slice(tag.length + 1)))) files.push(path.join(a, f));
  }
}
const rows = [], layers = [], follow = [], focus = [];
for (const f of files) { const j = JSON.parse(fs.readFileSync(f, 'utf8')); rows.push(...j.rows); layers.push(...j.layers); follow.push(...j.follow); focus.push(...(j.focus || [])); }
const count = (list, key) => { const o = {}; for (const r of list) for (const k of (r.kinds || [])) { const kk = key ? k + ':' + r[key] : k; o[kk] = (o[kk] || 0) + 1; } return o; };
const byW = {};
for (const r of rows) { const w = r.cfg.split('-')[0]; byW[w] = byW[w] || { views: 0, failing: 0 }; byW[w].views++; if (r.kinds.length) byW[w].failing++; }
const d = rows.flatMap((r) => (r.spot || []).map((s) => s.d)).filter((x) => x < 999).sort((a, b) => a - b);
const bh = rows.flatMap((r) => (r.card ? r.card.btns.map((b) => b[2]) : []));
const lv = layers.filter((r) => !r.na);
const out = {
  files: files.length, configs: new Set(rows.map((r) => r.cfg)).size, stepViews: rows.filter((r) => !r.missed).length, failingStepViews: rows.filter((r) => r.kinds.length).length,
  // steps that should show in a configuration and were not visited (the engine's reason: missing, clipped, scene)
  skippedSteps: [...new Set(rows.filter((r) => r.missed).map((r) => r.id + ' (' + r.missed + ') ' + r.cfg.replace(/-(light|dark)-/, '-').replace(/-(mouse|touch)$/, '')))],
  byKind: count(rows), byWidth: byW,
  spotDiffPx: d.length ? { median: d[d.length >> 1], p95: d[Math.floor(d.length * 0.95)], max: d[d.length - 1], over1: d.filter((x) => x > 1).length, of: d.length } : null,
  buttonHeightPx: bh.length ? { min: Math.min(...bh), max: Math.max(...bh) } : null,
  layerChecks: lv.length, failingLayerChecks: lv.filter((r) => r.kinds.length).length, layersByKind: count(lv, 'layer'),
  followChecks: follow.filter((r) => !r.skipped).length, failingFollow: follow.filter((r) => r.kinds && r.kinds.length).length, followByKind: count(follow.filter((r) => !r.skipped), 'name'),
  followSkipped: follow.filter((r) => r.skipped).map((r) => r.cfg + ':' + r.name + ':' + r.skipped).length,
  appFindings: rows.filter((r) => r.app && r.app.length).length, appFindingSteps: [...new Set(rows.filter((r) => r.app && r.app.length).map((r) => r.id + ' (' + r.cfg.replace(/-(light|dark)-/, '-').replace(/-(mouse|touch)$/, '') + ')'))],
  focusChecks: focus.length, failingFocus: focus.filter((r) => r.kinds.length).length, focusByKind: count(focus),
};
console.log(JSON.stringify(out, null, 1));
if (process.argv.includes('--fails')) for (const r of rows.filter((x) => x.kinds.length).slice(0, 40)) console.log(r.cfg, r.id, r.kinds.join(','), JSON.stringify(r.spot && r.spot.filter((s) => s.d > 1 || s.radD > 1 || s.cut)), r.card && JSON.stringify([r.card.small, r.card.over, r.card.top, r.card.out, r.card.gap, r.card.notInside]));
