#!/usr/bin/env python3
"""Self-test of the two gates (compare_quality.py, compare_perf.py) on synthetic results.

    python3 test/regress/test_compare.py        # exit 0 when every case passes

Each case writes a small baseline / results pair to a temporary directory and checks the gate's exit status (and,
where it matters, its verdict per run or metric). The cases cover the review findings of phase P0:
  quality  a NEW run that crashed (ok false, no metrics) fails, also when the rest meets every target;
           a target rule that names a run without a value for the metric (missing or null) is NOT MET and fails with
           --enforce-targets; a gated metric with a baseline value that became null fails; color_off is gated
  perf     a NEW check that is false fails; a NEW limit over its limit fails; a limit that expected a value (an
           inverse program was linked) and has none fails, NEW or not; a NEW limit with nothing to measure passes
           [#292] a unit the paired reference cannot run (ref_unsupported) is NEW, not compared, and says why
"""
import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import compare_perf  # noqa: E402
import compare_quality  # noqa: E402

TOL = os.path.join(HERE, 'quality', 'tolerances.json')


def wj(path, obj):
    with open(path, 'w') as f:
        json.dump(obj, f)


def rj(path):
    with open(path) as f:
        return json.load(f)


def run_quiet(fn, argv):
    out = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
        rc = fn(argv)
    return rc, out.getvalue()


def qrun(rid, ok=True, metrics=None, problems=None):
    scene, variant = rid.split('.', 1)
    r = {'id': rid, 'scene': scene, 'variant': variant, 'group': 'infinite', 'golden': False, 'ok': ok, 'problems': problems or []}
    if metrics is not None:
        r['metrics'] = metrics
    return r


META = {'viewport': {'width': 1440, 'height': 900, 'dpr': 1}, 'band_px': 2.5, 'parity_min_cell_px': 3, 'parity_min_edge_px': 1.5,
        'golden_thr': 8, 'browser': 'Chrome/x', 'app_sha1': 'a' * 40, 'date': '2026-10-19T00:00:00'}
GOOD = {'iou': 1, 'hole': 0, 'spill': 0, 'color_off': 0, 'hole_leak': 0, 'opacity_min': 1, 'parity_acc': 1, 'parity_n': 5000}


