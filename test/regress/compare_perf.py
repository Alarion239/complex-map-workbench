#!/usr/bin/env python3
"""Compare perf-suite results (test/regress/perf/run.js) with the stored baseline.

    python3 test/regress/compare_perf.py [--baseline FILE] [--results FILE] [--all] [--json FILE] [--paired] [--tol-scale S]

Every metric carries a `kind`; the kind decides the tolerance (see TOL below and test/regress/README.md).
A metric fails when it is worse than its tolerance allows, is missing from a full run, or became null (a timeout).
A metric is reported as IMPROVED when it is better than the baseline by more than the same tolerance band.
A metric that is not in the baseline (a unit added after the baseline was recorded) is reported as NEW with its value
and is not compared until a baseline that contains it is recorded; the ABSOLUTE kinds are judged anyway, NEW or not:
a 'check' must be true, and a 'limit' must hold. Kind 'limit' is absolute: the value must stay at or below the
metric's own 'limit' (SPEC 4.7 gates: the SwiftShader ratio <= 3, inverse compile + first draw <= 250 ms); a null
value passes only when nothing was there to measure (no inverse program before P2); a metric that says a value was
expected ('expect': true, e.g. an inverse program was linked) and has none FAILS.
--paired (the CI's paired gate, ci/perf_shard.js): the baseline is the reference app measured on the same machine in
the same run, so a check that is false there too, or a limit the reference is over too (and this change is not worse
than 1.25 x it), is not this change's: BOTH, reported and not failed. --tol-scale S (noisy machines: GitHub's virtual
ones) widens the timing and GPU-memory kinds' allowance over the base S-fold, and the margin of IMPROVED with it.
Exit code: 0 when nothing failed, 1 otherwise, 2 on a usage error.

Entry point for test/regress/compare.py: main(argv) -> int.
"""
import argparse
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEF_BASELINE = os.path.join(HERE, 'perf', 'baseline.json')
DEF_RESULTS = os.path.join(HERE, 'perf', 'results', 'latest.json')
KIB = 1024

