# Builds notes/ui-design/mockup-merged.html (merged-views.md): the top bar's view switch and Deformation toggle, the
# three views and the merged deformation picture. Run: python3 notes/ui-design/mockup-src/build_merged.py <project root>
# Pictures are exact per-pixel renders of the Cayley map F(z) = (z - i)/(z + i) (render.js), the deformation the
# elliptic Moebius flow H_t = F^t. Not app code.
import pathlib, re, sys
proj = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
here = pathlib.Path(__file__).parent
page = (proj / 'src' / 'page.html').read_text()
app_css = re.search(r'<style>(.*?)</style>', page, re.S).group(1)
render_js = (here / 'render.js').read_text()

CSS = r"""
/* ---------- mockup frame (not app CSS) ---------- */
html, body { height: auto; }
body { min-width: 1280px; padding-bottom: 40px; }
.mock-bar { position: sticky; top: 0; z-index: 60; display: flex; align-items: center; gap: 16px; padding: 8px 16px; background: var(--inverse); color: var(--inverse-ink); font: var(--t-label); }
.mock-bar b { font: var(--t-heading); } .mock-bar .sp { flex: 1 1 auto; }
.mock-bar button { color: inherit; border: 1px solid currentColor; border-radius: var(--r-2); padding: 2px 8px; font: var(--t-label); }
.frame { margin: 18px 16px 0; }
.frame > h2 { font: var(--t-title); color: var(--ink); margin: 0 0 4px; }
.frame > p { font: var(--t-body); color: var(--ink-2); margin: 0 0 8px; max-width: 1100px; }
.frame .app { height: 720px; border: 1px solid var(--line-strong); border-radius: var(--r-4); padding: 0 8px 8px; background: var(--bg); display: grid; grid-template-rows: 44px minmax(0, 1fr); }
.frame .layout { display: grid; grid-template-columns: 36px minmax(0, 1fr) 36px; gap: 8px; min-height: 0; }
.frame .panel > .rail { display: flex; }
.frame .stage { --chain-h: 112px; }
/* ---------- NEW (to build): the top bar's view switch and the Deformation toggle ---------- */
.top .vsw { order: 8; height: 28px; }
.top .vsw > button { padding: 0 10px; }
.top .vsw i, .phbtn i { font: italic 500 14px/1 var(--f-math); }
.top .vsw .arr { font: var(--t-label); margin: 0 1px; }
.top .defbtn { order: 9; }
.top > .spacer2 { order: 10; flex: 1 1 auto; }
.top > .spacer { order: 7; }
.top #cmdBtn { order: 11; } .top #toggleLeft { order: 12; } .top #toggleRight { order: 13; } .top #exportBtn { order: 14; } .top #themeBtn { order: 15; } .top #helpBtn { order: 16; }
.top .kbdh { font: var(--t-micro); color: var(--faint); margin-left: 2px; }
.phbtn:disabled { opacity: .45; cursor: default; }
/* merged view: one wide pane, no expand affordance, the transport docked under the plot */
.pane.merged { grid-template-rows: 32px minmax(0, 1fr) auto; }
.tdock { display: flex; align-items: center; gap: 8px; min-width: 0; height: 40px; padding: 0 8px 0 10px; border-top: 1px solid var(--line); background: var(--panel); }
.tdock .tscrub { flex: 1 1 160px; min-width: 96px; position: relative; }
.tdock .tscrub input { width: 100%; }
.tdock .tread { font: var(--t-readout); color: var(--ink-2); }
.tdock .seg { height: 24px; } .tdock .seg > button { padding: 0 8px; }
.tdock .btn, .tdock select.sel { height: 24px; }
.tdock .check { min-height: 24px; gap: 6px; font: var(--t-label); padding: 0 4px; }
.tdock .ttick { position: absolute; top: 15px; translate: -50% 0; font: var(--t-math-s); font-size: 11px; color: var(--muted); }
/* phone frame */
.phone { width: 390px; border: 1px solid var(--line-strong); border-radius: 18px; padding: 6px 8px 10px; background: var(--bg); }
.phone .top { gap: 4px; }
.phone .wordmark { font-size: 14px; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.phone .vsw > button > span, .phone .defbtn > span { display: none; }
.phone .vsw > button, .phone .defbtn { padding: 0 7px; }
.phone .pane { height: 300px; margin-top: 6px; }
.phone .tdock { height: auto; flex-wrap: wrap; padding: 6px 8px; row-gap: 6px; }
.phone .tdock .tscrub { flex-basis: 100%; order: 9; }
.ann { font: var(--t-label); color: var(--muted); margin-top: 6px; max-width: 1100px; }
.ann b { color: var(--ink-2); }
"""

