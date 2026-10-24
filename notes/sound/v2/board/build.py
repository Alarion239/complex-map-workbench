# Builds ../board.html: one self-contained page. A = notes/v15-candidate/src/sound.js verbatim, except its storage key
# (a fixed 'board' namespace, so the board never touches the app's own sound settings on file://).
import os, re, hashlib
H = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(H, '../../../..'))
a = open(os.path.join(ROOT, 'notes/v15-candidate/src/sound.js')).read()
old = "const NS = (() => { try { return new URLSearchParams(location.search).get('ns') || ''; } catch (e) { return ''; } })();"
assert a.count(old) == 1
a = a.replace(old, "const NS = 'board';   // (sound board: its own storage key; the rest of this engine is src/sound.js of v15 verbatim)")
b = open(os.path.join(H, 'engine_b.js')).read(); pg = open(os.path.join(H, 'page.js')).read(); html = open(os.path.join(H, 'page.html')).read()
for s in (a, b, pg): assert '</script' not in s.lower()
sha = hashlib.sha256(open(os.path.join(ROOT, 'notes/v15-candidate/src/sound.js'), 'rb').read()).hexdigest()[:16]
out = html.replace('/*SOUND_A*/', '// ---- A: notes/v15-candidate/src/sound.js (sha256 ' + sha + '…)\n' + a).replace('/*ENGINE_B*/', b).replace('/*PAGE*/', pg)
open(os.path.join(H, '..', 'board.html'), 'w').write(out)
print('board.html', len(out), 'bytes')