# kind -> (direction, rule text, limit(base, metric) -> worst acceptable value, better(base, new) -> improved?)
#   lower is better: fail if new > limit;  higher is better: fail if new < limit
TOL = {
    # per-frame time (main thread + GPU-synchronised), percentiles over the frames of an interaction
    'frame_ms': ('lower', 'new <= max(1.15 x base, base + 2 ms)',
                 lambda b, m: max(1.15 * b, b + 2.0),
                 lambda b, n: n < min(b / 1.15, b - 2.0)),
    # CPU work measured in the page: listener time per input event, mesh builds, the synchronous part of a load
    'cpu_ms': ('lower', 'new <= max(1.20 x base, base + 1 ms)',
               lambda b, m: max(1.20 * b, b + 1.0),
               lambda b, n: n < min(b / 1.20, b - 1.0)),
    # input event -> end of the frame that showed it (includes waiting for the next vsync, so +8 ms slack)
    'latency_ms': ('lower', 'new <= max(1.25 x base, base + 8 ms)',
                   lambda b, m: max(1.25 * b, b + 8.0),
                   lambda b, n: n < min(b / 1.25, b - 8.0)),
    # the longest frame or long task between the end of an input and the settled view (one value per rep, so a
    # frame of slack: an unsliced CPU job of >= 50 ms still fails)
    'jank_ms': ('lower', 'new <= max(1.25 x base, base + 16 ms)',
                lambda b, m: max(1.25 * b, b + 16.0),
                lambda b, n: n < min(b / 1.25, b - 16.0)),
    # time until the view is fully refined (LEDs idle, no drawing for 600 ms); a metric may carry budget_ms, an
    # absolute allowance for work the current code does not do yet (right-plane refinement)
    'settle_ms': ('lower', 'new <= max(1.25 x base + 50 ms, budget_ms)',
                  lambda b, m: max(1.25 * b + 50.0, m.get('budget_ms') or 0.0),
                  lambda b, n: n < (b - 50.0) / 1.25),
    # one-shot latencies: an example's first frame, the frame that rebuilds every mesh (min of 5)
    'oneshot_ms': ('lower', 'new <= 1.25 x base + 50 ms',
                   lambda b, m: 1.25 * b + 50.0,
                   lambda b, n: n < (b - 50.0) / 1.25),
    # frames per second while dragging / zooming (an input event every 16 ms)
    'throughput': ('higher', 'new >= 0.90 x base',
                   lambda b, m: 0.90 * b,
                   lambda b, n: n > b / 0.90),
    # live / peak bytes in WebGL buffers, textures and renderbuffers
    'mem_bytes': ('lower', 'new <= 1.25 x base + 64 KiB',
                  lambda b, m: 1.25 * b + 64 * KIB,
                  lambda b, n: n < (b - 64 * KIB) / 1.25),
    # mesh quality: relative area error of a bounded shape's mesh
    'quality_err': ('lower', 'new <= max(1.5 x base, base + 0.002)',
                    lambda b, m: max(1.5 * b, b + 0.002),
                    lambda b, n: n < min(b / 1.5, b - 0.002)),
    # mesh quality: 5th percentile of the smallest triangle angle (degrees)
    'quality_min': ('higher', 'new >= base - 2 deg',
                    lambda b, m: b - 2.0,
                    lambda b, n: n > b + 2.0),
    # share of the window covered by the mesh of a shape (1 = the whole shape inside the window is meshed)
    'coverage': ('higher', 'new >= base - 0.005',
                 lambda b, m: b - 0.005,
                 lambda b, n: n > b + 0.005),
}
# The user's rule (2026-10-20): "60 fps is enough". A timing metric that is worse than its relative tolerance still
# PASSES when it stays inside an absolute 60 fps budget with headroom for slower machines and the compositor: a frame
# (main thread + GPU-synchronised) <= 14 ms of the 16.7 ms frame (2.7 ms left for the compositor; lead decision
# 2026-10-20, first set at 12 ms), input-to-display latency <= 40 ms (the input's own
# frame plus about two 60 Hz frames), the longest frame after an input <= 20 ms (at most one marginal 60 Hz frame),
# and >= 55 frames/s while dragging. Memory, settle times, one-shot latencies and CPU work keep their relative rules.
BUDGET60 = {'frame_ms': ('lower', 14.0), 'latency_ms': ('lower', 40.0), 'jank_ms': ('lower', 20.0), 'throughput': ('higher', 55.0)}
# Noise envelope: a baseline merged from several runs keeps every run's value (`runs`). For timing and memory kinds
# the limit is never tighter than the worst baseline run x 1.05 (the same code already measured that much), and
# IMPROVED needs to beat the best baseline run / 1.05 too. Deterministic kinds (mesh quality) have no envelope.
ENVELOPE = {'frame_ms', 'cpu_ms', 'latency_ms', 'jank_ms', 'settle_ms', 'oneshot_ms', 'throughput', 'mem_bytes'}
ENV_MARGIN = 1.05
# the kinds whose allowance --tol-scale widens: the timings, and GPU memory (its peak depends on how far the view
# refined during the measurement, which is timing too)
SCALED = ENVELOPE


def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def fmt(v, unit=''):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if not _num(v):
        return str(v)
    if unit == 'B':
        a = abs(v)
        if a >= 2 ** 20:
            return f'{v / 2 ** 20:.2f} MiB'
        if a >= 2 ** 10:
            return f'{v / 2 ** 10:.1f} KiB'
        return f'{v:.0f} B'
    if abs(v) >= 100:
        s = f'{v:.0f}'
    elif abs(v) >= 10:
        s = f'{v:.1f}'
    else:
        s = f'{v:.3g}'
    return s + (f' {unit}' if unit and unit not in ('', 'B') else '')


def _absolute(m):
    """the absolute verdict of a check / limit metric m (no baseline needed): (status, text) or None"""
    kind, unit, v = m.get('kind'), m.get('unit', ''), m.get('value')
    if kind == 'check':
        return ('PASS', 'ok') if v is True else ('FAIL', f'check failed (value {fmt(v)})')
    if kind == 'limit':
        lim = m.get('limit')
        if not _num(v):
            if m.get('expect'):
                return 'FAIL', f'{fmt(v, unit)}: no value although one was expected (limit {fmt(lim, unit)})'
            return 'PASS', f'{fmt(v, unit)} (nothing measured; limit {fmt(lim, unit)})'
        if _num(lim) and v > lim:
            return 'FAIL', f'{fmt(v, unit)} (over the absolute limit {fmt(lim, unit)})'
        return 'PASS', f'{fmt(v, unit)} (limit {fmt(lim, unit)})'
    return None


