'use strict';
// Small helpers the browser-only files share (issue #20, phase 3). build.py puts this file first, so every file after
// it sees these names. The files that also run in the node unit tests (cx.js, calc.js, region.js, funcs.js, sphere.js,
// curves.js, constr.js, recognize.js, sound.js, construct.js, glsl.js, gl.js) keep their own TAU and DEG until Phase
// 4's imports make the dependency explicit: a test that loads one of them alone has no util.js.
// glsl.js's DEG must stay the same expression as funcs.js's (bit-identical cut angles).
const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;
const $ = (id) => document.getElementById(id);
// an element: h('button', { class, html, onclick, style, ...attributes }, ...children). Attributes null or false are
// left out, true is an empty attribute; children may be nodes, strings, numbers or arrays of them (null, false skipped)
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
