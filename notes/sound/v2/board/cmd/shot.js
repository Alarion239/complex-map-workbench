await nav('http://127.0.0.1:9053/notes/sound/v2/board.html?v=' + Date.now()); await sleep(500);
await view(1100, 1500, false); await sleep(300);
await shot('board_light');
await view(390, 1600, true, true); await sleep(400);
await shot('board_phone_dark');
const ov = await ev(`document.documentElement.scrollWidth + ' ' + window.innerWidth`);
await view(1440, 900, false);
return { ov, logs: logs() };
