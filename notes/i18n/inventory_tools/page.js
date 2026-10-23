// page.html: <title>, visible attributes and text nodes of the body, CSS content strings. Emits rows shaped like raw rows.
const fs=require('fs');const [,,file,out,fname]=process.argv;const src=fs.readFileSync(file,'utf8');const lines=src.split('\n');const rows=[];
const lineAt=(pos)=>src.slice(0,pos).split('\n').length;
let m;const t=/<title>([^<]*)<\/title>/.exec(src);if(t)rows.push({file:fname,line:lineAt(t.index),value:t[1],ctx:{prop:'document title'},attr:'title-tag'});
// CSS content
const re1=/content:\s*"([^"]*[A-Za-z][^"]*)"/g;while((m=re1.exec(src)))rows.push({file:fname,line:lineAt(m.index),value:m[1],ctx:{prop:'CSS content'},attr:'css-content'});
// body: strip svg/style/script but keep positions
let body=src.replace(/<(style|script|svg)\b[\s\S]*?<\/\1>/g,(s)=>s.replace(/[^\n]/g,' ')).replace(/<!--[\s\S]*?-->/g,(s)=>s.replace(/[^\n]/g,' '));
const re2=/\b(title|aria-label|data-tip|placeholder|alt)="([^"]*[A-Za-z][^"]*)"/g;while((m=re2.exec(body))){if(body.slice(Math.max(0,m.index-10),m.index).includes('<title'))continue;rows.push({file:fname,line:lineAt(m.index),value:m[2],ctx:{prop:m[1]},attr:m[1]})}
const re3=/>([^<>]*[A-Za-z][^<>]*)</g;while((m=re3.exec(body))){const v=m[1].trim();if(!v||/^\s*$/.test(v)||/[{};]\s*$/.test(v)&&/:/.test(v))continue;if(src.slice(m.index-7,m.index)==='<title')continue;rows.push({file:fname,line:lineAt(m.index),value:v,ctx:{prop:'text'},attr:'text'})}
fs.writeFileSync(out,JSON.stringify(rows));console.log(fname,rows.length);
