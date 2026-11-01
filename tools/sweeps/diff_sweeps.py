#!/usr/bin/env python3
"""Compares two sweep outputs (phone_portrait_sweep.js or phone_landscape_sweep.js, saved as JSON): prints what the
second has that the first lacks, per size-language and surface, for the four findings the sweeps measure:
small (a control under 44 px), covered (another element on top at its centre), offs (outside the viewport) and overl
(two controls overlapping). Usage: diff_sweeps.py before.json after.json"""
import json, sys
a, b = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
n = 0
for k in b:
    for s in b[k]:
        for f in ('small', 'covered', 'offs', 'overl'):
            new = set(map(str, b[k][s].get(f, []))) - set(map(str, a.get(k, {}).get(s, {}).get(f, [])))
            if new:
                n += 1
                print(k, s, f, 'NEW', sorted(new)[:4])
print('compared', len(b), 'entries,', n, 'new findings')
