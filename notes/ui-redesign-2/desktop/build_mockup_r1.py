# Builds notes/ui-redesign-2/desktop/mockup.html and frames/*.html (DESIGN.md). Not app code.
# Run: python3 build_mockup.py   (from this folder). Inputs: the app copy's page.html (stylesheet), the DOM
# snapshot of the header (cmd/top.html, captured from the running app copy) and the pictures in img/<theme>/,
# captured from the running app copy (cmd/cap_*.js). Every picture of a plane or a card is a real render.
import pathlib, re, html
here = pathlib.Path(__file__).parent
page = (here.parent / 'app-copy-desktop' / 'src' / 'page.html').read_text()
APP_CSS = re.search(r'<style>(.*?)</style>', page, re.S).group(1)
TOP = (here / 'cmd' / 'top.html').read_text()
LEFT = (here / 'cmd' / 'left.html').read_text()
FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..700&family=B612+Mono:wght@400;700&family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&display=swap">'

def sv(inner, w=16, sw=1.5, fill=False):
    return (f'<svg class="ic" viewBox="0 0 16 16" width="{w}" height="{w}" aria-hidden="true" fill="{"currentColor" if fill else "none"}" '
            f'stroke="{"none" if fill else "currentColor"}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{inner}</svg>')
IC = {
    'copy': sv('<rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>'),
    'chevD': sv('<path d="M4 6l4 4 4-4"/>'), 'chevR': sv('<path d="M6 3.5L10.5 8 6 12.5"/>'), 'chevL': sv('<path d="M10 3.5L5.5 8l4.5 4.5"/>'),
    'more': sv('<circle cx="3.5" cy="8" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="12.5" cy="8" r="1.1"/>', fill=True),
    'bypass': sv('<path d="M2 10h3M11 10h3M5 10V6.5a3 3 0 0 1 6 0V10"/>'),
    'alone': sv('<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25l3.25 3.25"/><circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none"/>'),
    'argand': sv('<path d="M2.5 8h11M8 2.5v11"/><circle cx="11" cy="5" r="1.6" fill="currentColor" stroke="none"/>'),
    'x': sv('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'), 'plus': sv('<path d="M8 3.5v9M3.5 8h9"/>'),
    'point': sv('<circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none"/><path d="M8 2v2.2M8 11.8V14M2 8h2.2M11.8 8H14"/>'),
    'fit': sv('<path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3"/><circle cx="8" cy="8" r="1.75"/>'),
    'sliders': sv('<path d="M2.5 5h11M2.5 11h11"/><circle cx="6" cy="5" r="1.75" fill="var(--surface)"/><circle cx="10" cy="11" r="1.75" fill="var(--surface)"/>'),
    'pencil': sv('<path d="M3 13l.8-3.2L10.5 3a1.4 1.4 0 0 1 2 2L5.8 11.7z"/>'),
    'trash': sv('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"/>'),
    'swap': sv('<path d="M3 5.5h9l-2.5-2.5M13 10.5H4l2.5 2.5"/>'),
    'check': sv('<path d="M3.5 8.5l3 3 6-7"/>'),
    'pause': sv('<path d="M5.5 3.5v9M10.5 3.5v9"/>'), 'play': sv('<path d="M5 3.5v9l7-4.5z" fill="currentColor"/>'),
    'grip': sv('<circle cx="6" cy="4" r=".9"/><circle cx="10" cy="4" r=".9"/><circle cx="6" cy="8" r=".9"/><circle cx="10" cy="8" r=".9"/><circle cx="6" cy="12" r=".9"/><circle cx="10" cy="12" r=".9"/>', fill=True),
}
# step-type icons (14 px, the view-switch glyph weight)
TY = {
    'region': sv('<path d="M2 5.5h12M2 10.5h12"/><path d="M4 5.5v5M8 5.5v5M12 5.5v5" stroke-opacity=".45"/>', 14, 1.3),
    'exp': sv('<path d="M2 13.5c5 0 8-2.5 10.5-11"/><path d="M2 13.5h12" stroke-opacity=".45"/>', 14, 1.3),
    'mobius': sv('<circle cx="8" cy="8" r="5.5"/><path d="M2.6 9.6c3-1.8 7.6-1.8 10.8 0"/><path d="M8 2.5v11" stroke-opacity=".45"/>', 14, 1.3),
    'zp': sv('<circle cx="4.6" cy="8" r="2.2" fill="currentColor" stroke="none"/><path d="M9.6 5.6l4.8 4.8M14.4 5.6l-4.8 4.8"/>', 14, 1.4),
}
M = lambda s: f'<span class="m">{s}</span>'   # inline math in STIX italic (no MathJax in the mockup)
fsub = lambda k: f'<i>f</i><sub>{k}</sub>'
wsub = lambda k: f'<i>w</i><sub>{k}</sub>'

