#!/usr/bin/env python3
"""Certified reference values of the Douady-Hubbard map Phi_M (issue #260), the conformal map of the outside of the
Mandelbrot set M onto the outside of the closed unit disc with Phi_M(c)/c -> 1 at infinity. A development tool, as
tools/arb_reference.py: nothing here ships, and CI does not run it.

    pip install mpmath
    python3 tools/dh_reference.py [-o test/fixtures/dh_reference.json] [--dps 50]

Each point c is evaluated at --dps digits by the app's own rule (src/funcs.js 'dh'): iterate z_{k+1} = z_k^2 + c from
z_1 = c until |z_n| > 1e40, take phi(z_n) = z_n (1 + c/z_n^2)^(1/2), then n - 1 square roots, each the one nearest the
orbit point z_{k-1}. The value is then certified as the continuation of Phi_M from infinity, independently of that rule:
the external ray of its angle is traced from |c| = 64 down to its level by Newton's method on z_m(c) = w^(2^(m-1))
(T. Kawahira, An algorithm to draw external rays of the Mandelbrot set, 2009), m large enough that the target is beyond
1e40, and must land back on c (to 1e-30). A point that fails is reported, not written.
"""
import argparse
import json
import pathlib

import mpmath as mp

ROOT = pathlib.Path(__file__).resolve().parent.parent

# outside M: far out, on the real axis beyond the tip, near the tip -2, near i (the ray 1/6), near the cusp 1/4, in the
# 1/3 wake above -3/4, by an antenna, near the root of the period-3 bulb, between bulbs, close to the main cardioid
PTS = [
    ('far 10+20i', 10, 20), ('|c|=3 at 2i-2', -2.2, 2.0), ('beyond the tip -2.1', -2.1, 0.0), ('near the tip -1.99+0.02i', -1.99, 0.02),
    ('near i 0.01+1.02i', 0.01, 1.02), ('near the cusp 0.28', 0.28, 0.0), ('in the 1/3 wake -0.75+0.08i', -0.75, 0.08),
    ('by an antenna -1.7+0.05i', -1.7, 0.05), ('by the period-3 bulb -0.2+0.66i', -0.2, 0.66), ('between bulbs 0.4+0.3i', 0.4, 0.3),
]


def phi_rule(c, nmax=4000):
    z = mp.mpc(0)
    orb = []
    for _ in range(nmax):
        z = z * z + c
        orb.append(z)
        if abs(z) > mp.mpf('1e40'):
            break
    else:
        return None
    w = orb[-1] * mp.sqrt(1 + c / orb[-1] ** 2)
    for k in range(len(orb) - 2, -1, -1):
        r = mp.sqrt(w)
        if abs(r - orb[k]) > abs(-r - orb[k]):
            r = -r
        w = r
    return w


def zm(c, m):
    z, dz = mp.mpc(0), mp.mpc(0)
    for _ in range(m):
        dz = 2 * z * dz + 1
        z = z * z + c
    return z, dz


def trace_to(theta, level, S=32, R=mp.mpf(64)):
    """The point of the external ray of angle theta (turns) at |Phi| = level, by continuation from |c| = R."""
    c = R * mp.expjpi(2 * theta)
    lr, ll = mp.log(R), mp.log(level)
    steps = int(mp.ceil(S * mp.log(lr / ll, 2)))
    for j in range(1, steps + 1):
        r = mp.exp(lr * mp.power(ll / lr, mp.mpf(j) / steps))
        m = 1
        while abs(r) ** (2 ** (m - 1)) < mp.mpf('1e40'):
            m += 1
        t = mp.power(r, 2 ** (m - 1)) * mp.expjpi(2 * mp.frac(theta * 2 ** (m - 1)))
        for _ in range(200):
            z, dz = zm(c, m)
            d = (z - t) / dz
            c -= d
            if abs(d) < mp.mpf(10) ** (-mp.mp.dps + 5) * (1 + abs(c)):
                break
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', default=str(ROOT / 'test' / 'fixtures' / 'dh_reference.json'))
    ap.add_argument('--dps', type=int, default=50)
    a = ap.parse_args()
    mp.mp.dps = a.dps
    out, bad = [], 0
    for name, x, y in PTS:
        c = mp.mpc(x, y)
        w = phi_rule(c)
        if w is None:
            print('inside or too close:', name)
            bad += 1
            continue
        theta = mp.frac(mp.arg(w) / (2 * mp.pi))
        back = trace_to(theta, abs(w))
        err = abs(back - c)
        ok = err < mp.mpf('1e-30')
        print(f'{name}: Phi = {mp.nstr(w, 25)}  ray back to c: {mp.nstr(err, 3)} {"ok" if ok else "FAILED"}')
        if not ok:
            bad += 1
            continue
        out.append({'name': name, 'c': [x, y], 'phi': [mp.nstr(w.real, 40), mp.nstr(w.imag, 40)]})
    doc = {'_about': 'Phi_M at points outside M, certified by tools/dh_reference.py (mpmath, %d digits): the external ray '
           'of each value\'s angle, traced from infinity, lands back on c to 1e-30.' % a.dps, 'points': out}
    pathlib.Path(a.o).write_text(json.dumps(doc, indent=1) + '\n', encoding='utf-8')
    print(f'{len(out)} points written to {a.o}; {bad} failed')
    return 1 if bad else 0


if __name__ == '__main__':
    raise SystemExit(main())
