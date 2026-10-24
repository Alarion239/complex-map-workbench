const r = await ev(`JSON.stringify(await __M.calib(6))`, 280000);
return { r: JSON.parse(r), logs: logs() };
