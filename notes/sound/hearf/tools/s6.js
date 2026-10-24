// zeros of H_t(z) = t z^3 + (1-t) z - t (straight-line homotopy z -> z^3 - 1), Durand-Kerner
function roots(t){ if(t<1e-9) return [[0,0]]; const a=[(1-t)/t,-1]; // z^3 + p z + q, p=(1-t)/t, q=-1
 let r=[[0.4,0.9],[-0.6,0.3],[0.2,-0.8]];
 const f=(z)=>{const [x,y]=z; const x2=x*x-y*y, y2=2*x*y; const x3=x2*x-y2*y, y3=x2*y+y2*x; return [x3+a[0]*x+a[1], y3+a[0]*y];};
 for(let it=0;it<500;it++){ r=r.map((z,i)=>{let [nx,ny]=f(z); let dx=1,dy=0; r.forEach((w,j)=>{if(j!==i){const ux=z[0]-w[0],uy=z[1]-w[1]; const tx=dx*ux-dy*uy, ty=dx*uy+dy*ux; dx=tx; dy=ty;}}); const d=dx*dx+dy*dy; return [z[0]-(nx*dx+ny*dy)/d, z[1]-(ny*dx-nx*dy)/d];}); }
 return r; }
let entered=null, minI=9, tI=0;
for(let k=1;k<=1000;k++){ const t=k/1000, r=roots(t);
  for(const z of r){ const d1=Math.hypot(z[0]-1,z[1]); if(d1<0.5 && entered===null) entered=[t,z]; const di=Math.hypot(z[0],z[1]-1); if(di<minI){minI=di;tI=t;} } }
console.log('zero enters |z-1|<1/2 at t=',entered); console.log('closest zero to i:',minI.toFixed(3),'at t=',tI);
for (const t of [0.1,0.25,0.5,0.75,1]) console.log(t, roots(t).map(z=>z.map(v=>v.toFixed(3)).join(',')).join('  '));
