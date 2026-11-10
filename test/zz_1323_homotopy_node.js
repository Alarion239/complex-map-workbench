const fs=require('fs');
const {Funcs,Inverse,CX}=require('./zz_1323_load.js');
const S=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','src','seasong.js'),'utf8').match(/const SEASONG = (\{.*\});/)[1]);
const steps=S.steps.map(s=>Object.assign({on:true},s));
const built=steps.map(s=>Funcs.build(s));
const b=built[1], F=(z)=>b.f(z), C=(re,im)=>({re,im});
const abs=(z)=>Math.hypot(z.re,z.im);
console.log('step2 nat',JSON.stringify(b.nat),'hom?',typeof b.hom);
// (a) homotopy kind: b.hom(t)(z) against (1-t)z + tF(z), and against the chain composition
const pts=[C(0.3,0.2),C(-0.4,0.5),C(0.7,-0.3),C(-0.2,-0.6),C(0.1,0.9)];
for(const u of [0.25,0.5,0.75]){
  let mx=0,mxs=0;
  for(const z of pts){const H=b.hom(u)(z),L=C((1-u)*z.re+u*F(z).re,(1-u)*z.im+u*F(z).im);mx=Math.max(mx,abs({re:H.re-L.re,im:H.im-L.im})/(1+abs(L)));}
  console.log('u',u,'max rel |H_u - ((1-u)z+uF)| over 5 points:',mx.toExponential(2));
}
// the chain composition: sub[0].hom(3u) etc.
const sub=b.rec.built;
for(const u of [0.25,0.5,0.75]){
  const x=3*u,j=Math.min(2,Math.floor(x));let mx=0;
  for(const z of pts){let w=z;for(let i=0;i<j;i++)w=sub[i].f(w);w=sub[j].hom(x-j)(w);const H=b.hom(u)(z);mx=Math.max(mx,abs({re:H.re-w.re,im:H.im-w.im})/(1+abs(w)));}
  console.log('u',u,'x',x,'j',j,'max rel |H_u - chain homotopy (sub[j].hom(x-j) after sub[0..j-1])|:',mx.toExponential(2));
}
const s0=sub[0];const L=(z)=>s0.f(z);
for(const x of [0.25,0.75,1.0]){let mx=0;for(const z of pts){const H=s0.hom(x)(z),l=L(z),A=C((1-x)*z.re+x*l.re,(1-x)*z.im+x*l.im);mx=Math.max(mx,abs({re:H.re-A.re,im:H.im-A.im})/(1+abs(A)));}console.log('sub[0] (the log sum L): x',x,'max rel |hom - ((1-x)z + xL)|',mx.toExponential(2));}
console.log('sub[1] id',sub[1].def.id,'sub[2] id',sub[2].def.id);
// the exp sub-step's homotopy at x=0.5: compare with a zoom form A_t o exp o B_t not tested; print hom(0.5) of exp at z=0.3+0.2i vs exp and vs (1-x)z+x exp
const e1=sub[1];const z=C(0.3,0.2),H=e1.hom(0.5)(z),E=e1.f(z);console.log('exp hom(.5)(z)',H.re.toFixed(4),H.im.toFixed(4),'| (1-x)z+x exp(z)',(0.5*z.re+0.5*E.re).toFixed(4),(0.5*z.im+0.5*E.im).toFixed(4));
console.log('homTex type',typeof s0.homTex);try{const h=typeof s0.homTex==='function'?s0.homTex(0.5):s0.homTex;console.log(String(h).slice(0,500))}catch(e){console.log('err',e.message)}
console.log('b.homTex', typeof b.homTex, String(typeof b.homTex==='function'?b.homTex(0.5):b.homTex).slice(0,300));
for (const [n,o] of [['sub0',s0],['sub1 exp',sub[1]],['sub2 mul',sub[2]]]) { try { const r=o.homTex('z'); console.log(n,'->',String(r.tex||JSON.stringify(r)).replace(/\s+/g,' ').slice(0,300)); } catch(e){ console.log(n,'err',e.message)} }
// (b) members: distinct preimages z in [-1.6,1.6]^2 of w = H_u(z0), z0 in pts, by Newton from a 70x70 grid of starts (a lower bound)
const cadd=(a,b)=>C(a.re+b.re,a.im+b.im),csub=(a,b)=>C(a.re-b.re,a.im-b.im),cmul=(a,b)=>C(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re),cdiv=(a,b)=>{const d=b.re*b.re+b.im*b.im;return C((a.re*b.re+a.im*b.im)/d,(a.im*b.re-a.re*b.im)/d)};
for(const u of [0.5,0.998]){
  const H=b.hom(u);
  const rows=[];
  for(const z0 of pts){
    const w=H(z0),roots=[];
    for(let i=0;i<70;i++)for(let j=0;j<70;j++){
      let z=C(-1.6+3.2*(i+.5)/70,-1.6+3.2*(j+.5)/70),ok=false;
      for(let it=0;it<60;it++){
        const h=1e-6*(1+abs(z)),f0=csub(H(z),w);
        if(!isFinite(f0.re)||!isFinite(f0.im))break;
        const d=cdiv(csub(H(cadd(z,C(h,0))),H(csub(z,C(h,0)))),C(2*h,0));
        let st=cdiv(f0,d);const sl=abs(st),mx=0.25*(1+abs(z));if(sl>mx)st=C(st.re*mx/sl,st.im*mx/sl);
        z=csub(z,st);
        if(abs(st)<1e-13*(1+abs(z))){ok=true;break;}
      }
      if(ok&&abs(csub(H(z),w))<1e-8*(1+abs(w))&&Math.abs(z.re)<=1.6&&Math.abs(z.im)<=1.6&&!roots.some(r=>abs(csub(r,z))<1e-6*(1+abs(z))))roots.push(z);
    }
    rows.push(roots.length);
  }
  console.log('u',u,'distinct preimages found in [-1.6,1.6]^2 at 5 places w = H_u(z0):',rows.join(' '));
}
