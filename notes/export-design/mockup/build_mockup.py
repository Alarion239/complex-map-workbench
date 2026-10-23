# inlines the prototype figures (proto/out/*.svg) into the mockup, so mockup-export.html is self-contained
import base64, pathlib, re
HERE = pathlib.Path(__file__).resolve().parent
src = (HERE / 'mockup-template.html').read_text()
def inline(m):
    p = HERE / m.group(1)
    data = (p if p.exists() else HERE.parent / "proto" / "out" / m.group(1)).read_bytes()
    return 'data:image/svg+xml;base64,' + base64.b64encode(data).decode()
out = re.sub(r'\{\{([\w.-]+\.svg)\}\}', inline, src)
(HERE.parent / 'mockup-export.html').write_text(out)
print('mockup-export.html', len(out) // 1024, 'KB')