NEW_CSS = r"""
html, body { height: 100%; }
body { margin: 0; overflow: hidden; }
.m { font: italic 500 1em/1 var(--f-math); white-space: nowrap; }
.m .up { font-style: normal; }
/* the plane pictures (real renders of the app copy, at the new sizes) */
.panes-img { position: relative; min-height: 0; }
.panes-img > img { display: block; width: 100%; height: 100%; }
/* ---------- NEW 1: the chain ---------- */
.pipe-wrap { display: grid; grid-template-rows: 36px minmax(0, 1fr); }
.pipe-head .compose { display: inline-flex; align-items: center; gap: 2px; font: italic 500 14px/1 var(--f-math); }
.pipe-head .compose sub { font-size: 9.5px; }
.n-vsep { width: 1px; height: 18px; background: var(--line); flex: 0 0 1px; margin: 0 2px; }
.n-guar { display: inline-flex; align-items: center; gap: 8px; height: 24px; padding: 0 6px 0 8px; border: 1px solid var(--line); border-radius: var(--r-2); background: transparent; font: var(--t-label); color: var(--ink); }
.n-guar:hover, .n-guar[aria-expanded="true"] { border-color: var(--line-strong); background: var(--well); }
.n-guar .g { display: inline-flex; align-items: center; gap: 5px; }
.n-guar .g::before { content: ""; width: 8px; height: 8px; border-radius: var(--r-1); background: var(--good); }
.n-guar .n { color: var(--muted); font: var(--t-caption); }
.n-guar svg { width: 12px; height: 12px; color: var(--faint); }
.n-pipe { display: flex; align-items: flex-start; padding: 8px 12px 0; min-width: 0; overflow: hidden; }
.card.n-card { flex: 1 1 0; width: auto; min-width: 128px; max-width: 208px; height: 134px; contain-intrinsic-size: auto; }
.card.n-card .card-head { flex: 0 0 26px; height: 26px; gap: 5px; }
.card.n-card .nm { margin-left: 0; }
.card.n-card .acts { position: absolute; right: 2px; top: 1px; display: none; background: var(--surface); }
.card.n-card:hover .acts { display: flex; opacity: 1; }
.n-ty { display: inline-grid; place-items: center; width: 14px; height: 14px; flex: 0 0 14px; color: var(--ink-2); }
.n-ty svg { width: 14px; height: 14px; }
.n-pic { position: relative; flex: 1 1 auto; min-height: 0; background: var(--plane); overflow: hidden; }
.n-pic > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.n-pic > .thumb-var { z-index: 1; }
.card.n-card.sel { border-color: var(--accent); outline: 1px solid var(--accent); outline-offset: -2px; }
.card.n-card.alone .idx { background: var(--accent); color: var(--accent-ink); }
.card.n-card .n-lens { display: none; color: var(--accent); width: 16px; height: 16px; }
.card.n-card .n-lens svg { width: 14px; height: 14px; }
.card.n-card.alone .n-lens { display: inline-grid; place-items: center; }
.card.n-card.dim { opacity: .55; }
.n-tbar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--line); z-index: 1; }
.n-tbar > b { display: block; height: 100%; background: var(--accent); }
.n-tlab { position: absolute; right: 4px; bottom: 6px; z-index: 1; font: var(--t-readout); font-size: 10.5px; color: var(--ink-2); background: var(--overlay); border: 1px solid var(--line); border-radius: var(--r-1); padding: 0 4px; }
.n-conn { position: relative; flex: 0 0 28px; height: 134px; color: var(--ink-2); }
.n-conn .v { position: absolute; left: 0; right: 0; top: 52px; text-align: center; font: var(--t-math-s); }
.n-conn svg { position: absolute; left: 2px; top: 74px; width: 24px; height: 12px; overflow: visible; }
.n-add { flex: 0 0 44px; height: 134px; display: grid; place-items: center; border: 1px dashed var(--line-strong); border-radius: var(--r-3); color: var(--ink-2); background: transparent; }
.n-add svg { width: 16px; height: 16px; }
.n-pipe.narrow .n-conn { flex-basis: 20px; } .n-pipe.narrow .n-conn svg { left: 1px; width: 18px; } .n-pipe.narrow .n-add { flex-basis: 36px; }
/* compact: names only */
/* ---------- NEW 2: the Inspector (right panel) ---------- */
.panel.right.n-insp { display: flex; flex-direction: column; overflow: hidden; }
.n-insp .psec { padding: 12px; }
.n-insp h2 .idx { margin-right: 0; }
.n-head { display: flex; align-items: center; gap: 6px; min-height: 28px; margin: 0 0 10px; font: var(--t-heading); color: var(--ink); }
.n-head .ttl { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; }
.n-head .icon-btn { width: 28px; height: 28px; }
.n-head .icon-btn.txt { font: italic 500 13px/1 var(--f-math); }
.n-formula { padding: 10px 12px; margin: 0 0 12px; background: var(--well); border-radius: var(--r-2); font: italic 500 15px/1.5 var(--f-math); color: var(--ink); }
.n-formula sub { font-size: 10px; }
.n-formula .frac { display: inline-flex; flex-direction: column; align-items: center; vertical-align: middle; font-size: 14px; line-height: 1.25; margin: 0 2px; }
.n-formula .frac > span:first-child { border-bottom: 1px solid currentColor; padding: 0 3px 1px; }
.n-formula .frac > span:last-child { padding: 1px 3px 0; }
.n-big2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0 0 6px; }
.n-big { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 36px; border: 1px solid var(--line-strong); border-radius: var(--r-2); background: var(--surface); font: 600 13px/16px var(--f-ui); color: var(--ink); }
.n-big:hover { border-color: var(--ink-2); background: var(--well); }
.n-big .mk { position: relative; width: 10px; height: 10px; flex: 0 0 10px; }
.n-big.zeros .mk { border-radius: 50%; background: var(--zero); }
.n-big.poles .mk::before, .n-big.poles .mk::after { content: ""; position: absolute; left: -1px; right: -1px; top: 4px; height: 2px; border-radius: 1px; background: var(--pole); rotate: 45deg; }
.n-big.poles .mk::after { rotate: -45deg; }
.n-hint { font: var(--t-label); color: var(--muted); margin: 0 0 12px; }
.n-hint .m { font-size: 12.5px; }
.n-rows { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 6px 6px; align-items: center; }
.n-rows .pl { font: italic 500 15px/20px var(--f-math); color: var(--ink-2); text-align: left; }
.n-rows .pl.zeros { color: var(--ink); } .n-rows .pl.poles { color: var(--pole); }
.n-rows .pl sub { font-size: 10px; }
.n-rows .inp { height: 32px; font-size: 13px; padding: 0 10px; width: 100%; }
.n-rows .acts { display: flex; gap: 0; }
.n-rows .acts .icon-btn { width: 28px; height: 32px; }
.n-rows .sec { grid-column: 1 / -1; font: var(--t-caption); color: var(--muted); text-transform: none; margin: 6px 0 -2px; }
.n-matrix { position: relative; display: grid; grid-template-columns: 18px minmax(0,1fr) 18px minmax(0,1fr); gap: 6px; padding: 2px 8px; margin: 0 0 10px; }
.n-matrix::before, .n-matrix::after { content: ""; position: absolute; top: 0; bottom: 0; width: 4px; border: 1.25px solid var(--ink-2); }
.n-matrix::before { left: 0; border-right: 0; } .n-matrix::after { right: 0; border-left: 0; }
.n-matrix .pl { font: italic 500 15px/32px var(--f-math); color: var(--ink-2); }
.n-matrix .inp { height: 32px; font-size: 13px; width: 100%; }
.n-kv { display: flex; align-items: center; gap: 8px; font: var(--t-label); color: var(--muted); margin: 0 0 10px; }
.n-kv .m { color: var(--ink-2); font-size: 13px; }
.n-kv select.sel, .n-kv .seg { margin-left: auto; }
.n-sub { font: var(--t-label); color: var(--muted); margin: 10px 0 0; }
.n-params { flex: 1 1 auto; min-height: 0; border-top: 1px solid var(--line); }
.n-prow { display: grid; grid-template-columns: 22px 64px minmax(0, 1fr); gap: 8px; align-items: center; height: 36px; }
.n-prow .pl { font: italic 500 15px/1 var(--f-math); color: var(--ink); }
.n-prow .inp { height: 28px; width: 100%; font-size: 12.5px; }
.n-prow input[type=range] { width: 100%; }
.n-prow2 { display: grid; grid-template-rows: 24px 20px; gap: 4px; padding: 4px 0; }
.n-prow2 .l1 { display: flex; align-items: center; gap: 6px; }
.n-prow2 .pl { font: italic 500 15px/1 var(--f-math); color: var(--ink); width: 14px; }
.n-prow2 .eq { font: var(--t-math-s); color: var(--ink-2); }
.n-prow2 .inp { width: 72px; height: 24px; font-size: 12.5px; }
.n-prow2 .l2 { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 6px; align-items: center; font: var(--t-micro); color: var(--muted); }
.n-prow2 .l2 input { width: 100%; }
.n-addnum { margin-top: 4px; height: 32px; width: 100%; justify-content: flex-start; }
.n-slot { margin-top: 8px; padding: 8px 10px; border: 1px dashed var(--line-strong); border-radius: var(--r-2); font: var(--t-label); color: var(--muted); }
.n-railicons { display: flex; flex-direction: column; gap: 4px; align-items: center; }
/* ---------- NEW 3: the guarantees popover and the context menu ---------- */
.n-pop { position: absolute; z-index: 30; background: var(--surface); border: 1px solid var(--line-strong); border-radius: var(--r-4); box-shadow: var(--shadow-3); }
.n-gpop { width: 320px; padding: 12px; }
.n-gpop h3 { display: flex; align-items: center; margin: 0 0 6px; font: var(--t-heading); color: var(--ink); }
.n-gpop h3 .grow { flex: 1 1 auto; }
.n-gpop .lamps { margin: 0 -12px; }
.n-gpop .lamp { padding: 0 12px; }
.n-gpop .lamp.on .lampmark { background: var(--good); border-color: var(--good); }
.n-gpop .lamp.on .lampname { color: var(--ink); font-weight: 500; }
.n-gpop .lamp:not(.on) .lampname { color: var(--muted); }
.n-gpop .dom { margin: 10px 0 0; padding: 8px 10px; background: var(--well); border-radius: var(--r-2); font: var(--t-body); color: var(--ink-2); }
.n-gpop .dom .m { font-size: 14px; color: var(--ink); }
.n-gpop details { margin-top: 8px; font: var(--t-label); color: var(--ink-2); }
.n-gpop summary { cursor: pointer; }
.n-ctx { min-width: 220px; padding: 4px; display: flex; flex-direction: column; }
.n-ctx .menu-head { font: var(--t-readout); color: var(--ink-2); padding: 6px 8px 6px; }
.n-ctx .menu-head .m { font: italic 500 13px/1 var(--f-math); color: var(--ink); }
.n-ctx .mi { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 8px; border-radius: var(--r-2); font: var(--t-body); color: var(--ink); background: transparent; border: 0; text-align: left; }
.n-ctx .mi.active { background: var(--well); }
.n-ctx .mi .mk { position: relative; width: 10px; height: 10px; margin: 0 3px; }
.n-ctx .mi .mk.zeros { border-radius: 50%; background: var(--zero); }
.n-ctx .mi .mk.poles::before, .n-ctx .mi .mk.poles::after { content: ""; position: absolute; left: -1px; right: -1px; top: 4px; height: 2px; border-radius: 1px; background: var(--pole); rotate: 45deg; }
.n-ctx .mi .mk.poles::after { rotate: -45deg; }
.n-ctx .msep { height: 1px; background: var(--line); margin: 4px 0; }
.n-ctx .mi-key { margin-left: auto; padding-left: 16px; font: 400 11px/16px var(--f-mono); color: var(--faint); }
.n-cursor { position: absolute; z-index: 29; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; border: 1.5px solid var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); }
.n-editpop { width: 320px; padding: 12px; }
.n-editpop::after { content: ""; position: absolute; left: var(--ax, 40px); bottom: -6px; width: 10px; height: 10px; background: var(--surface); border-right: 1px solid var(--line-strong); border-bottom: 1px solid var(--line-strong); rotate: 45deg; }
/* NEW: below 1280 px one side panel docks at a time (the Inspector by default); it is no longer a drawer */
@media (min-width: 768px) and (max-width: 1279px) { .layout:not(.hide-right) > .panel.right.n-insp { position: static; width: auto; box-shadow: none; animation: none; background: var(--panel); border-color: var(--line); border-radius: var(--r-3); } }
/* the frame: no app JS, so a few states are pinned here */
#hdrMenu { display: contents; }
.layout { height: 100%; }
"""

