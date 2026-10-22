#!/usr/bin/env python3
"""Pass/fail gate of the image-quality suite: compare a run's metrics.json with the stored baseline.

    python3 test/regress/compare_quality.py                       # quality/out/latest vs quality/baseline.json
    python3 test/regress/compare_quality.py --current DIR_OR_JSON --baseline JSON --all --json report.json

Gated per run (tolerances in quality/tolerances.json):
  iou         must not drop by more than tol          (higher is better)
  hole        must not grow by more than tol          (lower is better)
  spill       must not grow by more than tol          (lower is better)
  parity_acc  must not drop by more than tol          (checker runs; only when both runs scored >= min_n pixels)
  golden_diff must stay <= max                        (bounded controls; absolute, against the golden PNG)
  opacity_min must not drop by more than tol          (mask-type runs of the SPEC 12.4 scenes)
  color_off   must not grow by more than tol          (SPEC 12.4 scenes: interior pixels in a wrong colour)
  hole_leak   must not grow                            (zi_H*: fill pixels inside the hole |w| < e^-pi)
  the run must exist, have settled, show the pinned view and raise no GL error / runner error.
A gated metric that has a baseline value and no current value (null: nothing could be scored) FAILS.
A change in the good direction larger than tol is reported as IMPROVED (never a failure).
A run that is not in the baseline yet (a scene added after the baseline was recorded) is reported as NEW with its
values and is not compared with a baseline, until a baseline that contains it is accepted (run_quality.js
--accept); a NEW run that did not render (not ok: no settle, a GL or runner error, a wrong view) FAILS.
Targets (tolerances.json 'targets'): absolute thresholds of the spec, reported as MET / NOT MET (a run that the
rule names but that has no value for the metric, e.g. a crashed run, is NOT MET); with --enforce-targets a NOT MET
target fails the gate (use it from the phase that must meet them).
Exit status: 0 pass, 1 fail, 2 usage / missing files.
"""
import argparse
import fnmatch
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
QDIR = os.path.join(HERE, 'quality')
EPS = 1e-6


def load(p):
    if os.path.isdir(p):
        p = os.path.join(p, 'metrics.json')
    with open(p) as f:
        return json.load(f), p


def fmt(x, k=''):
    if x is None:
        return '-'
    if isinstance(x, bool):
        return str(x)
    if isinstance(x, int) or k == 'settle_ms':
        return str(int(round(x)))
    if abs(x) >= 100:
        return '%.1f' % x
    return '%.5f' % x if abs(x) < 10 else '%.3f' % x


def judge(b, c, better, tol):
    """-> (status, delta) where delta > 0 means better"""
    if b is not None and c is None:
        return ('FAIL', None)   # the baseline had a value; the current run could not score it
    if b is None or c is None:
        return ('n/a', None)
    d = (c - b) if better == 'higher' else (b - c)
    if d < -tol - EPS:
        return ('FAIL', d)
    if d > tol + EPS:
        return ('IMPROVED', d)
    if d < -EPS:
        return ('worse (in tol)', d)
    if d > EPS:
        return ('better', d)
    return ('same', d)


# the values printed for a NEW run
NEW_SHOW = ('iou', 'hole', 'spill', 'parity_acc', 'parity_n', 'opacity_min', 'opacity_p01', 'color_off', 'hole_leak', 'golden_diff')


def check_targets(spec, cruns):
    """-> [{run, metric, op, limit, value, met, note}] for every target rule that applies to a run present.
    A run that the rule names but that has no value for the metric (missing or null: the run crashed, did not render,
    or scored nothing) does NOT meet the target."""
    out = []
    for rule in spec.get('rules', []):
        pats = [p.strip() for p in rule.get('runs', '').split(',') if p.strip()]
        for rid in sorted(cruns):
            if not any(fnmatch.fnmatchcase(rid, p) for p in pats):
                continue
            m = cruns[rid].get('metrics') or {}
            for k, lim in rule.items():
                if k in ('runs', 'note') or not isinstance(lim, dict):
                    continue
                for op in ('min', 'max'):
                    if op not in lim:
                        continue
                    v = m.get(k)
                    if v is None:
                        met = False
                    else:
                        met = v >= lim[op] - EPS if op == 'min' else v <= lim[op] + EPS
                    out.append({'run': rid, 'metric': k, 'op': op, 'limit': lim[op], 'value': v, 'met': met, 'note': rule.get('note', '')})
    return out


