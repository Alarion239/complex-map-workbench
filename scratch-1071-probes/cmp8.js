global.CX=require('/home/user/complex-map-workbench/src/cx.js');global.Expr=require('/home/user/complex-map-workbench/src/parse.js');global.Funcs=require('/home/user/complex-map-workbench/src/funcs.js');global.Region=require('/home/user/complex-map-workbench/src/region.js');
const C=CX.C,ab=(z)=>Math.hypot(z.re,z.im),sub=(a,c)=>C(a.re-c.re,a.im-c.im);
const b=Funcs.build({type:'zeta',params:Funcs.defaults('zeta'),on:true});
const G=JSON.parse(require('fs').readFileSync('gpu_new.json','utf8'));
for(const t of [0.25,0.5,0.75]){const g=G[t];const Ht=b.hom(t);const W=g.W,H=g.H;
const dH=(u)=>{const h=1e-6;return CX.scale(CX.sub(Ht(C(u.re+h,u.im)),Ht(C(u.re-h,u.im))),0.5/h)};
const nw=(u,w)=>{for(let k=0;k<40;k++){u=sub(u,CX.div(sub(Ht(u),w),dH(u)));if(!isFinite(u.re)||ab(u)>1e3)return null}return ab(sub(Ht(u),w))<=1e-9*(1+ab(w))?u:null};
let idx=0,tr=0,both=0,gc=0;
for(let j=0;j<H;j+=6)for(let i=0;i<W;i+=6){const w=C(0.5+(i+.5-W/2)/40,19.5-(j+.5-H/2)/40);const base=w.im/(1-t);
 let T=false;for(let d=-6;d<=6&&!T;d+=.5){for(const re of [.3,.7]){const u=nw(C(re,base+d),w);if(u&&u.re>0&&u.re<1&&u.im>=10.45&&u.im<=28.55){T=true;break}}}
 const gp=g.pts[idx++]==='1';if(T)tr++;if(gp)gc++;if(T&&gp)both++}
console.log(t,{truthInWindow:tr,gpu:gc,both,share:(both/tr).toFixed(2)})}
