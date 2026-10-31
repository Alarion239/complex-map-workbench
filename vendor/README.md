# vendor/

The offline page's third-party code and fonts, vendored for issue #21 (option b, two builds). The live page loads
MathJax and the faces from CDNs as before; `dist/complex-map-workbench-offline.html`, which Pages publishes beside it
and Settings links to (Download offline page), has them inline and needs no network. The build (`build.py`) reads this
directory only and never touches the network.

- `js/tex-svg.js`: MathJax 3.2.2, the typesetter (goes into the offline page as a JSON block, started after it loads)
- `js/jspdf.umd.min.js`, `js/svg2pdf.umd.min.js`: jsPDF 2.5.1 and svg2pdf.js 2.2.3, the figure export's PDF library
  (JSON blocks too, started on the first PDF export, issue #393)
- `fonts/`: Roboto Flex (the interface, in every language), JetBrains Mono (readouts and input) and STIX Two Text (math),
  from the @fontsource packages, subset to the characters the app's sources
  use plus the letters a user may type, their variation axes cut to the ranges the CSS uses
- `licenses/`: the packages' licenses (MathJax: Apache-2.0; jsPDF and svg2pdf.js: MIT; the fonts: SIL OFL 1.1)
- `LOCK.json`: the packages' versions and tarball sha256, the outputs' sha256, the @font-face list and the subset's
  characters

`python3 tools/vendor.py` writes it all again (npm and `pip install fonttools brotli`); `test/t_vendor.js` fails when
a source uses a character outside the subset, or a file does not match the lock.
