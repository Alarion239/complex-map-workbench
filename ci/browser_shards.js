'use strict';
// The browser suites (ci/browser.js) split into shards, each one CI job on GitHub's Linux machines of about 15 minutes
// (the measured times: ci/README.md). Every suite that runs is in exactly one shard: a suite listed in no shard (a new
// one, e.g. v16.5's test/ux165_*_cmd.js) runs in the shard `new`, so none is left out; move it to a shard once its time
// is known. `node ci/browser_shards.js check` fails when a suite is listed twice, or is listed and excluded
// (ci/browser_suites.js EXCLUDED); a listed file that no longer exists is only reported.
//   node ci/browser_shards.js matrix [--only id,id]   the shard ids with at least one suite, as a JSON array
//   node ci/browser_shards.js list ID                  one shard's suites (and runs)
//   node ci/browser_shards.js check                    every suite in exactly one shard
const fs = require('fs');
const path = require('path');

// (a suite's runs, SUITES[f].runs in ci/browser_suites.js, may go to different shards: 'file#label')
const SHARDS = [
  // (seconds of suite time on lavapipe, the third run of pull request #7; a job adds about a minute)
  { id: 'perp', suites: ['perp_cmd.js', 'fix163_cmd.js'] },                                                  // 452 + 231
  { id: 'export', suites: ['export_cmd.js'] },
  { id: 'smoke-desktop', suites: ['rel1641_smoke_cmd.js#en-1440', 'rel1641_smoke_cmd.js#ru-1440-dark'] },   // 229 + 217
  { id: 'smoke-phone', suites: ['rel1641_smoke_cmd.js#en-390-dark', 'rel1641_smoke_cmd.js#ru-390'] },        // about 260 + 260
  { id: 'constructions', suites: ['constr_cmd.js', 'touch_cmd.js', 'zp_cmd.js', 'zpfix_cmd.js'] },           // 349 + 223 + 50 + 24
  { id: 'deform', suites: ['sheets_deform_cmd.js', 'deform_range_cmd.js', 'deform_nat_cmd.js', 'deform_range_gl_cmd.js', 'rel162_sheets_cmd.js'] },   // 298 + 268 + 111 + 20 + 24
  { id: 'sound', suites: ['sound_cmd.js', 'sound_v152_cmd.js', 'seasong_cmd.js'] },                         // 195 + 99 + 93
  { id: 'tour', suites: ['tour_cmd.js', 'tour_auto_cmd.js', 'tour_lit_cmd.js', 'tour_perf_cmd.js'] },        // 234 + 312 + 133 + 50
  { id: 'tour-phone', suites: ['tour_phone_cmd.js', 'v15_merge_cmd.js', 'v151_cmd.js'] },                   // 551 + 17 + 44
  { id: 'tour-audit-phone', suites: ['tour_audit_cmd.js#phone'] },                                          // 588
  { id: 'tour-audit-desktop', suites: ['tour_audit_cmd.js#desktop'] },                                      // 559
  { id: 'i18n', suites: ['i18n_cmd.js', 'v15_phone_cmd.js', 'phone_swap_cmd.js#lang'] },                    // 334 + 163 + 113
  { id: 'i18n-desktop', suites: ['i18n_walk_cmd.js#1440'] },                                                // 690
  { id: 'i18n-phone', suites: ['i18n_walk_cmd.js#390-dark'] },                                              // 594
  { id: 'phone-swap-1', suites: ['phone_swap_cmd.js#deform', 'phone_swap_cmd.js#views'] },                  // 411 + 323
  { id: 'phone-swap-2', suites: ['phone_swap_cmd.js#sheet', 'phone_swap_cmd.js#rotate', 'phone_swap_cmd.js#sphere'] },   // 334 + 247 + 209
  { id: 'phone-swap-3', suites: ['phone_swap_cmd.js#swap', 'phone_swap_cmd.js#review', 'phone_swap_cmd.js#urlbar', 'phone_swap_cmd.js#tablet'] },   // 226 + 258 + 197 + 41
  { id: 'formulas', suites: ['split_cmd.js', 'fix152_cmd.js', 'v15_planemenu_cmd.js'] },                    // 285 + 112 + 74
  { id: 'images', suites: ['curves_cmd.js', 'p3_accept_cmd.js', 'p3bfix_cmd.js', 'p3b_accept_cmd.js', 'morphfig_cmd.js'] },   // 230 + 201 + 37 + 35 + 53
  { id: 'views', suites: ['mv_views_cmd.js', 'p3_review_cmd.js', 'v15_desktop_cmd.js', 'v15_params_cmd.js'] },   // 243 + 94 + 111 + 66
  { id: 'exact', suites: ['p5_accept_cmd.js'] },                                                            // 491
  { id: 'new', rest: true, suites: [], what: 'every suite not listed in another shard' },
];