class Quality(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp(prefix='cmw-cmpq-')

    def tearDown(self):
        shutil.rmtree(self.d, ignore_errors=True)

    def gate(self, base_runs, cur_runs, *extra):
        b, c = os.path.join(self.d, 'b.json'), os.path.join(self.d, 'c.json')
        wj(b, {'meta': META, 'runs': base_runs})
        wj(c, {'meta': META, 'runs': cur_runs})
        j = os.path.join(self.d, 'v.json')
        rc, out = run_quiet(compare_quality.main, ['--baseline', b, '--current', c, '--tolerances', TOL, '--json', j] + list(extra))
        return rc, out, rj(j)

    def test_new_run_ok_is_not_gated(self):
        rc, out, v = self.gate({}, {'zi_H.mask': qrun('zi_H.mask', metrics=dict(GOOD, iou=0.5))})
        self.assertEqual(rc, 0, out)
        self.assertEqual(v['runs']['zi_H.mask'], 'NEW')

    def test_new_run_that_crashed_fails(self):
        cur = {'zi_H.polar': qrun('zi_H.polar', ok=False, problems=['runner error: boom']),
               'zi_H.mask': qrun('zi_H.mask', metrics=dict(GOOD))}
        rc, out, v = self.gate({}, cur)
        self.assertEqual(rc, 1, out)
        self.assertEqual(v['runs']['zi_H.polar'], 'FAIL')
        rc, out, v = self.gate({}, cur, '--enforce-targets')
        self.assertEqual(rc, 1, out)

    def test_target_on_a_run_without_the_metric_is_not_met(self):
        # zi_H.polar must reach parity >= 0.999: a run with no parity value (null, or a crashed run) does not
        cur = {'zi_H.polar': qrun('zi_H.polar', metrics=dict(GOOD, parity_acc=None))}
        rc, out, v = self.gate({}, cur)
        self.assertEqual(rc, 0, out)                       # reported only
        t = [x for x in v['targets'] if x['run'] == 'zi_H.polar' and x['metric'] == 'parity_acc']
        self.assertTrue(t and not t[0]['met'], t)
        rc, out, v = self.gate({}, cur, '--enforce-targets')
        self.assertEqual(rc, 1, out)
        self.assertIn('target not met', out)
        cur = {'zi_H.mask20': qrun('zi_H.mask20', metrics={'iou': 1, 'hole': 0, 'spill': 0, 'color_off': 0, 'hole_leak': 0})}
        rc, out, v = self.gate({}, cur, '--enforce-targets')   # opacity_min missing altogether
        self.assertEqual(rc, 1, out)

    def test_gated_metric_that_became_null_fails(self):
        base = {'zi_H.polar': qrun('zi_H.polar', metrics=dict(GOOD, parity_acc=0.95))}
        cur = {'zi_H.polar': qrun('zi_H.polar', metrics=dict(GOOD, parity_acc=None, parity_n=5000))}
        rc, out, v = self.gate(base, cur)
        self.assertEqual(rc, 1, out)
        self.assertEqual(v['runs']['zi_H.polar'], 'FAIL')

    def test_color_off_is_gated(self):
        base = {'expH.mask': qrun('expH.mask', metrics=dict(GOOD))}
        rc, out, v = self.gate(base, {'expH.mask': qrun('expH.mask', metrics=dict(GOOD, color_off=1.0))})
        self.assertEqual(rc, 1, out)
        rc, out, v = self.gate(base, {'expH.mask': qrun('expH.mask', metrics=dict(GOOD))})
        self.assertEqual(rc, 0, out)


def pm(value, kind, **kw):
    return dict({'value': value, 'kind': kind, 'unit': kw.pop('unit', ''), 'unit_id': kw.pop('unit_id', 'u')}, **kw)


PMETA = {'date': 'x', 'app': {'src': 'x'}, 'machine': {'cpu': 'c', 'cores': 8, 'platform': 'p'}, 'browser': {'product': 'b', 'gpu': 'g'}}


class Perf(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp(prefix='cmw-cmpp-')

    def tearDown(self):
        shutil.rmtree(self.d, ignore_errors=True)

    def gate(self, base, res, *extra):
        b, r = os.path.join(self.d, 'b.json'), os.path.join(self.d, 'r.json')
        wj(b, {'meta': PMETA, 'metrics': base})
        wj(r, {'meta': PMETA, 'metrics': res})
        j = os.path.join(self.d, 'v.json')
        rc, out = run_quiet(compare_perf.main, ['--baseline', b, '--results', r, '--json', j, *extra])
        return rc, out, {row['metric']: row['status'] for row in rj(j)['rows']}

    def test_new_info_and_true_check_pass(self):
        rc, out, st = self.gate({}, {'a.x': pm(3, 'frame_ms'), 'a.ok': pm(True, 'check')})
        self.assertEqual(rc, 0, out)
        self.assertEqual(st, {'a.x': 'NEW', 'a.ok': 'NEW'})

    def test_new_check_false_fails(self):
        for name in ('image.ziH.m240.dpr_ok', 'scrub.mobius_halfplane.no_line_resample', 'gallery.open.no_inverse_compiles'):
            rc, out, st = self.gate({}, {name: pm(False, 'check')})
            self.assertEqual(rc, 1, out)
            self.assertEqual(st[name], 'FAIL')

    def test_new_limit_over_fails(self):
        rc, out, st = self.gate({}, {'examples.13.inv_first_draw_ms': pm(900, 'limit', limit=250, unit='ms')})
        self.assertEqual(rc, 1, out)
        rc, out, st = self.gate({}, {'swiftshader.ratio.disc_cube.ratio': pm(3.4, 'limit', limit=3)})
        self.assertEqual(rc, 1, out)
        rc, out, st = self.gate({}, {'swiftshader.ratio.disc_cube.ratio': pm(1.1, 'limit', limit=3)})
        self.assertEqual(rc, 0, out)

    def test_limit_without_value(self):
        m = 'examples.13.inv_first_draw_ms'
        rc, out, st = self.gate({}, {m: pm(None, 'limit', limit=250)})                    # nothing to measure (before P2)
        self.assertEqual(rc, 0, out)
        rc, out, st = self.gate({}, {m: pm(None, 'limit', limit=250, expect=True)})       # an inverse program was linked
        self.assertEqual(rc, 1, out)
        rc, out, st = self.gate({m: pm(120, 'limit', limit=250)}, {m: pm(None, 'limit', limit=250, expect=True)})
        self.assertEqual(rc, 1, out)
        rc, out, st = self.gate({m: pm(120, 'limit', limit=250)}, {m: pm(None, 'limit', limit=250)})
        self.assertEqual(rc, 0, out)

    def test_baseline_check_still_gated(self):
        rc, out, st = self.gate({'a.ok': pm(True, 'check')}, {'a.ok': pm(False, 'check')})
        self.assertEqual(rc, 1, out)

    def test_paired_failing_on_both_sides(self):
        # (the CI's paired gate: the baseline is the reference app, measured in the same run)
        chk = {'a.ok': pm(False, 'check')}
        rc, out, st = self.gate(chk, chk)
        self.assertEqual(rc, 1, out)
        rc, out, st = self.gate(chk, chk, '--paired')
        self.assertEqual((rc, st['a.ok']), (0, 'BOTH'), out)
        rc, out, st = self.gate({'a.ok': pm(True, 'check')}, chk, '--paired')
        self.assertEqual((rc, st['a.ok']), (1, 'FAIL'), out)
        m = 'examples.2.inv_first_draw_ms'
        def lim(v):
            return {m: pm(v, 'limit', limit=250, unit='ms')}
        rc, out, st = self.gate(lim(2400), lim(1900), '--paired')
        self.assertEqual((rc, st[m]), (0, 'BOTH'), out)
        rc, out, st = self.gate(lim(2400), lim(3100), '--paired')     # over 1.25 x the reference
        self.assertEqual((rc, st[m]), (1, 'FAIL'), out)
        rc, out, st = self.gate(lim(120), lim(300), '--paired')       # the reference holds the limit
        self.assertEqual((rc, st[m]), (1, 'FAIL'), out)

    def test_tol_scale(self):
        b, r = {'a.f': pm(20.0, 'frame_ms'), 'a.fps': pm(24.0, 'throughput'), 'a.mem': pm(1e6, 'mem_bytes')}, \
            {'a.f': pm(28.0, 'frame_ms'), 'a.fps': pm(18.0, 'throughput'), 'a.mem': pm(1.4e6, 'mem_bytes')}
        rc, out, st = self.gate(b, r)
        self.assertEqual(st, {'a.f': 'FAIL', 'a.fps': 'FAIL', 'a.mem': 'FAIL'}, out)
        rc, out, st = self.gate(b, r, '--tol-scale', '3')               # frame <= 1.45 x, fps >= 0.70 x, memory <= 1.75 x
        self.assertEqual(st, {'a.f': 'PASS', 'a.fps': 'PASS', 'a.mem': 'PASS'}, out)
        rc, out, st = self.gate(b, dict(r, **{'a.mem': pm(2.1e6, 'mem_bytes')}), '--tol-scale', '3')
        self.assertEqual(st['a.mem'], 'FAIL', out)
        f = {'a.f': pm(20.0, 'frame_ms')}
        rc, out, st = self.gate(f, {'a.f': pm(13.0, 'frame_ms')}, '--tol-scale', '3')
        self.assertEqual(st['a.f'], 'PASS', out)                       # -35%: improved by the 1-fold margin, not by 3-fold
        rc, out, st = self.gate(f, {'a.f': pm(12.0, 'frame_ms')}, '--tol-scale', '3')
        self.assertEqual(st['a.f'], 'IMPROVED', out)

    def test_reference_cannot_run_the_unit(self):
        # [#292] the reference lacks the feature (phase.mandel against wave 5: no iter() in its parser, an empty plane):
        # its metrics carry ref_unsupported, and the unit's are NEW, not FAIL, and listed with the reason
        why = 'shape s1 draws nothing there'
        b = {'m.fps': pm(15.1, 'throughput', unit_id='m', ref_unsupported=why), 'm.mem': pm(32768, 'mem_bytes', unit_id='m', ref_unsupported=why),
             'm.moved': pm(False, 'check', unit_id='m', ref_unsupported=why)}
        r = {'m.fps': pm(6.5, 'throughput', unit_id='m'), 'm.mem': pm(1.4e6, 'mem_bytes', unit_id='m'), 'm.moved': pm(True, 'check', unit_id='m')}
        rc, out, st = self.gate(b, r, '--paired')
        self.assertEqual((rc, st), (0, {'m.fps': 'NEW', 'm.mem': 'NEW', 'm.moved': 'NEW'}), out)
        self.assertIn(why, out)
        # an absolute rule still holds: a false check of the current build fails, NEW or not
        r['m.moved'] = pm(False, 'check', unit_id='m')
        rc, out, st = self.gate(b, r, '--paired')
        self.assertEqual((rc, st['m.moved']), (1, 'FAIL'), out)
        # without the mark the same numbers are compared, and fail
        rc, out, st = self.gate({k: dict(v, ref_unsupported=None) for k, v in b.items()}, {k: v for k, v in r.items() if k != 'm.moved'}, '--paired')
        self.assertEqual((rc, st['m.fps'], st['m.mem']), (1, 'FAIL', 'FAIL'), out)


if __name__ == '__main__':
    unittest.main(verbosity=2)
