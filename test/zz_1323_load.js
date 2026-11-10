const fs=require('fs'),vm=require('vm'),path=require('path');
const root=require('path').join(__dirname,'..');
const ctx={console,performance:{now:()=>0},setTimeout,clearTimeout,window:{}};vm.createContext(ctx);
const {source}=require(root+'/test/src_text');
const names=(fs.readFileSync(root+'/test/t_gl_inverse.js','utf8').match(/const NAMES = (\{.*\});/)||[])[1];
const MAP=eval('('+names+')');
for(const f of Object.keys(MAP))vm.runInContext(source(f+'.js',path.join(root,'src'),{esm:'strip'})+';globalThis.'+MAP[f]+'='+MAP[f]+';',ctx,{filename:f+'.js'});
module.exports=ctx;
