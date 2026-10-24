# Builds demo.html: the constructions proof of concept with the app's own stylesheet and tokens (light and dark).
# Run: python3 build_demo.py   (reads ../../app-copy-constructions/src/page.html, constr.js and demo.js)
import pathlib, re
here = pathlib.Path(__file__).parent
page = (here / '../../app-copy-constructions/src/page.html').read_text()
head = page.split('<style>')[0]
fonts = '\n'.join(l for l in head.splitlines() if 'fonts.g' in l)
app_css = re.search(r'<style>(.*?)</style>', page, re.S).group(1)

CSS = r"""
/* ---------- demo frame (proof of concept; not app CSS) ---------- */
#demo { height: 100%; display: grid; grid-template-rows: 44px minmax(0, 1fr); padding: 0 8px 8px; }
.dtop { gap: 10px; }
.dtop > * { order: 0 !important; }
.dtop .sub { font: var(--t-label); color: var(--muted); }
.dlayout { display: grid; grid-template-columns: minmax(0, 1fr) 312px; gap: 8px; min-height: 0; }
.dstage { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-3); overflow: hidden; }
.dtools { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-bottom: 1px solid var(--line); overflow-x: auto; scrollbar-width: none; }
.dtools .tool { width: 66px; flex: 0 0 auto; }
.dtools .tsep { width: 1px; height: 28px; background: var(--line); margin: 0 4px; flex: 0 0 auto; }
.dtools .check { margin-left: auto; flex: 0 0 auto; }
.dplot { position: relative; min-height: 0; }
.dplot canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
.dchip { position: absolute; z-index: 5; background: var(--overlay); border: 1px solid var(--line-strong); box-shadow: var(--shadow-1); border-radius: var(--r-2); padding: 3px 8px; }
.dhint { top: 8px; left: 8px; max-width: calc(100% - 16px); font: var(--t-label); color: var(--ink-2); }
.dhint i { font: var(--t-math-s); color: var(--ink); }
.dperf { bottom: 8px; left: 8px; font: var(--t-readout); color: var(--muted); }
.dflash { position: absolute; z-index: 6; bottom: 44px; left: 50%; translate: -50% 0; background: var(--inverse); color: var(--inverse-ink); font: var(--t-body); padding: 6px 12px; border-radius: var(--r-2); box-shadow: var(--shadow-3); }
.dflash i { font: var(--t-math-s); }
/* the Objects panel */
.dpanel .psec { padding: 10px 10px 8px; }
.dpanel h2 .count { font: var(--t-label); color: var(--muted); }
.dpanel .err { min-height: 0; margin-top: 4px; }
.o-row { display: grid; grid-template-columns: 14px 30px minmax(0, 1fr); column-gap: 6px; align-items: start; padding: 5px 8px 5px 8px; margin-bottom: 4px;
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-3); cursor: default; transition: background-color var(--t-fast) var(--ease-out), border-color var(--t-fast) var(--ease-out); }
.o-row:hover { border-color: var(--line-strong); }
.o-row.hl { background: var(--accent-soft); }
.o-row.sel { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.o-row.undef .o-name, .o-row.undef .o-def { color: var(--faint); }
.o-name { font: var(--t-math); color: var(--ink); white-space: nowrap; line-height: 20px; }
.o-name sub, .o-def sub, .o-rel sub, .dhint sub { font: 500 10px/1 var(--f-math); font-style: normal; }
.o-body { min-width: 0; }
.o-def { font: var(--t-body); color: var(--ink-2); line-height: 20px; overflow-wrap: anywhere; }
.o-def i { font: var(--t-math-s); color: var(--ink); }
.o-val { color: var(--muted); white-space: nowrap; }
.o-val i { font: italic 500 12px var(--f-math); }
.o-err { font: var(--t-label); color: var(--warn); }
.o-err i { font: var(--t-math-s); }
.o-rel { font: var(--t-label); color: var(--muted); margin-top: 2px; }
.o-rel i { font: var(--t-math-s); color: var(--ink-2); }
.o-tag { font: var(--t-caption); color: var(--muted); border: 1px solid var(--line-strong); border-radius: var(--r-1); padding: 0 4px; vertical-align: 1px; }
.o-sw { width: 14px; height: 14px; margin-top: 3px; border-radius: var(--r-1); background: linear-gradient(135deg, transparent calc(50% - 1px), var(--sw) calc(50% - 1px), var(--sw) calc(50% + 1px), transparent calc(50% + 1px)); }
.o-sw[data-area="1"] { border-radius: 50%; background: color-mix(in srgb, var(--swf) 22%, transparent); box-shadow: inset 0 0 0 1.75px var(--sw); }
.o-pt { width: 10px; height: 10px; margin: 5px 2px 0; border-radius: 50%; box-shadow: inset 0 0 0 1.75px var(--ink); background: var(--plane); }
.o-pt.free { background: var(--ink); box-shadow: 0 0 0 1.5px var(--surface); }
.o-slider { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.o-slider input[type="range"] { flex: 1 1 auto; min-width: 60px; }
.o-lim { font: var(--t-micro); color: var(--faint); }
.o-play.on { background: var(--inverse); color: var(--inverse-ink); }
@media (max-width: 760px) {
  html, body { height: auto; }
  #demo { height: auto; grid-template-rows: 44px auto; }
  .dlayout { grid-template-columns: minmax(0, 1fr); }
  .dstage { height: 62svh; }
  .dtools .tool { width: 56px; }
  .dtop .sub { display: none; }
}
"""