def _limit_text(m, unit):
    lim = m.get('limit')
    v = m.get('value')
    if not _num(lim):
        return None
    if not _num(v):
        return f'{fmt(v, unit)} (limit {fmt(lim, unit)}: nothing measured)'
    return f"{fmt(v, unit)} ({'within' if v <= lim else 'OVER'} the limit {fmt(lim, unit)})"


def judge(name, base, new, partial, opt_in_skipped=(), paired=False, scale=1.0):
    """-> (status, text) with status in FAIL, BOTH (paired), IMPROVED, PASS, INFO, NEW, SKIP"""
    if base is None:
        if new is None:
            return 'NEW', 'not in the baseline'
        unit = new.get('unit', '')
        # absolute kinds need no baseline: a NEW check that is not true, or a NEW limit that does not hold, fails
        ab = _absolute(new)
        if ab and ab[0] == 'FAIL':
            return 'FAIL', f"NEW (not in the baseline yet), absolute: {ab[1]} [{new.get('kind')}]"
        lt = _limit_text(new, unit) if new.get('kind') == 'limit' else None
        return 'NEW', f"not in the baseline yet: {lt or fmt(new.get('value'), unit)} [{new.get('kind', 'info')}]"
    kind = base.get('kind', 'info')
    unit = base.get('unit', '')
    if new is None:
        if partial:
            return 'SKIP', 'not run (partial run)'
        if base.get('unit_id') in opt_in_skipped:
            return 'SKIP', 'opt-in unit not run (run.js --swiftshader)'
        return 'FAIL', 'missing from the results'
    bv, nv = base.get('value'), new.get('value')
    if kind == 'check':
        if nv is True:
            return 'PASS', 'ok'
        if paired and bv is not True:
            return 'BOTH', f'check failed on the reference too (value {fmt(nv)}, reference {fmt(bv)})'
        return 'FAIL', f'check failed (value {fmt(nv)}, baseline {fmt(bv)})'
    if kind == 'info':
        if _num(bv) and _num(nv):
            d = nv - bv
            rel = f' ({d / bv * 100:+.0f}%)' if bv else ''
            return 'INFO', f'{fmt(bv, unit)} -> {fmt(nv, unit)}{rel}'
        return 'INFO', f'{fmt(bv, unit)} -> {fmt(nv, unit)}'
    if kind == 'limit':
        lim = new.get('limit', base.get('limit'))
        if not _num(nv):
            if new.get('expect'):
                return 'FAIL', f'{fmt(bv, unit)} -> {fmt(nv, unit)} (no value although one was expected; limit {fmt(lim, unit)})'
            return 'PASS', f'{fmt(bv, unit)} -> {fmt(nv, unit)} (nothing measured; limit {fmt(lim, unit)})'
        if _num(lim) and nv > lim:
            if paired and _num(bv) and bv > lim and nv <= bv + 0.25 * bv * scale:
                return 'BOTH', f'{fmt(bv, unit)} -> {fmt(nv, unit)} (the reference is over the absolute limit {fmt(lim, unit)} too, and this is not worse than {1 + 0.25 * scale:g} x it)'
            return 'FAIL', f'{fmt(bv, unit)} -> {fmt(nv, unit)} (over the absolute limit {fmt(lim, unit)})'
        return 'PASS', f'{fmt(bv, unit)} -> {fmt(nv, unit)} (limit {fmt(lim, unit)})'
    if kind not in TOL:
        return 'INFO', f'unknown kind {kind}: {fmt(bv, unit)} -> {fmt(nv, unit)}'
    direction, rule, limit_f, better_f = TOL[kind]
    if not _num(bv):
        if _num(nv):
            return 'IMPROVED', f'baseline {fmt(bv)} -> {fmt(nv, unit)}'
        return 'PASS', f'baseline {fmt(bv)}, now {fmt(nv)}'
    if not _num(nv):
        return 'FAIL', f'{fmt(bv, unit)} -> {fmt(nv)} (no value: timeout or harness failure)'
    lim = limit_f(bv, base)
    better = better_f(bv, nv)
    if scale != 1 and kind in SCALED:
        lim = bv + (lim - bv) * scale
        better = better_f(bv, bv + (nv - bv) / scale)
        rule += f'; allowance x {scale:g}'
    runs = [v for v in (base.get('runs') or []) if _num(v)]
    if kind in ENVELOPE and len(runs) > 1:
        if direction == 'lower':
            env = max(runs) * ENV_MARGIN
            if env > lim:
                lim, rule = env, rule + '; or <= worst baseline run x 1.05'
            better = better and nv < min(runs) / ENV_MARGIN
        else:
            env = min(runs) / ENV_MARGIN
            if env < lim:
                lim, rule = env, rule + '; or >= worst baseline run / 1.05'
            better = better and nv > max(runs) * ENV_MARGIN
    ok = nv <= lim if direction == 'lower' else nv >= lim
    d = nv - bv
    rel = f'{d / bv * 100:+.0f}%' if bv else f'{d:+.3g}'
    txt = f'{fmt(bv, unit)} -> {fmt(nv, unit)} ({rel}; limit {fmt(lim, unit)}; {rule})'
    if not ok and kind in BUDGET60:
        bdir, bval = BUDGET60[kind]
        if (nv <= bval) if bdir == 'lower' else (nv >= bval):
            return 'PASS', txt + f'; within the 60 fps budget ({"<=" if bdir == "lower" else ">="} {fmt(bval, unit)})'
    if not ok:
        return 'FAIL', txt
    if better:
        return 'IMPROVED', txt
    return 'PASS', txt


