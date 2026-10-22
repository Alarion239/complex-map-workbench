
in vec2 vSrc;
flat in float vJac;

uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uK;
uniform float uAlpha; uniform int uPattern; uniform float uCell; uniform float uLines; uniform float uDpr;
uniform vec3 uShrink; uniform vec3 uGrow; uniform vec3 uMid; uniform vec2 uOrigin; uniform vec2 uQ;
uniform float uSphN;
out vec4 o;
float sdBox(vec2 q, vec2 a, vec2 b) { vec2 c = 0.5 * (a + b), h = 0.5 * (b - a); vec2 d = abs(q - c) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float net(vec2 g, vec2 gw) { return max(iso(g.x, gw.x, 1.0), iso(g.y, gw.y, 1.0)) * (1.0 - moire(gw)); }
void main() {
  // pattern coordinates are the source point, carried through the map (vSrc is relative to the pattern-aligned
  // origin uQ; sa is the absolute source point, for what is not periodic)
  vec2 sa = vSrc + uQ;
  vec2 g = vSrc / uCell;
  vec2 gw = fwidth(g);
  vec2 sp = vSrc - uOrigin;
  float rr = length(sp);
  vec2 gp = vec2(log(max(rr, 1e-30)), atan(sp.y, sp.x)) * (16.0 / TAU);
  vec2 gpw = vec2(fwidth(gp.x), argWidth(sp) * (16.0 / TAU));
  float gr = rr / uCell, fgr = fwidth(gr);
  float ra = atan(sp.y, sp.x) * (12.0 / PI), fra = argWidth(sp) * (12.0 / PI);
  float lr = log(max(length(sa), 1e-30)) * (6.0 / PI), flr = fwidth(lr);
  vec2 fs = fwidth(vSrc);
  float m = moire(gw);
  vec3 c0 = uC0, c1 = uC1, k = uK;
  vec3 col = c0;
  if (uPattern == 1) {              // Checker
    col = mix(mix(c0, c1, checker(g, gw)), 0.5 * (c0 + c1), m);
    if (uLines > 0.5) col = mix(col, k, 0.35 * net(g, gw));
  } else if (uPattern == 2) {       // Conformal checker: 16 sectors, radial ratio e^(pi/8)
    col = mix(mix(c0, c1, checker(gp, gpw)), 0.5 * (c0 + c1), moire(gpw));
    if (uLines > 0.5) col = mix(col, k, 0.35 * net(gp, gpw));
    float rc = gr * 12.0;
    col = mix(c0, col, clamp(0.5 + (rc - 1.0) / max(fgr * 12.0, 1e-9), 0.0, 1.0));
  } else if (uPattern == 3) {       // Orientation tiles with an F per cell
    vec3 ca = c1, cb = mix(c1, c0, 0.35);
    col = mix(ca, cb, checker(g, gw));
    vec2 q = g - floor(g);
    float d = min(sdBox(q, vec2(0.30, 0.18), vec2(0.42, 0.82)), min(sdBox(q, vec2(0.30, 0.70), vec2(0.72, 0.82)), sdBox(q, vec2(0.30, 0.46), vec2(0.62, 0.56))));
    float pw = max(0.5 * (gw.x + gw.y), 1e-12);
    float cov = clamp(0.5 - d / pw, 0.0, 1.0) * smoothstep(10.0, 16.0, 1.0 / (pw * uDpr));
    col = mix(mix(col, k, cov), 0.5 * (ca + cb), m);
  } else if (uPattern == 4) {       // Graph paper: two families, source axes
    float re1 = iso(g.x, gw.x, 1.25 * uDpr) * dfade(gw.x), re5 = iso(g.x / 5.0, gw.x / 5.0, 1.75 * uDpr) * dfade(gw.x / 5.0);
    float im1 = iso(g.y, gw.y, 1.0 * uDpr) * dfade(gw.y), im5 = iso(g.y / 5.0, gw.y / 5.0, 1.5 * uDpr) * dfade(gw.y / 5.0);
    float ax = max(iso0(sa.x, fs.x, 2.0 * uDpr), iso0(sa.y, fs.y, 2.0 * uDpr));
    col = mix(c1, mix(c0, k, 0.5), 0.3 * m);
    col = mix(col, c0, max(im1, im5));
    col = mix(col, k, max(re1, re5));
    col = mix(col, k, ax);
  } else if (uPattern == 5) {       // Polar web
    col = mix(c1, mix(c0, k, 0.5), 0.2 * moire(vec2(fgr)));
    col = mix(col, c0, iso(gr, fgr, uDpr) * dfade(fgr));
    col = mix(col, k, 0.7 * iso(ra, fra, uDpr) * dfade(fra));
    col = mix(col, k, iso(ra / 6.0, fra / 6.0, 1.75 * uDpr) * dfade(fra / 6.0));
  } else if (uPattern == 6) {       // Source phase (ignores the shape color)
    float sw = mix(sawAA(lr, flr), 0.5, moire(vec2(flr)));
    col = wheel(atan(sa.y, sa.x), 0.62 + 0.14 * sw);
    if (uLines > 0.5) col = mix(col, k, 0.35 * net(g, gw));
  } else if (uPattern == 7) {       // Area scale: blue shrinks, amber grows
    float t = clamp(vJac / 3.0, -1.0, 1.0);
    col = t < 0.0 ? mix(uMid, uShrink, pow(-t, 0.8)) : mix(uMid, uGrow, pow(t, 0.8));
    col = mix(col, k, 0.18 * max(iso(g.x, gw.x, uDpr), iso(g.y, gw.y, uDpr)) * (1.0 - m));
  } else if (uPattern == 8) {       // Sphere checker: n longitude sectors x n / 2 latitude bands of the Riemann sphere
    vec2 sl = gp * (TAU / 16.0), slw = gpw * (TAU / 16.0);   // (ln rho, theta) about the origin and their footprints
    float ex = exp(-abs(sl.x));
    float lat = sl.x > 0.0 ? PI - 2.0 * atan(ex) : 2.0 * atan(ex);   // 2 atan(rho): 0 at the origin, pi at infinity
    vec2 gs = vec2(sl.y * uSphN / TAU, lat * 0.5 * uSphN / PI);
    vec2 gsw = vec2(slw.y * uSphN / TAU, slw.x * (2.0 * ex / (1.0 + ex * ex)) * 0.5 * uSphN / PI);
    col = mix(mix(c0, c1, checker(gs, gsw)), 0.5 * (c0 + c1), moire(gsw));
    if (uLines > 0.5) col = mix(col, k, 0.35 * net(gs, gsw));
  } else {                          // Solid
    if (uLines > 0.5) col = mix(col, k, 0.35 * net(g, gw));
  }
  float a = uAlpha * fadeOf(sa);

  o = vec4(col * a, a);
}
