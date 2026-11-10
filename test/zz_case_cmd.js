process.env.CMW_ONLY = process.env.ZZ_CASE;
return await eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'land_exact.js'), 'utf8'))([true]);