ACCEPTED_FILE = os.path.join(HERE, 'perf', 'accepted.json')


def _accepted():
    """Exceptions the user accepted (perf/accepted.json): metric -> {max, date, reason}. A listed FAIL is ACCEPTED
    only while its value stays at or below max."""
    try:
        with open(ACCEPTED_FILE) as fh:
            return json.load(fh).get('metrics', {})
    except (OSError, ValueError):
        return {}


def compare(baseline, results, show_all=False, out=None, paired=False, scale=1.0):
    out = out or sys.stdout
    bm, rm = baseline.get('metrics', {}), results.get('metrics', {})
    rmeta, bmeta = results.get('meta', {}), baseline.get('meta', {})
    partial = bool(rmeta.get('only') or rmeta.get('skip') or rmeta.get('quick'))
    opt_in_skipped = set(rmeta.get('optInSkipped') or [])
    rows = []
    acc = _accepted()
    for name in sorted(set(bm) | set(rm)):
        status, text = judge(name, bm.get(name), rm.get(name), partial, opt_in_skipped, paired, scale)
        if status == 'FAIL' and name in acc:
            nv = (rm.get(name) or {}).get('value')
            if _num(nv) and nv <= acc[name].get('max', -math.inf):
                status = 'ACCEPTED'
                text = text + '; accepted exception (max %s, %s): %s' % (acc[name]['max'], acc[name].get('date', ''), acc[name].get('reason', ''))
        rows.append({'metric': name, 'status': status, 'text': text, 'kind': (bm.get(name) or rm.get(name) or {}).get('kind'),
                     'base': (bm.get(name) or {}).get('value'), 'new': (rm.get(name) or {}).get('value'),
                     'name': (bm.get(name) or rm.get(name) or {}).get('name')})
    counts = {}
    for r in rows:
        counts[r['status']] = counts.get(r['status'], 0) + 1

    p = lambda *a: print(*a, file=out)
    p('=' * 100)
    p('PERF  baseline: %s (%s)' % (bmeta.get('date', '?'), bmeta.get('app', {}).get('src', '?')))
    p('      results:  %s (%s)%s' % (rmeta.get('date', '?'), rmeta.get('app', {}).get('src', '?'), '  [partial run]' if partial else ''))
    warn = []
    bb, rb = bmeta.get('browser', {}), rmeta.get('browser', {})
    bmc, rmc = bmeta.get('machine', {}), rmeta.get('machine', {})
    if (bmc.get('cpu'), bmc.get('cores'), bmc.get('platform')) != (rmc.get('cpu'), rmc.get('cores'), rmc.get('platform')):
        warn.append(f"machine differs from the baseline's ({bmc.get('cpu')} {bmc.get('platform')} vs {rmc.get('cpu')} {rmc.get('platform')}): timings are not comparable; record a baseline on this machine")
    if bb.get('product') != rb.get('product'):
        warn.append(f"browser differs ({bb.get('product')} vs {rb.get('product')})")
    if bb.get('gpu') != rb.get('gpu'):
        warn.append(f"GPU differs ({bb.get('gpu')} vs {rb.get('gpu')})")
    la = rmc.get('loadavgStart') or []
    if la and rmc.get('cores') and la[0] > 0.75 * rmc['cores']:
        warn.append(f"the machine was busy when the run started (load {la[0]} on {rmc['cores']} cores): re-run failures before trusting them")
    if results.get('errors'):
        warn.append(f"the run reported {len(results['errors'])} error(s): {json.dumps(results['errors'])[:400]}")
    for w in warn:
        p('  WARNING: ' + w)
    order = {'FAIL': 0, 'ACCEPTED': 1, 'BOTH': 2, 'IMPROVED': 3, 'NEW': 4, 'SKIP': 5, 'INFO': 6, 'PASS': 7}
    # NEW metrics (not in the baseline yet): one line per unit, every metric with --all (a NEW check or limit that
    # fails its absolute rule is a FAIL row, listed one by one)
    shown = [r for r in rows if r['status'] in ('FAIL', 'ACCEPTED', 'BOTH', 'IMPROVED') or show_all]
    shown.sort(key=lambda r: (order[r['status']], r['metric']))
    width = max([len(r['metric']) for r in shown] + [10])
    for r in shown:
        nm = f"  [{r['name']}]" if r.get('name') else ''
        p(f"  {r['status']:<8} {r['metric']:<{width}}  {r['text']}{nm}")
    if not show_all:
        per = {}
        for r in rows:
            if r['status'] == 'NEW':
                u = (rm.get(r['metric']) or {}).get('unit_id') or r['metric'].split('.')[0]
                per[u] = per.get(u, 0) + 1
        for u in sorted(per):
            p(f"  {'NEW':<8} {u}: {per[u]} metric(s) not in the baseline yet (reported, not gated; --all lists them)")
    p('PERF  ' + ', '.join(f'{k}: {counts[k]}' for k in sorted(counts, key=lambda k: order.get(k, 9))) +
      ('  ->  FAIL' if counts.get('FAIL') else '  ->  PASS'))
    return {'counts': counts, 'rows': rows, 'warnings': warn, 'failed': counts.get('FAIL', 0)}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--baseline', default=DEF_BASELINE)
    ap.add_argument('--results', default=DEF_RESULTS)
    ap.add_argument('--all', action='store_true', help='also list passing and info metrics')
    ap.add_argument('--json', help='write the comparison as JSON to this file')
    ap.add_argument('--paired', action='store_true', help='the baseline is the reference measured in the same run on the same machine (CI): checks and limits that fail there too are BOTH, not FAIL')
    ap.add_argument('--tol-scale', type=float, default=1.0, metavar='S', help="widen the timing and GPU-memory kinds' allowance over the base S-fold (noisy machines)")
    ap.add_argument('--failing-units', metavar='FILE', help='write the ids of the units with failing metrics to FILE (one per line; used by perf/run.sh to re-run them)')
    a = ap.parse_args(argv)
    for f in (a.baseline, a.results):
        if not os.path.exists(f):
            print(f'compare_perf: {f} not found', file=sys.stderr)
            return 2
    with open(a.baseline) as fh:
        baseline = json.load(fh)
    with open(a.results) as fh:
        results = json.load(fh)
    rep = compare(baseline, results, show_all=a.all, paired=a.paired, scale=a.tol_scale)
    if a.failing_units:
        units = set()
        for r in rep['rows']:
            if r['status'] != 'FAIL':
                continue
            m = results['metrics'].get(r['metric']) or baseline['metrics'].get(r['metric']) or {}
            units.add(m.get('unit_id') or '*')
        with open(a.failing_units, 'w') as fh:
            fh.write(''.join(u + '\n' for u in sorted(units)))
    if a.json:
        with open(a.json, 'w') as fh:
            json.dump(rep, fh, indent=1)
    return 1 if rep['failed'] else 0


if __name__ == '__main__':
    sys.exit(main())