FRAME_JS = r"""
<script>
(function () {
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    document.querySelectorAll('img[data-src]').forEach(function (im) { im.src = im.dataset.src.replace('{T}', t); });
  }
  var q = new URLSearchParams(location.search).get('t');
  setTheme(q || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  addEventListener('message', function (e) { if (e.data && e.data.theme) setTheme(e.data.theme); });
  function segs() { document.querySelectorAll('.seg').forEach(function (s) { var b = s.querySelector('button.on, button[aria-checked="true"]'); if (!b) return; s.style.setProperty('--seg-x', (b.offsetLeft - 2) + 'px'); s.style.setProperty('--seg-w', b.offsetWidth + 'px'); }); }
  if (document.fonts) document.fonts.ready.then(segs); addEventListener('load', segs); segs();
})();
</script>"""

def img(name, cls=''):
    return f'<img {cls} data-src="../img/{{T}}/{name}.png" alt="">'

def top(view='xy', deform=False, rightLabel='Inspector'):
    t = TOP
    t = re.sub(r'(<div class="seg modes vsw"[^>]*?) style="[^"]*"', r'\1', t)
    ONC = ' class="on"'
    for v in ('xy', 'phase', 'land'):
        on = v == view
        t = re.sub(rf'<button data-mode="{v}" role="radio"([^>]*?)(?: class="on")?(?: tabindex="-1")? aria-checked="(true|false)"',
                   lambda m: f'<button data-mode="{v}" role="radio"{m.group(1)}{ONC if on else ""} aria-checked="{str(on).lower()}"', t)
    t = t.replace('id="morphBtn" aria-pressed="false"', f'id="morphBtn" aria-pressed="{str(deform).lower()}"')
    t = t.replace('title="Guarantees  ]" aria-label="Show or hide guarantees"', f'title="{rightLabel}  ]" aria-label="Show or hide the {rightLabel.lower()}"')
    t = t.replace('<span class="mlabel">Guarantees panel</span>', f'<span class="mlabel">{rightLabel} panel</span>')
    return t

