// node notes/i18n/latex/pdf_info_test.js : a PDF whose info Subject is Russian, written as I18N.pdfText() writes it
// (UTF-16BE with a BOM); pdfinfo must print the Cyrillic back (review i18n-21)
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const I18N = require('../proto/i18n.js');
const subj = 'Рис. 1. Образ полосы 0 < Im z < π при отображении w = tg z';
const esc = (b) => b.replace(/[\\()]/g, (c) => '\\' + c);
const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>',
  `<< /Title (${esc(I18N.pdfText('Figure'))}) /Subject (${esc(I18N.pdfText(subj))}) >>`];
let pdf = '%PDF-1.4\n', offs = [];
objs.forEach((o, i) => { offs.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xref = Buffer.byteLength(pdf, 'latin1');
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const f = path.join(__dirname, 'pdf_info_ru.pdf');
fs.writeFileSync(f, Buffer.from(pdf, 'latin1'));
const info = cp.execFileSync('pdfinfo', [f], { encoding: 'utf8' });
const got = (/Subject:\s+(.*)/.exec(info) || [])[1];
const pass = got === subj && /Title:\s+Figure/.test(info);
console.log(pass ? 'pdf info: the Russian Subject reads back (pdfinfo)' : 'FAIL pdf info: ' + JSON.stringify(got));
process.exit(pass ? 0 : 1);
