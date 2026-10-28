#!/usr/bin/env python3
"""Certified reference values of the catalog's steps (src/funcs.js, default parameters) and of the elementary functions
of src/cx.js, from Arb's ball arithmetic (FLINT, through python-flint). A development tool (issue #9): nothing here
ships, and CI does not run it.

    pip install python-flint
    python3 tools/arb_reference.py [-o notes/arb/reference.json] [--prec 256]

Each point is evaluated at --prec bits (default 256), and at 4 and 16 times that where a component is far smaller than
the other; every value is a ball, its midpoint written with 40 significant digits and its radius, and each component
is known to 30 digits (or is below the smallest double). A value beyond the double range is written "overflow". A value whose ball contains a branch cut or a pole is written null: the point sits on
it, and the function's side there is a convention, not a number to certify. tools/arb_compare.js compares cx.js and
funcs.js with this file.
"""
import argparse
import json
import math
import pathlib

import flint
from flint import acb, arb

ROOT = pathlib.Path(__file__).resolve().parent.parent

# the hard points: near zeros, poles, branch points and cuts, at large and tiny |z|, on the unit circle, near the
# real zeros of sin and cos, where exp nearly overflows. Each is a double (the value cx.js sees), named for the report.
EPS = 2.0 ** -52
PTS = [
    ('0.3+0.7i', 0.3, 0.7), ('-0.4+0.2i', -0.4, 0.2), ('0.8-0.5i', 0.8, -0.5), ('1.3+0.4i', 1.3, 0.4), ('-2-3i', -2.0, -3.0),
    ('tiny 1e-8+1e-9i', 1e-8, 1e-9), ('tiny 1e-150-1e-160i', 1e-150, -1e-160), ('tiny imag 1e-12i', 0.0, 1e-12),
    ('large 1e3+1e3i', 1e3, 1e3), ('large 1e8-3e7i', 1e8, -3e7), ('large imag 3+40i', 3.0, 40.0), ('large real -40+0.3i', -40.0, 0.3),
    ('|z|=1, 1e-12 off: 0.6+0.8i', 0.6, 0.8 + 1e-12), ('near 1: 1+1e-9i', 1.0, 1e-9), ('near 1: 1-1e-10+1e-12i', 1 - 1e-10, 1e-12),
    ('near -1: -1+1e-9-1e-9i', -1 + 1e-9, -1e-9), ('near i: 1e-9+(1+1e-9)i', 1e-9, 1 + 1e-9), ('near -i: -1e-9-(1-1e-9)i', -1e-9, -(1 - 1e-9)),
    ('near pi: pi+1e-9i', math.pi, 1e-9), ('near pi/2: pi/2+1e-10', math.pi / 2 + 1e-10, 0.0), ('near 10pi: 10pi+0.5i', 10 * math.pi, 0.5),
    ('near the pole of tan: pi/2+1e-12i', math.pi / 2, 1e-12),
    ('above the cut: -2+1e-15i', -2.0, 1e-15), ('below the cut: -2-1e-15i', -2.0, -1e-15), ('above the cut: -0.5+1e-300i', -0.5, 1e-300),
    ('near 0 on the cut: -1e-9+1e-18i', -1e-9, 1e-18),
    ('near exp overflow: 700+1i', 700.0, 1.0), ('exp underflow: -700+2i', -700.0, 2.0),
    ('near the pole of mobius: 1e-9-(1-1e-12)i', 1e-9, -(1 - 1e-12)), ('near the zero of mobius: 1e-12+(1+1e-13)i', 1e-12, 1 + 1e-13),
    ('near the pole of blaschke: 2+1e-9i', 2.0, 1e-9), ('near the zero of poly: 1+1e-10i', 1.0, 1e-10),
    ('near the zero of zp/rational: 1e-9+(1+1e-10)i', 1e-9, 1.0 + 1e-10), ('near ijouk branch point: 1+1e-8+1e-8i', 1 + 1e-8, 1e-8),
]


def C(x, y):
    return acb(arb(x), arb(y))