ICONS = r"""
const msvg = (inner) => `<svg class="mic" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const svgI = (inner, fill) => `<svg class="ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const IC = {
  xy: msvg('<rect x="1.5" y="4" width="5" height="8" rx=".8"/><rect x="9.5" y="4" width="5" height="8" rx=".8"/><path d="M6.5 8h2.6M8 6.7l1.3 1.3L8 9.3"/>'),
  plane: msvg('<rect x="2" y="2" width="12" height="12" rx="1"/><rect x="2" y="2" width="6" height="6" fill="currentColor" fill-opacity=".35" stroke="none"/><rect x="8" y="8" width="6" height="6" fill="currentColor" fill-opacity=".35" stroke="none"/>'),
  phase: msvg('<circle cx="8" cy="8" r="5.5"/><path d="M8 8h5.5M8 8l-2.75 4.76M8 8l-2.75-4.76"/>'),
  land: msvg('<path d="M1.5 12.5c2.5 0 3.5-6 6.5-6s4 6 6.5 6"/><path d="M1.5 14h13"/>'),
  sphere: msvg('<circle cx="8" cy="8" r="6"/><path d="M2 8a6 2.2 0 0 0 12 0"/><ellipse cx="8" cy="8" rx="2.4" ry="6"/>'),
  morph: msvg('<rect x="1.5" y="6" width="4" height="4"/><path d="M6.5 6.5c2-3 4.5-3 6 0"/><path d="M11.5 4.5l1 2-2.2.3"/><circle cx="12.5" cy="10.5" r="2" fill="currentColor" stroke="none"/>'),
  plus: svgI('<path d="M8 3.5v9M3.5 8h9"/>'), minus: svgI('<path d="M3.5 8h9"/>'),
  fit: svgI('<path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3"/><circle cx="8" cy="8" r="1.75"/>'),
  expand: svgI('<path d="M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9"/>'),
  orbit: svgI('<path d="M2.75 8A5.25 5.25 0 1 0 8 2.75a5.7 5.7 0 0 0-3.95 1.65L2.75 5.7"/><path d="M2.75 2.75v2.95H5.7"/>'),
  chevR: svgI('<path d="M6 3.5L10.5 8 6 12.5"/>'), chevL: svgI('<path d="M10 3.5L5.5 8l4.5 4.5"/>'), chevD: svgI('<path d="M3.5 6l4.5 4.5L12.5 6"/>'),
  more: svgI('<circle cx="3.5" cy="8" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="12.5" cy="8" r="1.1"/>', true),
  undo: svgI('<path d="M5.5 3.5l-3 3 3 3M2.5 6.5h7a3.5 3.5 0 0 1 0 7H6"/>'), redo: svgI('<path d="M10.5 3.5l3 3-3 3M13.5 6.5h-7a3.5 3.5 0 0 0 0 7H10"/>'),
  search: svgI('<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25l3.25 3.25"/>'),
  panelL: svgI('<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M6 2.5v11"/>'), panelR: svgI('<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M10 2.5v11"/>'),
  download: svgI('<path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/>'),
  theme: svgI('<circle cx="8" cy="8" r="5.75"/><path d="M8 2.25a5.75 5.75 0 0 1 0 11.5z" fill="currentColor" stroke="none"/>'),
  help: svgI('<circle cx="8" cy="8" r="6"/><path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.4"/><circle cx="8" cy="11.6" r=".8" fill="currentColor" stroke="none"/>'),
  sliders: svgI('<path d="M2.5 5h11M2.5 11h11"/><circle cx="6" cy="5" r="1.75" fill="var(--surface)"/><circle cx="10" cy="11" r="1.75" fill="var(--surface)"/>'),
  close: svgI('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
  play: svgI('<path d="M5 3.5v9l7-4.5z" fill="currentColor"/>'), pause: svgI('<path d="M5.5 3.5v9M10.5 3.5v9"/>'),
};
function fillIcons() { document.querySelectorAll('[data-ic]').forEach((el) => { if (!el.dataset.done) { el.insertAdjacentHTML('afterbegin', IC[el.dataset.ic] || ''); el.dataset.done = 1; } }); }
"""