def left_rail():
    # the left panel's rail: the captured panel with the hide-left state (CSS shows the rail only)
    return LEFT

def left_full():
    st = 'style="display:block;width:100%;height:100%;object-fit:cover;object-position:top"'
    return f'<aside class="panel left" style="padding:0;overflow:hidden">{img("left1440", st)}</aside>'

# ---------------- the chain ----------------
STEPS = [(1, 'exp', 'Exponential'), (2, 'mobius', 'Möbius'), (3, 'zp', 'Zeros and poles')]
def conn(var):
    return (f'<div class="n-conn"><span class="v">{var}</span><svg viewBox="0 0 24 12"><path d="M0 6h22M18 2l4 4-4 4" fill="none" '
            f'stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg></div>')

def chain(view, sel=0, alone=0, deform=None, guar_open=False, narrow=False):
    pics = {'xy': 't-xy-{k}', 'phase': 't-phase-{k}', 'land': 't-land-{k}c', 'def': 't-def-{k}'}[view]
    cards = []
    reg = (f'<div class="card n-card region-card{" sel" if sel == 0 and alone == 0 and False else ""}"><div class="card-head"><span class="idx"><i>z</i></span>'
           f'<span class="n-ty">{TY["region"]}</span><span class="nm">Region</span></div>'
           f'<div class="n-pic">{img("t-xy-0")}<span class="thumb-var"><i>z</i></span></div></div>')
    cards.append(reg)
    for k, ty, name in STEPS:
        cards.append(conn(wsub(k - 1) if k > 1 else '<i>z</i>'))
        cls = ' sel' if sel == k else ''
        cls += ' alone' if alone == k else ''
        extra = ''
        if deform:
            tk = deform[k]
            extra = f'<div class="n-tbar"><b style="width:{tk * 100:.0f}%"></b></div><span class="n-tlab">t = {tk:g}</span>'
            if tk == 0: cls += ' dim'
        acts = (f'<span class="acts"><button class="icon-btn" aria-label="Bypass">{IC["bypass"]}</button>'
                f'<button class="icon-btn more" aria-label="More">{IC["more"]}</button></span>')
        cards.append(f'<div class="card n-card{cls}"><div class="card-head"><span class="idx">{fsub(k)}</span><span class="n-ty">{TY[ty]}</span>'
                     f'<span class="nm">{name}</span><span class="n-lens" title="Shown alone">{IC["alone"]}</span>{acts}</div>'
                     f'<div class="n-pic">{img(pics.format(k=k))}<span class="thumb-var">{wsub(k)}</span>{extra}</div></div>')
    cards.append(conn(wsub(3)))
    cards.append(f'<button class="n-add" aria-label="Add a function  +">{IC["plus"]}</button>')
    guar = (f'<button class="n-guar" aria-haspopup="dialog" aria-expanded="{str(guar_open).lower()}" title="Guarantees of F">'
            f'<span class="g">Analytic</span><span class="n">1 of 8</span>{IC["chevD"]}</button>')
    h2 = '' if narrow else '<h2>Function chain</h2>'
    clear = '' if narrow else '<button class="btn ghost small">Clear chain</button>'
    head = (f'<div class="pipe-head">{h2}<div class="compose"><i>F</i>&nbsp;=&nbsp;{fsub(3)}&nbsp;∘&nbsp;{fsub(2)}&nbsp;∘&nbsp;{fsub(1)}</div>'
            f'<button class="icon-btn small" title="Copy F as LaTeX">{IC["copy"]}</button><span class="n-vsep"></span>{guar}<div class="grow"></div>'
            f'<div class="seg small" role="radiogroup"><button class="on" aria-checked="true">Pictures</button><button>Names</button></div>'
            f'<button class="btn small" aria-pressed="{str(alone == 0).lower()}">Whole chain</button>{clear}</div>')
    return f'<div class="pipe-wrap">{head}<div class="n-pipe{" narrow" if narrow else ""}">{"".join(cards)}</div></div>'