IU = acb(0, 1)   # i



# the catalog's steps at their default parameters (Funcs.defaults), as Arb expressions; the principal branches (cut 180,
# k = 0) are Arb's (and C99's) standard cuts
def steps():
    a = acb(0.5)
    return {
        'mul': lambda z: 2 * z,
        'add': lambda z: z + 1,
        'affine': lambda z: acb(1, 1) * z,
        'recip': lambda z: 1 / z,
        'mobius': lambda z: (z - IU) / (z + IU),
        'blaschke': lambda z: (z - a) / (1 - a.conjugate() * z),
        'pown': lambda z: z ** 2,
        'root': lambda z: z.sqrt(),
        'powa': lambda z: (acb(1.5) * z.log()).exp(),
        'exp': lambda z: z.exp(),
        'log': lambda z: z.log(),
        'sin': lambda z: z.sin(), 'cos': lambda z: z.cos(), 'tan': lambda z: z.tan(),
        'sinh': lambda z: z.sinh(), 'cosh': lambda z: z.cosh(), 'tanh': lambda z: z.tanh(),
        'arcsin': lambda z: z.asin(), 'arccos': lambda z: z.acos(), 'arctan': lambda z: z.atan(),
        'arsinh': lambda z: z.asinh(), 'arcosh': lambda z: z.acosh(), 'artanh': lambda z: z.atanh(),
        'joukowski': lambda z: (z + 1 / z) / 2,
        'ijouk': lambda z: z + (z - 1).sqrt() * (z + 1).sqrt(),
        'conj': lambda z: z.conjugate(),
        'poly': lambda z: z ** 3 - z,
        'rational': lambda z: (z ** 2 + 1) / z,
        'zp': lambda z: (z - 1) * (z + 1) / z,
        'custom': lambda z: z ** 2 + 1 / z,
    }


def tight(x):
    """an arb component known to 30 digits, or so small that a double holds it as 0"""
    m, r = abs(float(x.mid())), float(x.rad())
    return r <= 1e-30 * m or m + r < 1e-320


def ball(v):
    """(midpoint re, im as 40-digit strings, radius) of an acb; 'overflow'; or None when it is not finite or a
    component is not tight (the caller retries at a higher precision)"""
    if not v.is_finite():
        return None
    re, im = v.real, v.imag
    if math.isinf(float(re.mid())) or math.isinf(float(im.mid())):
        return 'overflow'   # (beyond the double range: a double can only be infinite here)
    if not (tight(re) and tight(im)):
        return None
    return [re.mid().str(40, radius=False), im.mid().str(40, radius=False), max(float(re.rad()), float(im.rad()))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', '--out', default=str(ROOT / 'notes' / 'arb' / 'reference.json'))
    ap.add_argument('--prec', type=int, default=256)
    o = ap.parse_args()
    flint.ctx.prec = o.prec
    out = {'about': f'tools/arb_reference.py: certified values (Arb ball arithmetic, python-flint {flint.__version__}, {o.prec} bits) of the catalog steps at their default parameters',
           'points': [[n, x, y] for n, x, y in PTS], 'steps': {}}
    for sid, f in steps().items():
        vals = []
        for _, x, y in PTS:
            # (a component far below the other, e.g. 1e-300 next to 0.35, needs more bits than --prec: up to 16x, then
            # null: a ball still this wide straddles a cut or a pole)
            v = None
            for prec in (o.prec, 4 * o.prec, 16 * o.prec):
                flint.ctx.prec = prec
                try:
                    v = ball(f(C(x, y)))
                except (ZeroDivisionError, ValueError):
                    v = None
                if v is not None:
                    break
            vals.append(v)
        out['steps'][sid] = vals
    p = pathlib.Path(o.out)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, indent=0) + '\n', encoding='utf-8')
    n = sum(v is not None for vs in out['steps'].values() for v in vs)
    print(f'{p}: {len(out["steps"])} steps x {len(PTS)} points, {n} certified values')


if __name__ == '__main__':
    main()
