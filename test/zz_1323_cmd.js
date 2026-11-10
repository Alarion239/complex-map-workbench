// The steps view's rest frame is the exact pass's whatever a saved exactImages (an internal switch, no option in the page) says,
// and nothing else changes with it:
// - at rest on a plane past the colour plane, the frame with the switch off is the frame with it on (the exact pass's);
// - a glide frame under the switch off is the same as under the switch on, drawn by the inverse pass ('inverse');
// - the classic view still takes the switch: with it off a region is drawn forward ('exact images off'), with it on by the
//   inverse pass.
// A control: the measure tells two different frames apart (plane 0's rest frame against plane 1's).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { lpx } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));

const START_WAIT = 30000;
await view(1440, 900, false, false);
const { hold, grab, compare, refOf } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));

const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const names = K.exampleNames();
const pick = (re) => names.findIndex((n) => re.test(n));
const EXS = [['Newton z^3-1', pick(/Newton.*z/i)]];
info.names = EXS.map((e) => e[0] + '=' + e[1] + ':' + names[e[1]]).join(' | ');
const goTo = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 90000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
const cov = () => ev(`(() => { const cv = document.getElementById('canvasL'), W = 200, H = 125, g = document.createElement('canvas'); g.width = W; g.height = H; const x = g.getContext('2d'); x.drawImage(cv, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data; let n = 0, c = 0; for (let k = 0; k < d.length; k += 4) { n++; if (Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]) > 12 || d[k] < 200) c++; } return +(c / n).toFixed(3); })()`);
const glidePath = (surf) => ev(`(() => { const g = __cmwSteps().glide || {}; let s = (g.path || '?') + (g.reason ? '(' + String(g.reason).slice(0, 28) + ')' : '');
  if (${JSON.stringify(surf)} === 'sphere') { try { const q = __cmwSvGlobe(0.5, 0.5); s += ' globe:' + q.path; } catch (e) {} }
  if (${JSON.stringify(surf)} === 'land') { try { const c = __cmwLandCarry(); s += c ? ' land:carried' : ' land:none'; } catch (e) {} }
  return s; })()`);
const restPath = () => ev(`(() => { try { return __cmwPaths().map((q) => q.role + ':' + q.viewKind + ':' + q.path + (q.reason ? '(' + q.reason + ')' : '')).join(' '); } catch (e) { return 'err'; } })()`);
for (const [en, ei] of EXS) {
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=zz1323${Date.now()}&lang=en&view=steps` });
  await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwExample === "function" && typeof __cmwSvX === "function" && !!window.GLR' });
  await ev(`__cmwExample(${ei}); 1`); await settled({ max: 60000 });
  const nPlanes = await ev(`document.querySelectorAll('#svStrip .sv-plane').length`);
  info[en + ' planes'] = nPlanes;
  await ev(`__cmwSet('alpha', 1), 1`);
  const bs = en === 'Mountain King' ? [2] : [1];
  for (const surf of ['plane', 'sphere', 'land']) {
    await ev(`__cmwSteps({ surf: ${JSON.stringify(surf)}, scope: 'in' }), 1`); await settled({ max: 30000 });
    for (const b of bs) {
      await goTo(b - 1); await grab('P0');
      await goTo(b); await settled({ max: 90000, until: `__cmwSteps().ready && __cmwSteps().ready.ready` }); await settled({ max: 30000 });
      const row = { rest: (await restPath()) + (surf === 'sphere' ? ' globe:' + (await ev(`(() => { try { return __cmwSvGlobe(0.5, 0.5).path; } catch (e) { return ''; } })()`)) : ''), cov: await cov() };
      await grab('P1');
      for (const u of (surf === 'land' ? [0.5] : [0.25, 0.5, 0.75, 0.998])) {
        const h = await hold(b - 1 + u); await grab('M' + u);
        const r = { held: h.ok, path: await glidePath(surf), cov: await cov() };
        if (surf === 'plane') { const rf = await refOf('P0', 'M' + u, 6, 10); r.ref = rf && rf.over != null ? +Number(rf.over).toFixed(3) : (rf ? 'n/a' : null); if (u === 0.998) { const cp = await compare('P1', 'M' + u); r.vsRest = cp && cp.frac != null ? +Number(cp.frac).toFixed(3) : JSON.stringify(cp).slice(0, 40); } }
        row['u' + u] = r;
        await ev('window.__svScrubUp(), 1'); await goTo(b - 1);
      }
      info[`${en} b${b} ${surf}`] = `rest[${row.rest}] cov${row.cov} | ` + Object.entries(row).filter(([k]) => k[0] === 'u').map(([k, r]) => `${k}: ${r.path} cov${r.cov}${r.ref !== undefined ? ' ref' + r.ref : ''}${r.vsRest !== undefined ? ' vsRest ' + r.vsRest : ''}${r.held ? '' : ' NOTHELD'}`).join(' ; ');
    }
  }
}
ok('INFO', false, info);
return { pass: false, fails, info };
