import subprocess,re
p='test/lib/land_exact.js'
orig=open(p).read()
# run only the cube root case
a="  for (const c of CASES) for (const sheets of MODES) {"
open(p,'w').write(orig.replace(a,"  for (const c of CASES.filter((x) => x.tag === 'cube root')) for (const sheets of MODES) {",1))
try:
    r=subprocess.run(['node','ci/browser.js','--no-build','--only','steps_land_exact_cmd'],capture_output=True,text=True,timeout=900); txt=r.stdout+r.stderr
finally: open(p,'w').write(orig)
open('/tmp/claude-0/ctl.log','w').write(txt)
for l in txt.splitlines():
    if 'FAIL' in l and 'control' in l: print(l[:260])
print('fails:',len([l for l in txt.splitlines() if 'FAIL ' in l and not l.startswith('==')]))
