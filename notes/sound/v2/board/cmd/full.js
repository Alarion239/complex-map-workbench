await nav('http://127.0.0.1:9053/notes/sound/v2/board.html?v=' + Date.now()); await sleep(400);
await click(600, 300); await sleep(500);
await ev(fs.readFileSync(path.join(DIR, '../measure.js'), 'utf8') + '; 1');
const out = {};
for (const k of ['cues', 'scrubs', 'morphPlay', 'shepard']) out[k] = JSON.parse(await ev(`JSON.stringify(await __M.${k}())`, 280000));
const R = JSON.parse(await ev(`JSON.stringify(await __M.renders())`, 280000));
for (const [k, v] of Object.entries(R)) fs.writeFileSync(path.join(DIR, '../rec', 'off_' + k + '.f32'), Buffer.from(v, 'base64'));
fs.writeFileSync(path.join(DIR, '../out_measure.json'), JSON.stringify(out, null, 1));
return { ok: Object.keys(out), renders: Object.keys(R), logs: logs() };