# ---------------- the Inspector ----------------
def head_step(k, ty, name, alone=False, inv=True):
    return (f'<div class="n-head"><span class="idx">{fsub(k)}</span><span class="n-ty">{TY[ty]}</span><span class="ttl">{name}</span>'
            f'<button class="icon-btn" title="Show this step alone (its input plane on the left)" aria-pressed="{str(alone).lower()}">{IC["alone"]}</button>'
            f'<button class="icon-btn" title="Inverse, bypass, move, duplicate, presets, remove">{IC["more"]}</button></div>')

def frac(a, b):
    return f'<span class="frac"><span>{a}</span><span>{b}</span></span>'

def ed_zp(alone=True):
    rows = [('a', '', '1', False), (f'ζ<sub>1</sub>', 'zeros', '0.5', True), (f'ζ<sub>2</sub>', 'zeros', '−0.5i', True), (f'p<sub>1</sub>', 'poles', '−0.8 + 0.75i', True)]
    r = ''
    for lab, cls, val, rm in rows:
        r += (f'<label class="pl {cls}">{lab}</label><input class="inp" value="{val}"><span class="acts"><button class="icon-btn" title="Pick on an Argand diagram">{IC["argand"]}</button>'
              + (f'<button class="icon-btn danger" title="Remove">{IC["x"]}</button>' if rm else '<span style="width:28px"></span>') + '</span>')
        if lab == 'a': r += '<div class="sec">Zeros and poles, dragged in the <span class="m">w</span><sub>2</sub>-plane</div>'
    return (head_step(3, 'zp', 'Zeros and poles', alone, inv=False) +
            f'<div class="n-formula"><i>w</i><sub>3</sub> = {frac("(<i>w</i><sub>2</sub> − 0.5)(<i>w</i><sub>2</sub> + 0.5<i>i</i>)", "<i>w</i><sub>2</sub> + 0.8 − 0.75<i>i</i>")}</div>'
            f'<div class="n-big2"><button class="n-big zeros"><span class="mk"></span>Add zero</button><button class="n-big poles"><span class="mk"></span>Add pole</button></div>'
            f'<div class="n-hint">Or right-click the plane. Drag a mark to move it, off the plane to remove it.</div>'
            f'<div class="n-rows">{r}</div><div class="n-sub">Degree 2. The pole <span class="m">p</span><sub>1</sub> is left out of the natural domain.</div>')

