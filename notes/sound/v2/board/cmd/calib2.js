await nav('http://127.0.0.1:9053/notes/sound/v2/board.html?v=' + Date.now()); await sleep(400);
await click(600, 300); await sleep(400);
await ev(fs.readFileSync(path.join(DIR, '../measure.js'), 'utf8') + '; 1');
const r = await ev(`JSON.stringify(await __M.calib(8))`, 280000);
return { r: JSON.parse(r), logs: logs() };