def top(view, deform, phone=False):
    on = lambda v: ' class="on" aria-checked="true"' if v == view else ' aria-checked="false"'
    vsw = (f'<div class="seg modes vsw" role="radiogroup" aria-label="View">'
           f'<button role="radio"{on("xy")} data-tip="X → Y: shapes and images  1" data-ic="xy"><span><i>X</i><span class="arr"> → </span><i>Y</i></span></button>'
           f'<button role="radio"{on("phase")} data-ic="phase"><span>Phase</span></button>'
           f'<button role="radio"{on("land")} data-ic="land"><span>Landscape</span></button></div>')
    dfb = f'<button class="phbtn defbtn" aria-pressed="{str(deform).lower()}" data-ic="morph"><span>Deformation</span></button>'
    mark = '<svg viewBox="0 0 28 28" width="22" height="22" class="mark"><rect x="1.5" y="1.5" width="25" height="25" rx="2" fill="var(--plane)" stroke="var(--ink)" stroke-width="1.25"/><circle cx="14" cy="14" r="1.4" fill="var(--ink)"/></svg>'
    if phone:
        return (f'<header class="top">{mark}<h1 class="wordmark">Map Workbench</h1><button class="icon-btn" data-ic="undo"></button>'
                f'{vsw}{dfb}<button class="icon-btn" data-ic="more"></button></header>')
    return (f'<header class="top">{mark}<h1 class="wordmark"><span class="wm-pre">Complex </span>Map Workbench</h1><span class="hdiv"></span>'
            f'<button class="btn ghost menu-btn" id="examplesBtn"><span class="exlabel">Cayley map</span><span class="ic-slot" data-ic="chevD"></span></button>'
            f'<button class="icon-btn" id="undoBtn" data-ic="undo"></button><button class="icon-btn" id="redoBtn" data-ic="redo"></button>'
            f'<div class="spacer"></div>{vsw}{dfb}<div class="spacer2"></div>'
            f'<button class="cmd-field" id="cmdBtn"><span class="ic-slot" data-ic="search"></span><span class="cmd-text">Add function or command</span><span class="kbd">⌘K</span></button>'
            f'<button class="icon-btn" id="toggleLeft" aria-pressed="false" data-ic="panelL"></button><button class="icon-btn" id="toggleRight" aria-pressed="false" data-ic="panelR"></button>'
            f'<button class="icon-btn" id="exportBtn" data-ic="download"></button><button class="icon-btn" id="themeBtn" data-ic="theme"></button><button class="icon-btn" id="helpBtn" data-ic="help"></button></header>')

def viewstack(expand=True, fit=True):
    g2 = ('<div class="vgroup">' + ('<button class="vbtn" data-ic="fit"></button>' if fit else '') + ('<button class="vbtn" data-ic="expand"></button>' if expand else '') + '</div>') if (fit or expand) else ''
    return f'<div class="viewstack"><div class="vgroup"><button class="vbtn" data-ic="plus"></button><button class="vbtn" data-ic="minus"></button></div>{g2}</div>'

def seg(items, cur, cls='seg modes'):
    return f'<div class="{cls}" role="radiogroup">' + ''.join(f'<button role="radio" data-ic="{ic}" {"class=on aria-checked=true" if v == cur else ""}><span>{l}</span></button>' for v, l, ic in items) + '</div>'

def head(surf, title, role, led=True):
    sw = seg([('plane', 'Plane', 'plane'), ('sphere', 'Sphere', 'sphere')], surf) if surf else ''
    return f'<div class="pane-head"><div class="vgrp">{sw}</div><div class="pane-title"><span class="ptitle">{title}</span><span class="prole">{role}</span></div><div class="grow"></div><span class="led"></span></div>'

