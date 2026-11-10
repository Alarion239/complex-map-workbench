process.env.CMW_ONLY = 'Möbius, √';
return await eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'land_exact.js'), 'utf8'))([true]);
