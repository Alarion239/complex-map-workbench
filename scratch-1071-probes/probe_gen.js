global.CX=require('/home/user/complex-map-workbench/src/cx.js');global.Expr=require('/home/user/complex-map-workbench/src/parse.js');global.Funcs=require('/home/user/complex-map-workbench/src/funcs.js');global.Region=require('/home/user/complex-map-workbench/src/region.js');
const Inverse=require('/home/user/complex-map-workbench/src/inverse.js');global.Inverse=Inverse;
const GLChain=require('/home/user/complex-map-workbench/src/glsl.js');
const st={type:'zeta',params:Funcs.defaults('zeta'),on:true};const b=Funcs.build(st);
const bh=Inverse.homBuilt(b,0.5,CX.C(0.5,10));
const inv=GLChain.buildInverse([st],[bh]);
const z=JSON.parse(require('fs').readFileSync('zlibs.json','utf8'));
const out={lib:inv.lib,g:z.g,z:z.z,LIB:GLChain.LIB,slots:inv.slots};
require('fs').writeFileSync('probe_src.json',JSON.stringify(out));console.log(inv.lib.length,inv.ok);