def pane(pid, hd, inner, merged=False, rulers=True, dock=''):
    rx = f'<canvas class="ruler ruler-y" id="{pid}RY"></canvas>'
    ry = f'<div class="ruler-corner"></div><canvas class="ruler ruler-x" id="{pid}RX"></canvas>'
    body = f'<div class="pane-body">{rx}<div class="plot"><canvas id="{pid}C"></canvas>{inner}</div>{ry}</div>'
    return f'<div class="pane{" merged" if merged else ""}{"" if rulers else " no-rulers"}" id="{pid}">{hd}{body}{dock}</div>'

def rails():
    return ('<aside class="panel left"><div class="rail"><button class="icon-btn rail-open" data-ic="chevR"></button><span class="rail-label">Region tools</span></div></aside>',
            '<aside class="panel right"><div class="rail"><button class="icon-btn rail-open" data-ic="chevL"></button><span class="rail-label">Guarantees</span></div></aside>')

CHAIN = '''<div class="gutter gutter-row"></div><div class="pipe-wrap"><div class="pipe-head"><h2>Function chain</h2><div class="compose"><span style="font:var(--t-math)"><i>F</i>(<i>z</i>) = (<i>z</i> − <i>i</i>)/(<i>z</i> + <i>i</i>)</span></div><div class="grow"></div>
<button class="btn small" aria-pressed="true">Whole chain</button></div><div class="pipeline compact"></div></div>'''

def frame(title, text, view, deform, panes, ann=''):
    L, R = rails()
    return (f'<section class="frame"><h2>{title}</h2><p>{text}</p><div class="app">{top(view, deform)}<main class="layout">{L}'
            f'<section class="stage" style="--chain-h:96px"><div class="panes{" solo-L" if len(panes) == 1 else ""}">{"".join(panes)}</div>{CHAIN}</section>{R}</main></div>'
            f'<div class="ann">{ann}</div></section>')

dock = ('<div class="tdock" role="toolbar" aria-label="Deformation"><button class="icon-btn" data-ic="pause"></button>'
        '<div class="tscrub"><input type="range" min="0" max="1" step="0.001" value="0.55" style="--fill:55%"><span class="ttick" style="left:50%"><i>f</i>₁</span></div>'
        '<span class="tread">t = 0.55 / 1</span>'
        '<div class="seg"><button>0.5×</button><button class="on" aria-checked="true">1×</button><button>2×</button></div>'
        '<select class="sel" style="height:24px"><option>Natural path</option><option>Straight line</option></select>'
        '<label class="check"><input type="checkbox" checked><span>Loop</span></label><label class="check"><input type="checkbox" checked><span>Paths</span></label>'
        '<button class="icon-btn" data-ic="close" title="Close the deformation  M"></button></div>')

readX = '<div class="chip readout"><span class="rk"><i>z</i></span>  <span class="rv">0.4210 + 1.2034i</span></div>'
readY = '<div class="chip readout"><span class="rk"><i>w</i></span>  <span class="rv">0.1243 − 0.1673i</span>  <span class="rk">F′</span> <span class="rv">0.3974 ∠ −68.4°</span></div>'
opts_phase = ('<div class="options"><div class="seg"><button class="on" aria-checked="true">Tiles</button><button>Plain</button><button>Modulus</button><button>Contours</button><button>Grid</button><button>Cauchy</button></div>'
              '<div class="scrub"><span class="pl">n</span><select class="sel" style="height:24px"><option>12</option></select></div><label class="check"><input type="checkbox" checked><span>Outlines</span></label></div>')
legend = '<div class="legend-chip"><canvas style="width:136px;height:40px" id="leg"></canvas><label class="check key-sw"><input type="checkbox"><span>Key in the <i>w</i>-plane</span></label></div>'
opts_land = ('<div class="options"><div class="seg"><button class="on" aria-checked="true">log |<i>F</i>|</button><button>|<i>F</i>|</button><button>Re <i>F</i></button><button>Im <i>F</i></button></div>'
             '<div class="seg"><button class="on" aria-checked="true">Tiles</button><button>Plain</button><button>Plaster</button></div>'
             '<label class="fader-row compact"><span class="fl">Scale</span><input type="range" min="0" max="1" value=".5" style="--fill:50%;width:80px"></label>'
             '<label class="check"><input type="checkbox"><span>Unit level</span></label>'
             '<div class="seg"><button class="on" aria-checked="true">3/4</button><button>Top</button><button>Front</button></div><button class="icon-btn small" data-ic="orbit"></button></div>')