ICON = {
  'move': '<path d="M5 3l11 6-5 1.5L8.5 16z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  'point': '<circle cx="10" cy="10" r="3" fill="currentColor"/>',
  'line': '<path d="M2 15L18 5" stroke="currentColor" stroke-width="1.4"/><circle cx="6.5" cy="12.2" r="2" fill="currentColor"/><circle cx="13.5" cy="7.8" r="2" fill="currentColor"/>',
  'circle3': '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="3.6" cy="12.9" r="1.8" fill="currentColor"/><circle cx="14.5" cy="4.6" r="1.8" fill="currentColor"/><circle cx="13.7" cy="16" r="1.8" fill="currentColor"/>',
  'circleCP': '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="10" r="1.8" fill="currentColor"/><circle cx="17" cy="10" r="1.8" fill="currentColor"/>',
  'bisector': '<path d="M3 13h14" stroke="currentColor" stroke-width="1.4"/><path d="M10 2v16" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"/><circle cx="4" cy="13" r="1.8" fill="currentColor"/><circle cx="16" cy="13" r="1.8" fill="currentColor"/>',
  'meet': '<circle cx="8" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 17L18 3" stroke="currentColor" stroke-width="1.4"/><circle cx="12.3" cy="7.7" r="2" fill="var(--plane)" stroke="currentColor" stroke-width="1.4"/>',
}
TOOLS = [('move', 'Move'), ('point', 'Point'), None, ('line', 'Line'), ('circle3', '3 points'), ('circleCP', 'Centre'), ('bisector', 'Bisector'), ('meet', 'Intersect')]
tools = ''.join('<span class="tsep"></span>' if t is None else
                f'<button class="tool" data-tool="{t[0]}" aria-pressed="false" title="{t[1]}"><svg viewBox="0 0 20 20">{ICON[t[0]]}</svg><span>{t[1]}</span></button>' for t in TOOLS)

MARK = re.search(r'(<svg viewBox="0 0 28 28".*?</svg>)', page, re.S).group(1)
HTML = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Constructions demo</title>
{fonts}
<style>{app_css}</style>
<style>{CSS}</style>
</head><body>
<div id="demo">
  <header class="top dtop">
    {MARK}
    <h1 class="wordmark">Constructions</h1>
    <span class="sub">proof of concept: shared numbers, points, lines, circles through three points</span>
    <div class="spacer"></div>
    <button class="btn ghost small" id="resetBtn">Reset</button>
    <button class="btn small" id="themeBtn" title="Light or dark">Light / dark</button>
  </header>
  <main class="dlayout">
    <section class="dstage">
      <div class="dtools" id="tools" role="toolbar" aria-label="Construction tools">{tools}
        <label class="check"><input type="checkbox" id="snapChk" checked><span>Snap</span></label>
      </div>
      <div class="dplot"><canvas id="plane"></canvas>
        <div class="dchip dhint" id="hint"></div>
        <div class="dchip dperf" id="perf"></div>
        <div class="dflash" id="flash" hidden></div>
      </div>
    </section>
    <aside class="panel dpanel" id="objPanel" aria-label="Objects">
      <section class="psec"><h2><span class="grow">Objects</span></h2>
        <form id="addForm" class="formula-row"><input id="addInp" class="inp math-src" placeholder="Re z = b,  b = 2,  T = P + a" spellcheck="false" autocomplete="off" aria-label="Add a number, point or equation"><button class="btn primary">Add</button></form>
        <div class="err" id="addErr"></div>
      </section>
      <section class="psec"><h2>Numbers <span class="count" id="numCount"></span></h2><div id="numList"></div></section>
      <section class="psec"><h2>Curves <span class="count" id="curveCount"></span></h2><div id="curveList"></div></section>
      <section class="psec"><h2>Points <span class="count" id="pointCount"></span></h2><div id="pointList"></div></section>
    </aside>
  </main>
</div>
<script>{(here / 'constr.js').read_text()}</script>
<script>{(here / 'demo.js').read_text()}</script>
</body></html>
"""
(here / 'demo.html').write_text(HTML)
print('demo.html', len(HTML), 'bytes')
