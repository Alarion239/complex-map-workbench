#!/usr/bin/env python3
"""Compare the regression suites' latest results with their baselines: performance and image quality.

    python3 test/regress/compare.py                 # both parts, default files
    python3 test/regress/compare.py --perf-all      # options for one part: --perf-<opt> / --quality-<opt>
    python3 test/regress/compare.py --only perf     # one part (perf | quality)

Each part lives in its own module next to this file and exposes  main(argv: list[str]) -> int  (0 = pass):
  compare_perf.py     (perf suite,    test/regress/perf/)
  compare_quality.py  (quality suite, test/regress/quality/)
Options are routed by prefix: --perf-baseline X becomes --baseline X for compare_perf, --quality-results Y becomes
--results Y for compare_quality. A part whose module is missing is reported and skipped.
Exit code: 0 when every part passed, 1 when any part failed, 2 when a part could not run.
"""
import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PARTS = ['perf', 'quality']


def route(argv):
    per = {p: [] for p in PARTS}
    only = None
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--only' and i + 1 < len(argv):
            only = argv[i + 1]
            i += 2
            continue
        part = next((p for p in PARTS if a.startswith(f'--{p}-')), None)
        if part is None:
            print(f'compare.py: unrecognised option {a} (use --perf-<opt> or --quality-<opt>)', file=sys.stderr)
            sys.exit(2)
        opt = '--' + a[len(part) + 3:]
        per[part].append(opt)
        # an option value follows unless the next item is another option
        if i + 1 < len(argv) and not argv[i + 1].startswith('--'):
            per[part].append(argv[i + 1])
            i += 1
        i += 1
    return per, only


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    per, only = route(argv)
    sys.path.insert(0, HERE)
    codes = {}
    for part in PARTS:
        if only and only != part:
            continue
        try:
            mod = importlib.import_module(f'compare_{part}')
        except ModuleNotFoundError as e:
            if e.name == f'compare_{part}':
                print(f'[{part}] compare_{part}.py not present: skipped')
                continue
            raise
        fn = getattr(mod, 'main', None)
        if fn is None:
            print(f'[{part}] compare_{part}.py has no main(argv): skipped', file=sys.stderr)
            codes[part] = 2
            continue
        try:
            rc = fn(per[part])
        except SystemExit as e:  # an argparse error inside the part
            rc = e.code if isinstance(e.code, int) else 2
        codes[part] = int(rc or 0)
    print('=' * 100)
    if not codes:
        print('REGRESS: nothing compared')
        return 2
    for part, rc in codes.items():
        print(f"REGRESS {part:<8} {'PASS' if rc == 0 else 'FAIL' if rc == 1 else 'ERROR'}")
    worst = max(codes.values())
    print(f"REGRESS overall  {'PASS' if worst == 0 else 'FAIL' if worst == 1 else 'ERROR'}")
    return worst


if __name__ == '__main__':
    sys.exit(main())
