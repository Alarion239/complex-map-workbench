#!/usr/bin/env python3
"""Merge several full perf-suite runs into one baseline (per metric: the median of the runs' values).

    python3 test/regress/perf/make_baseline.py RUN1.json RUN2.json RUN3.json [-o test/regress/perf/baseline.json]

A baseline from the median of a few independent runs sits in the middle of the run-to-run noise instead of at
one run's lucky or unlucky end. Checks are true only if true in every run. Only complete runs (no --only / --skip /
--quick, no errors) of the same source tree are accepted. perf/run.sh --update-baseline calls this.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from merge_runs import merge  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('runs', nargs='+')
    ap.add_argument('-o', '--out', default=os.path.join(HERE, 'baseline.json'))
    a = ap.parse_args(argv)
    runs = []
    for f in a.runs:
        with open(f) as fh:
            r = json.load(fh)
        m = r.get('meta', {})
        if m.get('only') or m.get('skip') or m.get('quick'):
            print(f'{f}: not a full run (only/skip/quick); refusing to use it for a baseline', file=sys.stderr)
            return 2
        if r.get('errors'):
            print(f'{f}: the run reported errors; refusing to use it for a baseline: {json.dumps(r["errors"])[:300]}', file=sys.stderr)
            return 2
        runs.append(r)
    srcs = {r['meta'].get('app', {}).get('src') for r in runs}
    if len(srcs) > 1:
        print(f'runs measured different source trees {srcs}; refusing to merge', file=sys.stderr)
        return 2
    names = set().union(*[r['metrics'].keys() for r in runs])
    for n in sorted(names):
        missing = sum(1 for r in runs if n not in r['metrics'])
        if missing:
            print(f'warning: {n} is missing from {missing} run(s)', file=sys.stderr)
    out = merge(runs)
    out['meta']['runs'] = [{k: r['meta'].get(k) for k in ('date', 'seconds', 'machine', 'units')} for r in runs]
    out['meta']['baseline_from'] = [os.path.basename(f) for f in a.runs]
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w') as fh:
        json.dump(out, fh, indent=1)
    print(f'wrote {a.out}: {len(out["metrics"])} metrics from {len(runs)} runs')
    return 0


if __name__ == '__main__':
    sys.exit(main())
