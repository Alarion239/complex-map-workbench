// Unit checks of the tour engine's geometry added in the polish round (notes/tour/POLISH.md): place() with the safe
// area and open layers (opt.safe, opt.block), the docked callout (placeDock), and the exact spotlight path (rrPath with
// per-corner radii). DOM-free: node test/t_tour_engine.js
const { Tour } = require('../src/tour.js');
const T = Tour._t;
let n = 0, fails = 0;
const ok = (name, c, info) => { n++; if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } };
const hit = (p, c, h, m = 0) => p.x < h.r + m && p.x + c.w > h.l - m && p.y < h.b + m && p.y + c.h > h.t - m;
const inside = (p, c, v, s = { t: 0, r: 0, b: 0, l: 0 }) => p.x >= s.l && p.y >= s.t && p.x + c.w <= v.w - s.r && p.y + c.h <= v.h - s.b;

// without the new options place() is unchanged (the fuzz of t_tour.js covers it); with them:
const vp = { w: 1440, h: 900 }, card = { w: 320, h: 230 };
const paneL = { l: 268, t: 44, r: 698, b: 612 };
const pal = { l: 360, t: 126, r: 1080, b: 646 };
let p = T.place(paneL, card, vp, { prefer: 'right' });
ok('no layer: beside the pane on the right', p.mode === 'side' && p.side === 'right', p);
p = T.place(paneL, card, vp, { prefer: 'right', block: [pal] });
ok('the palette open: the callout keeps clear of it', p.mode !== 'dock' && !hit(p, card, pal, 8) && inside(p, card, vp), p);
// 1024 px: no room beside the palette for the whole card: dock
const vp2 = { w: 1024, h: 768 }, pal2 = { l: 152, t: 108, r: 872, b: 628 };
p = T.place({ l: 266, t: 44, r: 636, b: 500 }, card, vp2, { prefer: 'right', block: [pal2] });
ok('1024 px with the palette: dock', p.mode === 'dock', p);
const d = T.placeDock({ w: 300, h: 52 }, vp2, { block: [pal2], lit: [{ l: 266, t: 44, r: 636, b: 500 }] });
ok('docked: above the palette, inside the viewport', d.mode === 'dock' && !hit(d, { w: 300, h: 52 }, pal2, 8) && inside(d, { w: 300, h: 52 }, vp2), d);
// phone: the palette is a bottom sheet of 85 % of the height: a sheet cannot avoid it, the dock sits above it
const ph = { w: 390, h: 844 }, sheet = { l: 0, t: 127, r: 390, b: 844 };
p = T.place({ l: 16, t: 80, r: 374, b: 300 }, { w: 366, h: 240 }, ph, { block: [sheet] });
ok('phone with the palette: dock', p.mode === 'dock', p);
const d2 = T.placeDock({ w: 366, h: 60 }, ph, { block: [sheet], narrow: 640 });
ok('phone docked: at the top, clear of the sheet', d2.side === 'top' && d2.y + 60 <= sheet.t - 8, d2);
// phone: the More menu at the top right: the sheet goes to the bottom
const more = { l: 138, t: 44, r: 378, b: 420 };
p = T.place({ l: 16, t: 500, r: 374, b: 700 }, { w: 366, h: 240 }, ph, { block: [more] });
ok('phone with the More menu: a sheet clear of it', p.mode === 'sheet' && !hit(p, { w: 366, h: 240 }, more, 8), p);
// the safe area: a notch of 47 px and a home bar of 34 px
const safe = { t: 47, r: 0, b: 34, l: 0 };
p = T.place({ l: 16, t: 500, r: 374, b: 700 }, { w: 366, h: 240 }, ph, { safe });
ok('safe area: a top sheet below the notch', p.mode === 'sheet' && p.y >= 47 + 12 && inside(p, { w: 366, h: 240 }, ph, safe), p);
p = T.place({ l: 16, t: 80, r: 374, b: 300 }, { w: 366, h: 240 }, ph, { safe });
ok('safe area: a bottom sheet above the home bar', p.mode === 'sheet' && p.y + 240 <= 844 - 34 - 12, p);
// fuzz: with layers and a safe area the card stays inside, and never covers a layer unless it is docked
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
let bad = 0, cover = 0, docks = 0;
for (let i = 0; i < 4000; i++) {
  const v = i % 3 === 0 ? { w: 340 + Math.round(rnd() * 300), h: 640 + Math.round(rnd() * 300) } : { w: 700 + Math.round(rnd() * 900), h: 600 + Math.round(rnd() * 400) };
  const c = v.w < 640 ? { w: v.w - 24, h: 140 + Math.round(rnd() * 160) } : { w: 320, h: 140 + Math.round(rnd() * 160) };
  const s = { t: Math.round(rnd() * 40), r: 0, b: Math.round(rnd() * 30), l: 0 };
  const hw = 40 + rnd() * v.w * 0.6, hh = 40 + rnd() * v.h * 0.6, hl = rnd() * (v.w - hw), ht = rnd() * (v.h - hh);
  const hole = { l: hl, t: ht, r: hl + hw, b: ht + hh };
  const lw = 100 + rnd() * v.w * 0.6, lh = 80 + rnd() * v.h * 0.6, ll = rnd() * (v.w - lw), lt = rnd() * (v.h - lh);
  const layer = { l: ll, t: lt, r: ll + lw, b: lt + lh };
  const q = T.place(hole, c, v, { safe: s, block: [layer] });
  if (q.mode === 'dock') { docks++; continue; }
  if (!inside(q, c, v, s)) bad++;
  if (hit(q, c, layer, 7.5)) cover++;
}
ok('fuzz: inside the viewport and the safe area', bad === 0, bad);
ok('fuzz: never over an open layer', cover === 0, cover);
ok('fuzz: some cases dock, most do not', docks > 0 && docks < 4000 * 0.6, docks);
// a dialog that fills a phone's screen, its controls along the top and the bottom: the docked strip covers none of them
{
  const dlg = { l: 12, t: -20, r: 378, b: 798 }, ctl = [{ l: 20, t: 40, r: 370, b: 90 }, { l: 20, t: 700, r: 370, b: 790 }, { l: 20, t: 300, r: 370, b: 340 }];
  const dc = { w: 240, h: 54 };
  const q = T.placeDock(dc, ph, { block: [dlg], avoid: ctl, safe: { t: 47, b: 34 } });
  ok('full-screen dialog: the dock covers no control', ctl.every((c) => !hit(q, dc, c, 4)) && inside(q, dc, ph, { t: 47, r: 0, b: 34, l: 0 }), q);
  let calls = 0;
  T.placeDock(dc, { w: 1024, h: 768 }, { block: [{ l: 152, t: 108, r: 872, b: 628 }], avoid: () => { calls++; return []; } });
  ok('dock: the controls are looked up only when every place covers a layer', calls === 0, calls);
}
// rrPath: per-corner radii, and the bounding box is the rect exactly
const path = T.rrPath({ l: 10, t: 20, r: 110, b: 60, rad: [6, 6, 0, 0] });
const nums = path.match(/-?[\d.]+/g).map(Number);
ok('rrPath: per-corner radii', /A6 6 0 0 1 110 26/.test(path) && /A0 0 0 0 1 100 60|A0 0 0 0 1 110 60/.test(path), path);
ok('rrPath: a single radius still works', /A8 8/.test(T.rrPath({ l: 0, t: 0, r: 100, b: 50, rad: 8 })));
ok('rrPath: radii never exceed half the side', !/A30 /.test(T.rrPath({ l: 0, t: 0, r: 40, b: 40, rad: 30 })));
ok('rrPath: numbers present', nums.length > 10);
// the review of the polish round (notes/tour/review-polish.json)
// polish-1: a part cut to nothing by a panel that cannot scroll is clipped away; one bigger than its panel is not
const box = (l, t, r, b) => ({ left: l, top: t, right: r, bottom: b });
ok('clipped away: the transport below the squeezed panes (0 px left)', T.clippedAway(box(92, 77, 752, 117), { clip: { l: 91, t: 44, r: 753, b: 68 } }));
ok('clipped away: a sliver of 4 px of a 40 px control', T.clippedAway(box(0, 64, 100, 104), { clip: { l: 0, t: 0, r: 400, b: 68 } }));
ok('clipped away: 20 % of a control that would fit', T.clippedAway(box(0, 60, 100, 110), { clip: { l: 0, t: 0, r: 400, b: 70 } }));
ok('not clipped away: whole', !T.clippedAway(box(10, 10, 100, 40), { clip: { l: 0, t: 0, r: 400, b: 300 } }));
ok('not clipped away: no clipping panel (the viewport is not one)', !T.clippedAway(box(10, -100, 100, -60), { clip: null }));
ok('not clipped away: bigger than its panel, its visible part is lit', !T.clippedAway(box(0, 0, 100, 2000), { clip: { l: 0, t: 0, r: 400, b: 300 } }));
// polish-8: the strip beside a dialog for the docked callout
ok('dock gutter: 1024 px, the guide 640 px wide in the middle', T.dockGutter({ w: 1024, h: 768 }, { block: [{ l: 192, t: 12, r: 832, b: 756 }], min: 136 }) === 176);
ok('dock gutter: none when narrower than the minimum', T.dockGutter({ w: 844, h: 390 }, { block: [{ l: 102, t: 12, r: 742, b: 378 }], safe: { l: 47, r: 47 }, min: 144 }) === 0);
ok('dock gutter: none without a layer', T.dockGutter({ w: 1024, h: 768 }, { block: [] }) === 0);
const dg = { w: 176, h: 58 }, guide = { l: 192, t: 12, r: 832, b: 756 };
const dq = T.placeDock(dg, { w: 1024, h: 768 }, { block: [guide] });
ok('dock in the gutter: clear of the guide', dq.over === 0 && !hit(dq, dg, guide) && inside(dq, dg, { w: 1024, h: 768 }), dq);
ok('dock: reports how much of the layers it covers', T.placeDock({ w: 300, h: 52 }, { w: 1024, h: 768 }, { block: [guide] }).over > 0);
console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
