// What the page and its helpers put on window (issue #20, phase 1), for `npm run typecheck`: the typesetter and the
// PDF libraries the page loads (MathJax, jsPDF, svg2pdf.js), the host's claude object, Safari's AudioContext name, the
// modules the app hangs on window for the tour and the tests, and the test hooks (__cmw*, test.html only: the
// published page drops them). Typed any: they are other code's objects, or read by tests only.
interface Window {
  MathJax: any;
  jspdf: any;
  svg2pdf: any;
  claude: any;
  webkitAudioContext: typeof AudioContext;
  Tour: any;
  PlaneMenu: any;
  Palette: any;
  HomRange: any;
  __mjReady: any;
  __tourApi: any;
  __tourTap: any;
  [hook: `__cmw${string}`]: any;
}