F1 = frame('1 · X → Y (the split view, as today)',
           'Key 1. Left pane = <i>X</i> (Plane | Sphere): the shapes. Right pane = <i>Y</i> (Plane | Sphere): the images and the targets. Each pane head keeps only its own Plane | Sphere switch; the morph button left the right head (it is the top bar\'s Deformation toggle now).',
           'xy', False,
           [pane('aL', head('plane', '<i>z</i>-plane', 'domain of <i>F</i>'), readX + viewstack()),
            '<div class="gutter gutter-col"></div>',
            pane('aR', head('plane', '<i>w</i> = <i>F</i>(<i>z</i>)', 'image, after 1 step'), readY + '<div class="options"><label class="check"><input type="checkbox" checked><span>View outline</span></label></div>' + viewstack())],
           '<b>Top bar.</b> The view switch sits in the middle of the bar: <i>X</i> → <i>Y</i> · Phase · Landscape (keys 1, 2, 3; also in the ⌘K palette), and the Deformation toggle (M) 6 px to its right with its own outline, as the Phase toggle had: two raised thumbs never read as one multi-select. The toggle is disabled with the tooltip "Add a function to deform" when no step is active.')
F2 = frame('2 · Phase (one wide panel)',
           'Key 2. The phase portrait of <i>F</i> over <i>X</i>, full width, Plane or Sphere (the phase sphere) in its head. Shapes outlined, target preimages drawn, the colour wheel with its <i>w</i>-plane key switch, and the style strip in the options strip.',
           'phase', False,
           [pane('bL', head('plane', '<i>z</i>-plane', 'phase of <i>F</i>'), readX + legend + opts_phase + viewstack(expand=False), merged=True)],
           '<b>No expand button</b> in the view stack and no gutter: the wide panel is a view of its own, not an expanded pane. The camera and the plane view are its own; going back to <i>X</i> → <i>Y</i> restores that view\'s cameras.')
F3 = frame('3 · Landscape (one wide panel)',
           'Key 3. The 3D graph of <i>F</i> over <i>X</i>: height, one colouring control (Tiles · Plain: the phase colours the relief can paint; Plaster), sheets and the probe in its options strip. No surface switch in its head (a landscape is its own surface).',
           'land', False,
           [pane('cL', head(None, '<i>z</i>-plane', 'landscape of log|<i>F</i>|'), '<div class="chip readout"><span class="rhint">Drag to orbit, Shift-drag to pan</span></div>' + opts_land + viewstack(expand=False, fit=False), merged=True, rulers=False)])
F4 = frame('4 · X → Y + Deformation (the two panes merge into one plane)',
           '<i>X</i> drawn as a grey outline, <i>H<sub>t</sub></i>(<i>X</i>) filled with the pattern, live paths <i>t</i> ↦ <i>H<sub>t</sub></i>(<i>z</i>) of the morph figure\'s sample points (chosen off the frame, cached, never re-chosen during a scrub). The transport is docked at the panel\'s bottom, under the plot (it no longer covers the picture). Turning Deformation off splits the panes again.',
           'xy', True,
           [pane('dR', head('plane', '<i>z</i> → <i>w</i>', 'deformation'), readY + viewstack(expand=False), merged=True, dock=dock)],
           '<b>Phase + Deformation</b> and <b>Landscape + Deformation</b> keep their wide panel and paint <i>H<sub>t</sub></i>, with the same docked transport. A focused step deforms that step only. Export follows the view: <i>X</i> → <i>Y</i> exports the two-panel figure, Deformation the morph figure, Phase and Landscape one panel.')

PHONE = (f'<section class="frame"><h2>5 · Phone (390 px): the switch and the toggle as icons in the bar</h2><div style="display:flex;gap:24px;align-items:flex-start">'
         f'<div class="phone">{top("xy", True, phone=True)}' + pane('eR', head('plane', '<i>z</i> → <i>w</i>', 'deformation'), '', merged=True, rulers=False, dock=dock) + '</div>'
         f'<div class="phone">{top("phase", False, phone=True)}' + pane('fL', head('plane', '<i>z</i>-plane', 'phase'), '', merged=True, rulers=False) + '</div></div>'
         '<div class="ann">On a phone the title words go first, then the labels: the switch is three 30 px icons, the toggle one; the transport wraps the scrubber onto its own row.</div></section>')