def ed_mob(alone=False, k=2):
    cell = lambda l, v: f'<label class="pl">{l}</label><input class="inp" value="{v}">'
    return (head_step(k, 'mobius', 'Möbius', alone) +
            f'<div class="n-formula"><i>w</i><sub>2</sub> = {frac("<i>a w</i><sub>1</sub> + <i>b</i>", "<i>c w</i><sub>1</sub> + <i>d</i>")} = {frac("<i>w</i><sub>1</sub> − 1", "<i>w</i><sub>1</sub> + 1")}</div>'
            f'<div class="n-matrix">{cell("a", "1")}{cell("b", "−1")}{cell("c", "1")}{cell("d", "1")}</div>'
            f'<div class="n-kv"><span><span class="m">ad − bc</span> = 2</span><select class="sel" style="height:28px"><option>Presets</option></select></div>'
            f'<div class="n-sub">Drag a field’s letter sideways to change it; the target picks a value on an Argand diagram.</div>')

def ed_exp():
    return (head_step(1, 'exp', 'Exponential') +
            f'<div class="n-formula"><i>w</i><sub>1</sub> = <i>e</i><sup><i>z</i></sup></div>'
            f'<div class="n-sub" style="margin-top:0">No parameters. One-to-one on every horizontal strip of height 2<span class="m">π</span>.</div>')

def params_sec(rows=True):
    body = ''
    if rows:
        for n, v, p, lo, hi in (('a', '0.50', 62, '−2', '2'), ('r', '1.20', 30, '0', '4')):
            body += (f'<div class="n-prow2"><div class="l1"><span class="pl">{n}</span><span class="eq">=</span><input class="inp" value="{v}">'
                     f'<button class="icon-btn small" title="Play">{IC["play"]}</button><span class="grow"></span><button class="icon-btn small" title="More">{IC["more"]}</button></div>'
                     f'<div class="l2"><span>{lo}</span><input type="range" value="{p}"><span>{hi}</span></div></div>')
    return (f'<section class="psec n-params"><h2><span class="grow">Parameters</span></h2>{body}'
            f'<button class="btn ghost small n-addnum">{IC["plus"]} Number</button></section>')

def inspector(editor, params=True, width=None):
    st = f' style="width:{width}px"' if width else ''
    return f'<aside class="panel right n-insp"{st}><section class="psec">{editor}</section>{params_sec(params)}</aside>'

def right_rail():
    return (f'<aside class="panel right"><div class="rail" style="display:flex"><button class="icon-btn rail-open" title="Show the inspector  ]">{IC["chevL"]}</button>'
            f'<div class="n-railicons"><button class="icon-btn" title="Edit the selected step">{IC["pencil"]}</button><button class="icon-btn" title="Parameters">{IC["sliders"]}</button></div>'
            f'<span class="rail-label">Inspector</span></div></aside>')

def guar_pop(style):
    lamps = [('Analytic', True, ''), ('Entire', False, ''), ('Rational', False, ''), ('Polynomial', False, ''), ('Möbius', False, ''),
             ('Proper', False, ''), ('Homeomorphism onto image', False, ''), ('Conformal onto image', False, '')]
    li = ''.join(f'<li class="lamp{" on" if on else ""}"><span class="lampmark"></span><span class="lampname">{n}</span><span class="lampq">{q}</span><span class="lampchev">{IC["chevR"]}</span></li>' for n, on, q in lamps)
    return (f'<div class="n-pop n-gpop" style="{style}" role="dialog" aria-label="Guarantees of F"><h3><span class="grow">Guarantees of <i>F</i></span><span class="count">1 of 8</span></h3>'
            f'<ul class="lamps">{li}</ul>'
            f'<div class="dom">Natural domain <span class="m">D</span>: all <span class="m">z</span> with <span class="m">w</span><sub>1</sub> ≠ −1 and <span class="m">w</span><sub>2</sub> ≠ −0.8 + 0.75<span class="m">i</span>.</div>'
            f'<details><summary>Step by step</summary></details><details><summary>How these are decided</summary></details>'
            f'<div class="lbl" style="margin-top:8px">Lit: guaranteed by the chain. Unlit: not implied (it may still hold).</div></div>')

def ctx_menu(style):
    return (f'<div class="n-pop n-ctx" style="{style}" role="menu"><div class="menu-head"><span class="m">w</span><sub>2</sub> = 0.67 − 0.56<span class="m">i</span></div>'
            f'<button class="mi active"><span class="mk zeros"></span>Add zero here</button>'
            f'<button class="mi"><span class="mk poles"></span>Add pole here</button>'
            f'<button class="mi"><span class="mi-ic">{IC["point"]}</span>Add point here</button><div class="msep"></div>'
            f'<button class="mi"><span class="mi-ic">{IC["copy"]}</span>Copy coordinates</button>'
            f'<button class="mi"><span class="mi-ic">{IC["fit"]}</span>Center view here<span class="mi-key">Z</span></button></div>')

def edit_pop(editor, style, ax):
    return f'<div class="n-pop n-editpop" style="{style};--ax:{ax}px">{editor}</div>'

def frame(name, w, h, body, title):
    doc = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width={w}"><title>{title}</title>{FONTS}'
           f'<style>{APP_CSS}\n/* ===== mockup additions (NEW components) ===== */{NEW_CSS}</style></head><body style="width:{w}px;height:{h}px">'
           f'{body}{FRAME_JS}</body></html>')
    (here / 'frames').mkdir(exist_ok=True)
    (here / 'frames' / f'{name}.html').write_text(doc)
    return (name, w, h, title)

