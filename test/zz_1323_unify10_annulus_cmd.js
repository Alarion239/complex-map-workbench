const PORT = '8793';
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
await view(1200, 800, false, false);
const ex = names.indexOf('Logarithm of an annulus');
const state = { v6: true, nextId: 50, shapes: [{ id: 'a1', kind: 'annulus', c: [0, 0], r1: 1, r2: 3, ci: 0, visible: true }], steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], srcView: { cx: 0, cy: 0, s: 70 } };
await loadView('steps', 'za' + Date.now(), state, { lang: 'en' });
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!document.querySelector("#plotL canvas")' });
const raw = await ev('JSON.stringify(__cmwShapes().shapes)');
const out = { raw: JSON.parse(raw), scope: (await ev('__cmwSteps().scope')) };
const cov = async () => ev(`(() => { const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], x = c.getContext('2d'); const m = Math.round(Math.min(c.width, c.height) * 0.14), w = c.width - 2 * m, h = c.height - 2 * m, d = x.getImageData(m, m, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) n++; return n / (d.length / 4); })()`);
for (const k of [0, 1]) {
  await ev(`__cmwSteps(${JSON.stringify({ go: k, now: true })}); 1`); await settled({ max: 30000, until: '!__cmwSteps().anim && !__cmwSteps().play' });
  const st = await ev('(() => { const s = __cmwSteps(); const c = [...document.querySelectorAll("#plotL canvas")].sort((p, q) => q.width * q.height - p.width * p.height)[0]; return { win: s.win, w: c.width, h: c.height, scope: s.scope }; })()');
  // sample Re w / Im w profile: coloured share per column of Re w across the plane (row Im w = 1)
  const ws = []; for (let i = -40; i <= 40; i++) ws.push([i * 0.1, 1.0]);
  const prof = await ev(`(() => { const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], x = c.getContext('2d'), r = c.getBoundingClientRect(); return ${JSON.stringify(ws)}.map(([re, im]) => { const p = __cmwW2S('L', re, im); const px = Math.round((p[0] - r.left) * c.width / r.width), py = Math.round((p[1] - r.top) * c.height / r.height); if (px < 0 || py < 0 || px >= c.width || py >= c.height) return '.'; const d = x.getImageData(px, py, 1, 1).data; return Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]) > 40 ? 1 : 0; }).join(''); })()`);
  out['plane' + k] = Object.assign({ cov: await cov(), profileImW1: prof }, st);
}
return out;