def main(argv=None):
    """argv: the options (sys.argv[1:] when None); returns the exit status (also used by test/regress/compare.py)"""
    ap = argparse.ArgumentParser(prog='compare_quality.py', description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--baseline', default=os.path.join(QDIR, 'baseline.json'))
    ap.add_argument('--current', '--results', dest='current', default=os.path.join(QDIR, 'out', 'latest'),
                    help='metrics.json of the run to gate, or its directory (default quality/out/latest)')
    ap.add_argument('--tolerances', default=os.path.join(QDIR, 'tolerances.json'))
    ap.add_argument('--all', action='store_true', help='print every metric of every run, not only changes')
    ap.add_argument('--json', help='also write the verdict as JSON to this file')
    ap.add_argument('--only-present', action='store_true', help='gate only the runs present in the current results (partial runs)')
    ap.add_argument('--enforce-targets', action='store_true', help='fail when an absolute target of tolerances.json is not met')
    a = ap.parse_args(argv)
    try:
        base, bpath = load(a.baseline)
        cur, cpath = load(a.current)
        with open(a.tolerances) as f:
            tol = json.load(f)
    except FileNotFoundError as e:
        print('compare_quality: %s' % e, file=sys.stderr)
        return 2

    rows, fails, improved, warns, news = [], [], [], [], []
    bm, cm = base.get('meta', {}), cur.get('meta', {})
    print('Image-quality gate\n  baseline %s (%s, app %s)\n  current  %s (%s, app %s)' % (
        os.path.relpath(bpath), bm.get('date', '?')[:19], bm.get('app_sha1', '?')[:12],
        os.path.relpath(cpath), cm.get('date', '?')[:19], cm.get('app_sha1', '?')[:12]))
    for k in ('viewport', 'band_px', 'parity_min_cell_px', 'parity_min_edge_px', 'golden_thr'):
        if bm.get(k) != cm.get(k):
            fails.append(('*', 'config', 'suite setting %s differs: baseline %s, current %s (re-baseline deliberately)' % (k, bm.get(k), cm.get(k))))
    if cm.get('state_override'):
        warns.append('the current run used --override %s: a sensitivity check, not a gate run' % json.dumps(cm['state_override']))
    if bm.get('browser') != cm.get('browser'):
        warns.append('browser differs: baseline %s, current %s (renders may differ slightly)' % (bm.get('browser'), cm.get('browser')))

    gated, info, gold = tol.get('gated', {}), tol.get('info', {}), tol.get('golden_diff', {})
    ov = tol.get('overrides', {})
    bruns, cruns = base.get('runs', {}), cur.get('runs', {})
    summary = {}
    for rid in list(bruns) + [r for r in cruns if r not in bruns]:
        b, c = bruns.get(rid), cruns.get(rid)
        st = 'same'
        if c is None and a.only_present:
            continue
        if c is None:
            fails.append((rid, 'run', 'missing from the current run'))
            summary[rid] = 'FAIL'
            continue
        if b is None:
            # a scene added after the baseline was recorded: shown with its values, not compared with a baseline; but
            # a run that did not render is not new, it is broken
            news.append((rid, c))
            if not c.get('ok', False):
                fails.append((rid, 'run', '(NEW) ' + ('; '.join(c.get('problems', [])) or 'not ok')))
                summary[rid] = 'FAIL'
                continue
            summary[rid] = 'NEW'
            for p in c.get('problems', []):
                warns.append('%s (NEW): %s' % (rid, p))
            continue
        if not c.get('ok', False):
            fails.append((rid, 'run', '; '.join(c.get('problems', [])) or 'not ok'))
            st = 'FAIL'
        elif c.get('problems'):
            for p in c['problems']:
                warns.append('%s: %s' % (rid, p))
        bmet, cmet = b.get('metrics', {}), c.get('metrics', {})
        o = dict(ov.get(c.get('scene', ''), {}), **ov.get(rid, {}))

        def spec(k, base_spec):
            s = dict(base_spec)
            s.update(o.get(k, {}))
            return s

        for k, s0 in gated.items():
            if k not in bmet and k not in cmet:
                continue
            s = spec(k, s0)
            bv, cv = bmet.get(k), cmet.get(k)
            if s.get('min_n') and (bmet.get(s['n_key'], 0) < s['min_n'] or cmet.get(s['n_key'], 0) < s['min_n']):
                status, d = ('n/a (n<%d)' % s['min_n'], None)
            else:
                status, d = judge(bv, cv, s['better'], s['tol'])
            rows.append((rid, k, bv, cv, d, status, True))
            if status == 'FAIL':
                fails.append((rid, k, '%s -> %s (tol %s)%s' % (fmt(bv), fmt(cv), s['tol'], '' if cv is not None else ': no value (nothing scored)')))
                st = 'FAIL'
            elif status == 'IMPROVED':
                improved.append((rid, k, bv, cv))
                if st == 'same':
                    st = 'IMPROVED'
        if c.get('golden'):
            g, mx = cmet.get('golden_diff'), spec('golden_diff', gold).get('max', 0.005)
            if g is None:
                status = 'FAIL'
                fails.append((rid, 'golden_diff', 'no golden PNG to compare with'))
            else:
                status = 'FAIL' if g > mx + EPS else 'ok'
                if status == 'FAIL':
                    fails.append((rid, 'golden_diff', '%.5f of the pixels differ (max %.5f); see golden_diff/%s.png' % (g, mx, rid)))
            rows.append((rid, 'golden_diff', 0.0, g, None, status, True))
            if status == 'FAIL':
                st = 'FAIL'
        for k, s0 in info.items():
            s = spec(k, s0)
            bv = bmet.get(k, b.get(k))
            cv = cmet.get(k, c.get(k))
            if bv is None and cv is None:
                continue
            status, d = judge(bv, cv, s['better'], s['tol'])
            # info metrics are never gated; only a change beyond their tolerance is shown
            status = {'FAIL': 'worse (info)', 'IMPROVED': 'better (info)', 'n/a': 'n/a'}.get(status, 'same')
            rows.append((rid, k, bv, cv, d, status, False))
        summary[rid] = st

    # gated metrics: every change; info metrics: only changes beyond their tolerance
    show = [r for r in rows if a.all or (r[5] not in ('same', 'ok') and not r[5].startswith('n/a'))]
    if show:
        print('\n%-26s %-12s %12s %12s %10s  %s' % ('run', 'metric', 'baseline', 'current', 'delta(+good)', 'status'))
        for rid, k, bv, cv, d, status, g in show:
            print('%-26s %-12s %12s %12s %10s  %s' % (rid, k, fmt(bv, k), fmt(cv, k), '' if d is None else ('%+.5f' % d if abs(d) < 10 else '%+.1f' % d), status))
    if warns:
        print('\nWarnings:')
        for w in warns:
            print('  - ' + w)
    if improved:
        print('\nImprovements (better than the baseline by more than the tolerance):')
        for rid, k, bv, cv in improved:
            print('  + %-26s %-11s %s -> %s' % (rid, k, fmt(bv), fmt(cv)))
    if news:
        print('\nNEW runs (no baseline entry yet: reported, not gated; accept a baseline to gate them):')
        for rid, c in news:
            m = c.get('metrics', {})
            parts = ['%s %s' % (k, fmt(m[k], k)) for k in NEW_SHOW if k in m]
            print('  NEW %-26s %s%s' % (rid, '  '.join(parts), '' if c.get('ok', False) else '  (run not ok: FAILED)'))
    tres = check_targets(tol.get('targets', {}), cruns)
    if tres:
        nmet = sum(1 for t in tres if t['met'])
        print('\nTargets (absolute thresholds of the spec; %s): %d met, %d not met' % (
            'enforced' if a.enforce_targets else 'reported only, --enforce-targets to gate', nmet, len(tres) - nmet))
        for t in tres:
            if not t['met'] or a.all:
                print('  %-7s %-26s %-12s %s %s %s  (%s)' % ('MET' if t['met'] else 'NOT MET', t['run'], t['metric'], fmt(t['value'], t['metric']),
                                                        '>=' if t['op'] == 'min' else '<=', t['limit'], t['note']))
            if not t['met'] and a.enforce_targets:
                fails.append((t['run'], t['metric'], 'target not met: %s %s %s (%s)' % (fmt(t['value'], t['metric']), '>=' if t['op'] == 'min' else '<=', t['limit'], t['note'])))
                if summary.get(t['run']) is not None:
                    summary[t['run']] = 'FAIL'
    n = len(summary)
    nf = sum(1 for v in summary.values() if v == 'FAIL')
    ni = sum(1 for v in summary.values() if v == 'IMPROVED')
    nn = sum(1 for v in summary.values() if v == 'NEW')
    print('\n%d runs: %d failed, %d improved, %d unchanged within tolerance%s' % (
        n, nf, ni, n - nf - ni - nn, (', %d NEW (not compared with a baseline)' % nn) if nn else ''))
    if fails:
        print('\nFAILED:')
        for rid, k, msg in fails:
            print('  x %-26s %-11s %s' % (rid, k, msg))
        print('\nRESULT: FAIL')
    else:
        print('RESULT: PASS')
    if a.json:
        with open(a.json, 'w') as f:
            json.dump({'pass': not fails, 'runs': summary, 'failures': [{'run': r, 'metric': k, 'message': m} for r, k, m in fails],
                       'improvements': [{'run': r, 'metric': k, 'baseline': bv, 'current': cv} for r, k, bv, cv in improved],
                       'new': [r for r, _ in news], 'targets': tres, 'targets_enforced': a.enforce_targets,
                       'warnings': warns}, f, indent=1)
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