def app(topv, layout_cls, lw, rw, left, stage, right, extra=''):
    return (f'<div id="app"><header class="top" id="top">{topv}</header>'
            f'<main class="layout {layout_cls}" style="--lw:{lw}px;--rw:{rw}px">{left}{stage}{right}{extra}</main></div>')

def stage(panes, chainhtml, pane_h=None, below=''):
    rows = f'{pane_h}px 8px 188px' if pane_h else 'minmax(0,1fr) 8px 188px'
    if below: rows += ' 260px'
    return (f'<section class="stage" style="grid-template-rows:{rows};{"row-gap:0" if not below else ""}">'
            f'<div class="panes-img">{img(panes)}</div><div class="gutter gutter-row"></div>{chainhtml}{below}</section>')

def strip_top(t):
    return re.sub(r'^<header[^>]*>|</header>\s*$', '', t.strip())

FR = []
# 1. 1440, X -> Y, f3 selected and shown alone, the plane's context menu over the w2-plane
FR.append(frame('f1-xy-1440', 1440, 900, app(strip_top(top('xy')), '', 252, 288, left_full(),
    stage('p-xy1440-f3', chain('xy', sel=3, alone=3)), inspector(ed_zp(True)),
    ctx_menu('left:610px;top:438px') + '<div class="n-cursor" style="left:604px;top:432px"></div>'), 'X to Y, editing zeros and poles'))
# 2. 1440, Phase, whole chain, f2 selected, the guarantees popover open
FR.append(frame('f2-phase-1440', 1440, 900, app(strip_top(top('phase')), '', 252, 288, left_full(),
    stage('p-phase1440', chain('phase', sel=2, guar_open=True)), inspector(ed_mob()),
    guar_pop('left:520px;bottom:188px')), 'Phase, the guarantees opened'))
# 3. 1440 without the Inspector: Landscape, the editor as a popover above its card
FR.append(frame('f3-land-1440-nopanel', 1440, 900, app(strip_top(top('land')), 'hide-right', 252, 36, left_full(),
    stage('p-land1440-noR', chain('land', sel=2)), right_rail(),
    edit_pop(ed_mob(), 'left:689px;bottom:152px', 155)), 'Landscape, without the right panel'))
# 4. 1440, the deformation: each card shows its step at its own t
FR.append(frame('f4-def-1440', 1440, 900, app(strip_top(top('xy', True)), '', 252, 288, left_full(),
    stage('p-def1440', chain('def', sel=1, deform={1: 1, 2: 0.55, 3: 0})), inspector(ed_exp())), 'The deformation'))
# 5. 1024 x 768: the left panel is a rail, the Inspector stays docked (264 px)
FR.append(frame('f5-xy-1024', 1024, 768, app(strip_top(top('xy')), 'hide-left', 36, 264, left_rail(),
    stage('p-xy1024-f3', chain('xy', sel=3, alone=3, narrow=True)), inspector(ed_zp(True), params=False)), 'Tablet landscape, 1024 px'))
# 6. 768 x 1024: both rails; the Inspector docks under the chain in two columns
below = (f'<div class="n-insp n-below" style="display:grid;grid-template-columns:1fr 1fr;margin-top:8px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r-3);overflow:hidden">'
         f'<section class="psec" style="border-right:1px solid var(--line);border-bottom:0;overflow:hidden">{ed_zp(True)}</section>{params_sec(True)}</div>')
FR.append(frame('f6-xy-768', 768, 1024, app(strip_top(top('xy')), 'hide-left hide-right', 36, 36, left_rail(),
    stage('p-xy768-f3', chain('xy', sel=3, alone=3, narrow=True), 508, below), right_rail()), 'Tablet portrait, 768 px'))

# ---------------- the gallery ----------------
NOTES = {
 'f1-xy-1440': ('1 · X → Y at 1440 × 900: editing a Zeros-and-poles step',
   'The chain is 188 px tall (was 272): each card is its type and a picture, nothing else. <b>f₃ is selected</b> (accent outline) and <b>shown alone</b> (lens, accent tag), so the left plane is its input plane w₂ with ζ₁, ζ₂ and p₁. The <b>Inspector</b> (the old Guarantees panel) edits it: the formula in full, big <b>Add zero / Add pole</b> buttons, one 32 px row per value. A right-click on the plane opened the <b>context menu</b> (headed by the point it was opened at). The guarantees are one button in the chain head.'),
 'f2-phase-1440': ('2 · Phase at 1440: the cards show each step’s own phase portrait; the guarantees opened',
   'In Phase each card shows the phase portrait of its step over its own input plane, with the shapes outlined (f₁ over z, f₂ over w₁, f₃ over w₂ with its zeros and pole). The chain head’s <b>Analytic · 1 of 8</b> button opens the 8 lamps, the natural domain and, folded, the step-by-step table and how they are decided. f₂ (Möbius) is selected: its 2 × 2 matrix gets 32 px fields.'),
 'f3-land-1440-nopanel': ('3 · Landscape at 1440, without the right panel',
   'The Inspector hidden (]): the planes take its 252 px (1120 px wide). A selected step’s editor opens as a popover above its card, the same content as in the panel. The right rail keeps two icons: the editor and Parameters. Cards show a small relief of log|fₖ| over the step’s input (no axis labels).'),
 'f4-def-1440': ('4 · The deformation at 1440: each card shows its step at its own t',
   'Playing one step after another at t = 1.55 of 3: f₁ is done, f₂ is at 0.55 (the bar under its picture), f₃ waits at 0 (dimmed). Each card shows its step’s image at its own t over the grey start, without paths. Exp has no parameters, so its editor is one line, and the Parameters section has room.'),
 'f5-xy-1024': ('5 · Tablet landscape, 1024 × 768',
   'One side panel docks at a time below 1280 px. With a chain, it is the Inspector (264 px); the drawing tools stay usable on the left rail. The cards shrink to their 128 px minimum and still fit four. The chain head drops its title and Clear chain (in ⋯).'),
 'f6-xy-768': ('6 · Tablet portrait, 768 × 1024',
   'Both panels are rails. Height is cheap here and width is not, so the Inspector docks under the chain, full width, in two columns: the selection’s editor and Parameters. The planes stay 328 px wide each and get 508 px of height.'),
}
cards_by_view = ''
for v, lab in (('xy', 'X → Y: the image of the shapes after the step'), ('phase', 'Phase: the step’s own phase portrait over its input'),
               ('land', 'Landscape: a small relief of log|fₖ| over its input'), ('def', 'Deformation: the step at its own t')):
    pass