SCRIPT = r"""
const TAU = Math.PI * 2;
// complex helpers and the Moebius flow H_t = F^t of the Cayley map (elliptic: fixed points p, q; H_t'(p) = e^{i theta t})
const cm = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], cd = (a, b) => { const q = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / q, (a[1] * b[0] - a[0] * b[1]) / q]; };
const ca = (a, b) => [a[0] + b[0], a[1] + b[1]], cs = (a, b) => [a[0] - b[0], a[1] - b[1]];
const s3 = Math.sqrt(3), P = [(s3 - 1) / 2 * -1, (s3 - 1) / 2], Q = [(s3 + 1) / 2, -(s3 + 1) / 2];   // p = ½(√3−1)(i−1), q = ½(√3+1)(1−i)
const TH = -2 * Math.PI / 3;
// H_t(z): (H - p)/(H - q) = e^{i θ t} (z - p)/(z - q)
const H = (t, z) => { const k = [Math.cos(TH * t), Math.sin(TH * t)]; const u = cm(k, cd(cs(z, P), cs(z, Q))); return cd(cs(P, cm(u, Q)), cs([1, 0], u)); };
const Hinv = (t, w) => H(-t, w);
const css = MK.css, rgb = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const D1 = { kind: 'disc', c: [0.6, 1.2], r: 0.7, ci: 1 };
const RC = { kind: 'rect', a: [-2.1, 0.35], b: [-0.75, 1.35], ci: 2 };
const SH = [D1, RC, { kind: 'point', p: [1.55, 0.45], ci: 5 }];
function rulers(id, v) { const x = document.getElementById(id + 'RX'), y = document.getElementById(id + 'RY'); if (x) MK.ruler(x, v, 'x'); if (y) MK.ruler(y, v, 'y'); }
function fitC(cv) { const dpr = Math.min(2, devicePixelRatio || 1); const w = cv.clientWidth, h = cv.clientHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); return { w, h, dpr, ctx: cv.getContext('2d') }; }
function inside(s, x, y) { if (s.kind === 'disc') return Math.hypot(x - s.c[0], y - s.c[1]) < s.r; if (s.kind === 'rect') return x > Math.min(s.a[0], s.b[0]) && x < Math.max(s.a[0], s.b[0]) && y > Math.min(s.a[1], s.b[1]) && y < Math.max(s.a[1], s.b[1]); return false; }
function bpts(s) { const o = []; if (s.kind === 'disc') for (let i = 0; i <= 240; i++) { const a = TAU * i / 240; o.push([s.c[0] + s.r * Math.cos(a), s.c[1] + s.r * Math.sin(a)]); } else { const x0 = s.a[0], x1 = s.b[0], y0 = s.a[1], y1 = s.b[1], cs4 = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]; for (let k = 0; k < 4; k++) for (let i = 0; i < 60; i++) { const a = cs4[k], b = cs4[k + 1]; o.push([a[0] + (b[0] - a[0]) * i / 60, a[1] + (b[1] - a[1]) * i / 60]); } o.push(cs4[0]); } return o; }
// the merged deformation plane: paper, X grey (bounded: 7% ink), H_t(X) with the checker, X's outline over it, paths
function deformPlane(id, t, v) {
  const cv = document.getElementById(id + 'C'); if (!cv) return;
  const { w, h, dpr, ctx } = fitC(cv); const W = cv.width, Hh = cv.height, s = v.s * dpr;
  const img = ctx.createImageData(W, Hh), pl = rgb(css('--plane')), ink = rgb(css('--ink')), gmin = rgb(css('--grid-minor')), gmaj = rgb(css('--grid-major'));
  const step = 0.5;
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const X = v.cx + (i + .5 - W / 2) / s, Y = v.cy - (j + .5 - Hh / 2) / s;
    let c = pl.slice();
    const gx = Math.abs(X / step - Math.round(X / step)) * step * s, gy = Math.abs(Y / step - Math.round(Y / step)) * step * s;
    if (gx < .6 || gy < .6) c = gmin.slice();
    if ((Math.abs(X - Math.round(X)) * s < .7) || (Math.abs(Y - Math.round(Y)) * s < .7)) c = gmaj.slice();
    for (const sh of [D1, RC]) if (inside(sh, X, Y)) c = c.map((q, n) => q + (ink[n] - q) * 0.07);
    const z = Hinv(t, [X, Y]);
    for (const sh of [D1, RC]) if (inside(sh, z[0], z[1])) {
      const k = MK.ink(sh.ci), chk = (Math.floor(z[0] / 0.25) + Math.floor(z[1] / 0.25)) & 1;
      const fc = chk ? k.alt : k.c; c = c.map((q, n) => q + (fc[n] - q) * 0.85);
    }
    const p = (j * W + i) * 4; img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const toS = (q) => [w / 2 + (q[0] - v.cx) * v.s, h / 2 - (q[1] - v.cy) * v.s];
  const line = (pts, f) => { ctx.beginPath(); pts.forEach((q, n) => { const a = toS(f(q)); n ? ctx.lineTo(a[0], a[1]) : ctx.moveTo(a[0], a[1]); }); ctx.stroke(); };
  // H_t(X)'s edge, the end (dotted), X's outline
  for (const sh of [D1, RC]) { ctx.strokeStyle = MK.ink(sh.ci).edge; ctx.lineWidth = 1.5; line(bpts(sh), (q) => H(t, q)); ctx.setLineDash([1, 2]); ctx.strokeStyle = css('--faint'); ctx.lineWidth = 1; line(bpts(sh), (q) => H(1, q)); ctx.setLineDash([]); ctx.strokeStyle = css('--ink-2'); ctx.lineWidth = 0.9; line(bpts(sh), (q) => q); }
  // paths: rails to the end, travelled part to t, heads (the morph figure's look)
  const starts = [[-1.5, 0.35], [-0.75, 0.85], [0.6, 0.5], [1.3, 1.2], [0.6, 1.9], [-0.1, 1.2], [-1.4, 1.35], [-0.75, 0.35]];
  for (const z of starts) {
    const rail = [], trav = [];
    for (let k = 0; k <= 120; k++) { const u = k / 120; rail.push(H(u, z)); if (u <= t) trav.push(H(u, z)); }
    ctx.lineCap = 'round';
    ctx.strokeStyle = css('--faint'); ctx.globalAlpha = .75; ctx.lineWidth = 1; line(rail, (q) => q); ctx.globalAlpha = 1;
    const e = toS(rail[rail.length - 1]), e0 = toS(rail[rail.length - 4]); const a = Math.atan2(e[1] - e0[1], e[0] - e0[0]);
    ctx.fillStyle = css('--faint'); ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(e[0] - 7 * Math.cos(a) + 2.6 * Math.sin(a), e[1] - 7 * Math.sin(a) - 2.6 * Math.cos(a)); ctx.lineTo(e[0] - 7 * Math.cos(a) - 2.6 * Math.sin(a), e[1] - 7 * Math.sin(a) + 2.6 * Math.cos(a)); ctx.fill();
    ctx.strokeStyle = css('--halo'); ctx.globalAlpha = .8; ctx.lineWidth = 3.2; line(trav, (q) => q); ctx.globalAlpha = 1;
    ctx.strokeStyle = css('--ink-2'); ctx.lineWidth = 1.5; line(trav, (q) => q);
    const s0 = toS(z), hd = toS(H(t, z));
    ctx.fillStyle = css('--halo'); ctx.beginPath(); ctx.arc(s0[0], s0[1], 3, 0, TAU); ctx.fill(); ctx.fillStyle = css('--ink-2'); ctx.beginPath(); ctx.arc(s0[0], s0[1], 2, 0, TAU); ctx.fill();
    ctx.fillStyle = css('--halo'); ctx.beginPath(); ctx.arc(hd[0], hd[1], 3.8, 0, TAU); ctx.fill(); ctx.fillStyle = css('--ink-2'); ctx.beginPath(); ctx.arc(hd[0], hd[1], 2.6, 0, TAU); ctx.fill();
  }
}
// a landscape of log|F| over X coloured by the phase (painter's quads; a mockup of the relief, not the app's shader)
function landscape(id) {
  const cv = document.getElementById(id + 'C'); const { w, h, dpr, ctx } = fitC(cv); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, css('--land-top')); g.addColorStop(1, css('--land-bottom')); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const yaw = -38 * Math.PI / 180, pit = 30 * Math.PI / 180, N = 90, R = 2.5;
  const proj = (x, y, z) => { const X = x * Math.cos(yaw) - y * Math.sin(yaw), Y = x * Math.sin(yaw) + y * Math.cos(yaw); const sy = Y * Math.sin(pit) - z * Math.cos(pit); const d = 9 - Y * Math.cos(pit) - z * Math.sin(pit); return [w / 2 + X * h * 0.9 / d * 1.9, h * 0.52 + sy * h * 0.9 / d * 1.9, d]; };
  const ht = (x, y) => { const f = MK.F(x, y); return Math.max(-1.6, Math.min(1.6, Math.log(Math.hypot(f[0], f[1])))) * 0.55; };
  const quads = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x0 = -R + 2 * R * i / N, x1 = -R + 2 * R * (i + 1) / N, y0 = -R + 2 * R * j / N, y1 = -R + 2 * R * (j + 1) / N;
    const zs = [ht(x0, y0), ht(x1, y0), ht(x1, y1), ht(x0, y1)], pts = [proj(x0, y0, zs[0]), proj(x1, y0, zs[1]), proj(x1, y1, zs[2]), proj(x0, y1, zs[3])];
    const f = MK.F((x0 + x1) / 2, (y0 + y1) / 2), c = MK.phaseRGB(f[0], f[1]);
    const nx = (zs[1] - zs[0]) / (x1 - x0), ny = (zs[3] - zs[0]) / (y1 - y0), l = 0.75 + 0.25 * Math.max(-1, Math.min(1, (-nx * 0.5 + ny * 0.6) / Math.hypot(nx, ny, 1)));
    quads.push([pts.reduce((a, p) => a + p[2], 0) / 4, pts, c.map((q) => Math.round(q * l))]);
  }
  quads.sort((a, b) => b[0] - a[0]);
  for (const [, p, c] of quads) { ctx.fillStyle = `rgb(${c})`; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(p[k][0], p[k][1]); ctx.closePath(); ctx.fill(); ctx.stroke(); }
}
function draw() {
  const VX = { cx: -0.4, cy: 0.9, s: 92 }, VY = { cx: 0, cy: -0.05, s: 128 }, VP = { cx: -0.3, cy: 0.3, s: 110 }, VD = { cx: -0.35, cy: 0.55, s: 150 };
  MK.plane(document.getElementById('aLC'), { space: 'X', view: VX, shapes: SH }); rulers('aL', VX);
  MK.plane(document.getElementById('aRC'), { space: 'Y', view: VY, shapes: SH }); rulers('aR', VY);
  MK.plane(document.getElementById('bLC'), { space: 'X', view: VP, shapes: SH, paint: 'phase' }); rulers('bL', VP);
  landscape('cL');
  deformPlane('dR', 0.55, VD); rulers('dR', VD);
  deformPlane('eR', 0.55, { cx: -0.4, cy: 0.3, s: 70 });
  MK.plane(document.getElementById('fLC'), { space: 'X', view: { cx: -0.3, cy: 0.3, s: 70 }, shapes: SH, paint: 'phase' });
  MK.legend(document.getElementById('leg'), '|F|');
}
function themeCycle() { const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark'; draw(); }
fillIcons();
document.fonts.ready.then(draw);
"""

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Merged views mockup</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..700&family=B612+Mono:wght@400;700&family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&display=swap">
<style>{app_css}{CSS}</style></head><body>
<div class="mock-bar"><b>Merged views mockup</b><span>the view switch, the Deformation toggle, the merged panels · notes/ui-design/merged-views.md</span><span class="sp"></span><button onclick="themeCycle()">Light / dark</button></div>
{F1}{F2}{F3}{F4}{PHONE}
<script>
{render_js}
{ICONS}
{SCRIPT}
</script></body></html>
'''
(proj / 'notes' / 'ui-design' / 'mockup-merged.html').write_text(html)
print('wrote', len(html), 'bytes')
