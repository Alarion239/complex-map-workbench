#!/usr/bin/env python3
"""Certified reference values of the Douady-Hubbard map Phi_M (issue #260), the conformal map of the outside of the
Mandelbrot set M onto the outside of the closed unit disc with Phi_M(c)/c -> 1 at infinity, and of the Boettcher
coordinate phi_c of z -> z^2 + c for the basilica c = -1 (src/funcs.js 'bottcher'). A development tool, as
tools/arb_reference.py: nothing here ships, and CI does not run it.

    pip install mpmath
    python3 tools/dh_reference.py [-o test/fixtures/dh_reference.json] [--dps 50]

Each point c is evaluated at --dps digits by the app's own rule (src/funcs.js 'dh'): iterate z_{k+1} = z_k^2 + c from
z_1 = c until |z_n| > 1e40, take phi(z_n) = z_n (1 + c/z_n^2)^(1/2), then n - 1 square roots, each the one nearest the
orbit point z_{k-1}. The value is then certified as the continuation of Phi_M from infinity, independently of that rule:
the external ray of its angle is traced from |c| = 64 down to its level by Newton's method on z_m(c) = w^(2^(m-1))
(T. Kawahira, An algorithm to draw external rays of the Mandelbrot set, 2009), m large enough that the target is beyond
1e40, and must land back on c (to 1e-30). A point that fails is reported, not written. phi_c(z) the same way: the orbit
of z, and its dynamic ray traced by Newton in z on w_m(z) = phi^(2^m), c fixed.
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
# phi_c for the basilica c = -1, outside its filled Julia set: far out, beyond the tip 1.618, above the main body, near
# the alpha fixed point -0.618 and by the left lobe
JC = (-1, 0)
JPTS = [
    ('basilica far 3+4i', 3, 4), ('basilica beyond the tip 1.65', 1.65, 0.0), ('basilica above 0.1+0.75i', 0.1, 0.75),
    ('basilica near alpha -0.62+0.1i', -0.62, 0.1), ('basilica by the left lobe -1.3+0.3i', -1.3, 0.3),
]


def phi_rule(z0, c, nmax=4000):
    """phi_c(z0): the orbit w_0 = z0, w_{k+1} = w_k^2 + c (Phi_M(c) = phi_c(c))."""
    z = z0
    orb = [z]
    for _ in range(nmax):
        if abs(z) > mp.mpf('1e40'):
            break
        z = z * z + c
        orb.append(z)
    else:
        return None
    w = orb[-1] * mp.sqrt(1 + c / orb[-1] ** 2)
    for k in range(len(orb) - 2, -1, -1):
        r = mp.sqrt(w)
        if abs(r - orb[k]) > abs(-r - orb[k]):
            r = -r
        w = r
    return w


def wm(x, m, c):
    """w_m and its derivative in x, from w_0 = x: the parameter (c None: w_{k+1} = w_k^2 + x) or the point (c fixed)."""
    w, d = x, mp.mpc(1)
    for _ in range(m):
        d = 2 * w * d + (0 if c is not None else 1)
        w = w * w + (c if c is not None else x)
    return w, d


def trace_to(theta, level, c=None, S=32, R=64):
    """The point of the external ray of angle theta (turns) at |Phi| = level (|phi_c| with c), from |x| = R."""
    R = mp.mpf(R)
    x = R * mp.expjpi(2 * theta)
    lr, ll = mp.log(R), mp.log(level)
    steps = int(mp.ceil(S * mp.log(lr / ll, 2)))
    for j in range(1, steps + 1):
        r = mp.exp(lr * mp.power(ll / lr, mp.mpf(j) / steps))
        m = 0
        while abs(r) ** (2 ** m) < mp.mpf('1e40'):
            m += 1
        t = mp.power(r, 2 ** m) * mp.expjpi(2 * mp.frac(theta * 2 ** m))
        for _ in range(200):
            w, d = wm(x, m, c)
            dx = (w - t) / d
            x -= dx
            if abs(dx) < mp.mpf(10) ** (-mp.mp.dps + 5) * (1 + abs(x)):
                break
    return x


def certify(name, x, y, c, out):
    z = mp.mpc(x, y)
    w = phi_rule(z, z if c is None else c)
    if w is None:
        print('inside or too close:', name)
        return 1
    theta = mp.frac(mp.arg(w) / (2 * mp.pi))
    back = trace_to(theta, abs(w), c)
    err = abs(back - z)
    ok = err < mp.mpf('1e-30')
    print(f'{name}: phi = {mp.nstr(w, 25)}  ray back: {mp.nstr(err, 3)} {"ok" if ok else "FAILED"}')
    if not ok:
        return 1
    out.append({'name': name, 'z': [x, y], 'phi': [mp.nstr(w.real, 40), mp.nstr(w.imag, 40)]})
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', default=str(ROOT / 'test' / 'fixtures' / 'dh_reference.json'))
    ap.add_argument('--dps', type=int, default=50)
    a = ap.parse_args()
    mp.mp.dps = a.dps
    out, jout, bad = [], [], 0
    for name, x, y in PTS:
        bad += certify(name, x, y, None, out)
    for name, x, y in JPTS:
        bad += certify(name, x, y, mp.mpc(*JC), jout)
    doc = {'_about': f'Phi_M at points outside M, and phi_c for c = {JC}, certified by tools/dh_reference.py (mpmath, '
           f'{a.dps} digits): the external ray of each value\'s angle, traced from infinity, lands back on the point to '
           '1e-30.', 'points': out, 'julia': {'c': list(JC), 'points': jout}}
    pathlib.Path(a.o).write_text(json.dumps(doc, indent=1) + '\n', encoding='utf-8')
    print(f'{len(out) + len(jout)} points written to {a.o}; {bad} failed')
    return 1 if bad else 0


if __name__ == '__main__':
    raise SystemExit(main())