const ROOT = path.join(__dirname, '..');
const fileOf = (e) => e.split('#')[0];
function runnable() {
  const { EXCLUDED } = require('./browser_suites');
  return fs.readdirSync(path.join(ROOT, 'test')).filter((f) => /_cmd\.js$/.test(f) && !EXCLUDED[f]).sort();
}
// the entries ('file' or 'file#label') of shard id, of the given runnable suites (default: test/*_cmd.js less the
// excluded)
function suitesOf(id, suites = runnable()) {
  const s = SHARDS.find((x) => x.id === id);
  if (!s) throw new Error(`no browser shard ${id}: ${SHARDS.map((x) => x.id).join(', ')}`);
  if (!s.rest) return s.suites.filter((e) => suites.includes(fileOf(e)));
  const listed = new Set(SHARDS.flatMap((x) => x.suites.map(fileOf)));
  return suites.filter((f) => !listed.has(f));
}
function check() {
  const { EXCLUDED, SUITES } = require('./browser_suites');
  const bad = [], gone = [], seen = new Map();
  const files = new Set(fs.readdirSync(path.join(ROOT, 'test')));
  for (const s of SHARDS) for (const e of s.suites) {
    const [f, label] = e.split('#');
    const labels = ((SUITES[f] && SUITES[f].runs) || [{}]).map((r) => r.label);
    for (const k of label ? [e, f] : [f, ...labels.filter(Boolean).map((l) => `${f}#${l}`)]) if (seen.has(k)) bad.push(`${e}: in ${seen.get(k)} and ${s.id}`);
    seen.set(e, s.id);
    if (EXCLUDED[f]) bad.push(`${e}: in ${s.id} and excluded (${EXCLUDED[f]})`);
    if (label && !labels.includes(label)) bad.push(`${e}: ${f} has no run ${label} (ci/browser_suites.js)`);
    if (!files.has(f)) gone.push(`${e} (${s.id})`);
  }
  // a suite listed by its runs has every run in a shard
  for (const f of new Set([...seen.keys()].filter((e) => e.includes('#')).map(fileOf))) {
    for (const r of (SUITES[f] && SUITES[f].runs) || []) if (!seen.has(`${f}#${r.label}`)) bad.push(`${f}#${r.label}: in no shard`);
  }
  return { bad, gone };
}

if (require.main === module) {
  const [cmd, a1] = process.argv.slice(2);
  const i = process.argv.indexOf('--only');
  const only = i > 0 ? process.argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : null;
  if (cmd === 'check') {
    const { bad, gone } = check();
    if (gone.length) console.log(`listed in a shard but not in test/ (ignored): ${gone.join(', ')}`);
    if (bad.length) { console.error('browser suites not in exactly one shard (ci/browser_shards.js):\n  ' + bad.join('\n  ')); process.exit(1); }
    const n = runnable().length, rest = suitesOf(SHARDS.find((s) => s.rest).id);
    console.log(`every one of ${n} browser suites is in exactly one of ${SHARDS.length} shards${rest.length ? `; in the catch-all shard: ${rest.join(', ')}` : ''}`);
  } else if (cmd === 'list') {
    console.log(suitesOf(a1).join('\n'));
  } else if (cmd === 'matrix') {
    console.log(JSON.stringify(SHARDS.filter((s) => (!only || only.includes(s.id)) && suitesOf(s.id).length).map((s) => s.id)));
  } else { console.error('usage: node ci/browser_shards.js matrix|list ID|check'); process.exit(2); }
}
module.exports = { SHARDS, suitesOf, check };
