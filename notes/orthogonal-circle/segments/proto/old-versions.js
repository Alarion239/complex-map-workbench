// SPEC.md 8: an older core reading a saved seg perp. Run: node old-versions.js <src of v16.3 or v16.2>
const path=require('path');const SRC=process.argv[2];global.CX=require(path.join(SRC,'cx.js'));global.Region=require(path.join(SRC,'region.js'));const K=require(path.join(SRC,'constr.js'));global.Constr=K;
const st={shapes:[{id:'s1',kind:'circle',c:[0,0],r:1,fixed:'unit'},{id:'p1',kind:'point',p:[0.3,0.2]},{id:'p2',kind:'point',p:[-0.4,0.1]},
{id:'k',kind:'arc',a:[0,1],m:[0.1,0.1],b:[1,0],def:{op:'perp',args:[{s:'s1',part:0},{s:'p1'},{s:'p2'}],fill:'none',nk:'circle',seg:1,flip:false}}],targets:[],steps:[]};
const v=K.validate(st);console.log('validate ->',JSON.stringify(v).slice(0,200));
const k=st.shapes[3];console.log('def after validate',JSON.stringify(k.def));
try{K.recompute(st,{all:true},{});}catch(e){console.log('recompute err',e.message)}
console.log('kind',k.kind,'c',k.c,'r',k.r,'def',JSON.stringify(k.def));
