import sys, subprocess, re, os
tag, us = sys.argv[1:3]
p = 'test/lib/land_exact.js'
orig = open(p).read()
dbg = """  { const c = CASES.find((x) => x.tag.startsWith(%s)); await load(c, false); await park(0, 'P0'); await park(1, 'P1');
    const out = [];
    for (const u of [%s]) { await park(0, 'P0x'); await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`); await setU(u); out.push('u' + u + ':' + await ev('window.__landDbgX()')); }
    ok('DBG~' + out.join('|') + '~', false, 0); return { pass: false, fails, info: [] }; }
  for (const c of CASES) for (const sheets of MODES) {""" % (repr(tag), us)
a = "  for (const c of CASES) for (const sheets of MODES) {"
assert a in orig
open(p, 'w').write(orig.replace(a, dbg, 1))
try:
    r = subprocess.run(['node', 'ci/browser.js', '--no-build', '--only', 'steps_land_exact_cmd'], capture_output=True, text=True, timeout=900)
    txt = r.stdout + r.stderr
finally:
    open(p, 'w').write(orig)
open('/tmp/claude-0/dbg_last.log','w').write(txt)
m = re.findall(r'DBG~(.*?)~', txt, re.S)
print(m[0][:6000] if m else 'none: ' + txt[-800:])
