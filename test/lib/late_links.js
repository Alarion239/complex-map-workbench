// Links that land late, on any back end: a page script installed before the page loads (Page.addScriptToEvaluateOnNewDocument,
// as test/steps_late_links_cmd.js does), which hands the app a KHR_parallel_shader_compile whose COMPLETION_STATUS_KHR of a
// program reads false until window.__lateLinkMs (default LATE_LINK_MS) after its linkProgram, as a Metal link that lands
// seconds after it began. The delay is read at each linkProgram, so a page can make the links it starts from some moment
// on land later. A back end that links at once (lavapipe, SwiftShader: no parallel compile) then runs the app's
// background-link paths, the ones a GPU machine takes. The real link is still the driver's: a LINK_STATUS read after the
// wait finds it done. window.__lateLinks: { ms (the first delay), links (linkProgram calls), early (status polls answered
// not yet) }.
(() => {
  const LATE_LINK_MS = 2500, COMPLETION_STATUS_KHR = 0x91B1;
  const delay = () => (Number(window.__lateLinkMs) > 0 ? Number(window.__lateLinkMs) : LATE_LINK_MS), ms = delay();
  const P = WebGL2RenderingContext.prototype;
  const getExtension = P.getExtension, getSupported = P.getSupportedExtensions, linkProgram = P.linkProgram;
  const getProgramParameter = P.getProgramParameter, getShaderParameter = P.getShaderParameter;
  // (landsAt: each program's time from which its link reads complete)
  const landsAt = new WeakMap(), stat = { ms, links: 0, early: 0 };
  window.__lateLinks = stat;
  const ext = { COMPLETION_STATUS_KHR, maxShaderCompilerThreadsKHR() {} };
  P.getExtension = function (name) { return name === 'KHR_parallel_shader_compile' ? ext : getExtension.call(this, name); };
  P.getSupportedExtensions = function () {
    const r = getSupported.call(this) || [];
    return r.includes('KHR_parallel_shader_compile') ? r : r.concat(['KHR_parallel_shader_compile']);
  };
  P.linkProgram = function (p) { landsAt.set(p, performance.now() + delay()); stat.links++; return linkProgram.call(this, p); };
  P.getProgramParameter = function (p, k) {
    if (k !== COMPLETION_STATUS_KHR) return getProgramParameter.call(this, p, k);
    const t = landsAt.get(p), done = t == null || performance.now() >= t;
    if (!done) stat.early++;
    return done;
  };
  P.getShaderParameter = function (s, k) { return k === COMPLETION_STATUS_KHR ? true : getShaderParameter.call(this, s, k); };
})();
