#!/usr/bin/env python3
"""Merge perf-suite result files: per metric, the median of the values of every run that has it.

    python3 test/regress/perf/merge_runs.py FIRST.json MORE.json ... -o MERGED.json

Used twice:
  * perf/run.sh confirms failures: FIRST is the full run, MORE are re-runs of only the units that failed; every metric
    of a re-run unit becomes the median of its 3 attempts (a real regression fails again, a noise spike does not).
  * make_baseline.py merges 3 full runs into a baseline.
Checks merge to true only if true in every run (--checks majority: in most runs, for confirmation re-runs), except
suite.no_errors: false whenever any run reported an error, so a unit that errored in the full run and was not re-run
still fails the merged verdict. The merged file keeps FIRST's meta (so a full run stays full) and records the attempts
per metric in `runs`.
"""
import argparse
import json
import os
import statistics
import sys


def _isnum(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def merge(runs, names=None, checks='all'):
    """checks: 'all' (a check is true only if true in every run: baselines) or 'majority' (confirmation re-runs)"""
    first = runs[0]
    out = {'meta': dict(first.get('meta', {})), 'metrics': {}, 'details': first.get('details', {}),
           'errors': [e for r in runs for e in (r.get('errors') or [])]}
    names = sorted(set().union(*[r.get('metrics', {}).keys() for r in runs])) if names is None else names
    for n in names:
        ms = [r['metrics'][n] for r in runs if n in r.get('metrics', {})]
        if not ms:
            continue
        m0 = dict(ms[0])
        vals = [m.get('value') for m in ms]
        if len(ms) > 1:
            if m0.get('kind') == 'check':
                ok = sum(1 for v in vals if v is True)
                m0['value'] = ok == len(vals) if checks == 'all' else ok * 2 > len(vals)
            else:
                nums = [v for v in vals if _isnum(v)]
                # a null (timeout) in any attempt counts as worse than every number: it can win the median
                if len(nums) < len(vals):
                    m0['value'] = None if len(nums) * 2 <= len(vals) else round(statistics.median(nums + [max(nums)] * (len(vals) - len(nums))), 3)
                else:
                    m0['value'] = round(statistics.median(nums), 3) if nums else None
            m0['runs'] = vals
            m0['reps'] = [x for m in ms for x in (m.get('reps') or [])]
            b = [m['budget_ms'] for m in ms if _isnum(m.get('budget_ms'))]
            if b:
                m0['budget_ms'] = round(statistics.median(b), 3)
        out['metrics'][n] = m0
    # an error of a unit in any run holds suite.no_errors false: the confirmation re-runs repeat only the units with a
    # failing metric, so a unit that errored is not in them and their true values must not outvote it
    if 'suite.no_errors' in out['metrics'] and out['errors']:
        out['metrics']['suite.no_errors']['value'] = False
    out['meta']['merged_from'] = [r.get('meta', {}).get('date') for r in runs]
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('runs', nargs='+')
    ap.add_argument('-o', '--out', required=True)
    ap.add_argument('--checks', choices=['all', 'majority'], default='all', help="how checks merge: true in all runs (default) or in most")
    a = ap.parse_args(argv)
    runs = []
    for f in a.runs:
        with open(f) as fh:
            runs.append(json.load(fh))
    srcs = {r.get('meta', {}).get('app', {}).get('src') for r in runs}
    if len(srcs) > 1:
        print(f'the runs measured different source trees {srcs}; refusing to merge', file=sys.stderr)
        return 2
    out = merge(runs, checks=a.checks)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w') as fh:
        json.dump(out, fh, indent=1)
    print(f'merged {len(runs)} run(s) into {a.out}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