gal_css = r"""
html, body { height: auto; overflow: auto; }
body { padding: 0 0 48px; background: var(--bg); }
.mock-bar { position: sticky; top: 0; z-index: 60; display: flex; align-items: center; gap: 16px; padding: 8px 16px; background: var(--inverse); color: var(--inverse-ink); font: var(--t-label); }
.mock-bar b { font: var(--t-heading); } .mock-bar .sp { flex: 1 1 auto; }
.mock-bar button { color: inherit; border: 1px solid currentColor; border-radius: var(--r-2); padding: 2px 10px; font: var(--t-label); background: transparent; }
.frame { margin: 22px 16px 0; }
.frame h2 { font: var(--t-title); color: var(--ink); margin: 0 0 4px; }
.frame p { font: var(--t-body); color: var(--ink-2); margin: 0 0 10px; max-width: 1100px; }
.frame iframe { display: block; border: 1px solid var(--line-strong); border-radius: var(--r-4); background: var(--bg); }
.intro { margin: 18px 16px 0; max-width: 1100px; font: var(--t-body); color: var(--ink-2); }
.intro ul { margin: 6px 0 0; padding-left: 18px; } .intro li { margin: 2px 0; }
.before { display: flex; gap: 16px; flex-wrap: wrap; }
.before figure { margin: 0; } .before img { display: block; border: 1px solid var(--line-strong); border-radius: var(--r-4); }
.before figcaption { font: var(--t-label); color: var(--muted); margin-top: 4px; }
"""
frames_html = ''
for name, w, h, title in FR:
    t, p = NOTES[name]
    frames_html += f'<section class="frame"><h2>{t}</h2><p>{p}</p><iframe src="frames/{name}.html" width="{w + 2}" height="{h + 2}" title="{html.escape(title)}"></iframe></section>'
gallery = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Desktop Chain Redesign</title>{FONTS}'
           f'<style>{APP_CSS}\n{gal_css}</style></head><body>'
           f'<div class="mock-bar"><b>Desktop and tablet redesign</b><span>the chain, the guarantees, the Inspector · notes/ui-redesign-2/desktop/DESIGN.md</span><span class="sp"></span><button id="thm">Light / dark</button></div>'
           f'<div class="intro">Every plane and card picture below is a real render of the app copy (a 3-step chain: exp, Möbius, zeros and poles, on the strip |Im z| &lt; π/2). The frames use the app’s own stylesheet; new components are marked NEW in the frame CSS.'
           f'<ul><li><b>Chain cards</b>: type (index, icon, name) and a picture that follows the view. No formula, no parameters, no property strip.</li>'
           f'<li><b>Editing</b> moves to the <b>Inspector</b>, the freed right panel, with 32–36 px controls; without the panel, the same editor is a popover above the card.</li>'
           f'<li><b>Guarantees</b>: one button in the chain head; the lamps, the domain and the table on demand.</li>'
           f'<li><b>Context menu</b> on every plane: right-click, or on touch hold and release.</li></ul></div>'
           f'{frames_html}'
           f'<section class="frame"><h2>Before (v14 in progress), same chain</h2><p>The chain takes 272 px and still cuts off f₃; each card is 240 × 216 with its formula, its fields at 24 px and a property strip; the Guarantees panel takes 288 px for 8 lamps, a domain and a table.</p>'
           f'<div class="before"><figure><img src="shots/before-1440-xy.png" width="720"><figcaption>1440 × 900</figcaption></figure><figure><img src="shots/before-1024-xy.png" width="512"><figcaption>1024 × 768</figcaption></figure></div></section>'
           r"""<script>
(function () {
  var t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  function apply() { document.documentElement.setAttribute('data-theme', t); document.querySelectorAll('iframe').forEach(function (f) { try { f.contentWindow.postMessage({ theme: t }, '*'); } catch (e) {} }); }
  document.getElementById('thm').onclick = function () { t = t === 'dark' ? 'light' : 'dark'; apply(); };
  document.querySelectorAll('iframe').forEach(function (f) { f.addEventListener('load', apply); });
  apply();
})();
</script></body></html>""")
(here / 'mockup.html').write_text(gallery)
print('frames:', [f[0] for f in FR])
