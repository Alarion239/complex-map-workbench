const {chromium}=require('playwright');
const names=[...require('fs').readFileSync('/home/user/complex-map-workbench/src/app/15-examples-guide.js','utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map(m=>m[1]);
const ex=names.indexOf('Zeros of the zeta function');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--headless=new','--ignore-gpu-blocklist','--enable-gpu','--no-sandbox','--enable-features=Vulkan','--use-vulkan=native','--disable-vulkan-surface','--use-angle=vulkan']});
const p=await b.newPage({viewport:{width:1440,height:900}});
p.on('pageerror',e=>console.log('PAGEERR',e.message.slice(0,200)));
if(process.env.DBG)await p.addInitScript('window.__newtDbg='+process.env.DBG);
await p.goto('http://localhost:'+process.argv[2]+'/test.html?ns=g'+Date.now()+'&lang=en&view=steps');
await p.waitForFunction('typeof __cmwExample==="function"&&typeof __cmwSteps==="function"&&!!window.GLR&&!!document.querySelector("#svStrip")',null,{timeout:120000});
if(process.env.FORCE)await p.evaluate(`(()=>{const sa=Inverse.shapeAnchor;Inverse.shapeAnchor=function(pl,s,w){const r=sa.apply(this,arguments);return r?{re:0.5,im:r.im}:r}})()`);
await p.evaluate(`__cmwExample(${ex})`);await p.waitForTimeout(3000);
await p.evaluate(`__cmwSteps({bare:true,scope:'in'})`);
const out={};
for(const x of (process.env.XS||"0.25,0.5,0.75").split(",").map(Number)){
 await p.evaluate(`__cmwSteps({x:${x}})`);
 await p.waitForFunction(`(()=>{const g=__cmwSteps().glide;return !!g&&Math.abs(g.u-${x})<1e-9&&g.path==='inverse'})()`,null,{timeout:300000});
 await p.waitForTimeout(3000);
 out[x]=await p.evaluate(`(()=>{const cv=document.querySelector('#canvasL'),c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const g=c.getContext('2d');g.drawImage(cv,0,0);const W=c.width,H=c.height,d=g.getImageData(0,0,W,H).data;const gl=__cmwSteps().glide;
  let col=0,n=0;const pts=[],rgb=[];for(let j=0;j<H;j+=6)for(let i=0;i<W;i+=6){n++;const k=4*(j*W+i);const r=d[k],gg=d[k+1],bb=d[k+2];const paper=r>240&&gg>240&&bb>240;if(!paper)col++;pts.push(paper?0:1);rgb.push(r+','+gg+','+bb)}
  return {W,H,n,col,path:gl.path,pts:pts.join(''),rgb}})()`);
 console.log(x,out[x].path,out[x].W,out[x].H,out[x].col,'/',out[x].n);
}
require('fs').writeFileSync(process.argv[3],JSON.stringify(out));await b.close()})();
