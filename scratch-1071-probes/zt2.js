const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--headless=new','--ignore-gpu-blocklist','--enable-gpu','--no-sandbox','--enable-features=Vulkan','--use-vulkan=native','--disable-vulkan-surface','--use-angle=vulkan']});
const p=await b.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message.slice(0,200)));
await p.goto('http://localhost:8123/test.html?ns=z'+Date.now()+'&lang=en&view=steps');
await p.waitForFunction('typeof GLChain!=="undefined"&&typeof CX!=="undefined"&&!!window.GLR',null,{timeout:120000});
const ZL=JSON.parse(require('fs').readFileSync('zlibs.json','utf8'));await p.evaluate('window.ZL='+JSON.stringify(ZL));
const r=await p.evaluate(`(()=>{
 const c=document.createElement('canvas');c.width=64;c.height=1;const gl=c.getContext('webgl2');if(!gl)return 'nogl';
 if(!gl.getExtension('EXT_color_buffer_float'))return 'noext';
 const L=GLChain.LIB+ZL.g+ZL.z;
 const src='#version 300 es\\nprecision highp float;precision highp int;\\n'+L+'\\nuniform vec2 uS[64];out vec4 o;void main(){int i=int(gl_FragCoord.x);vec2 z=cx_zeta(uS[i]);o=vec4(z,0.0,1.0);}';
 const vs='#version 300 es\\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}';
 const mk=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x).slice(0,400));return x};
 const pr=gl.createProgram();gl.attachShader(pr,mk(gl.VERTEX_SHADER,vs));gl.attachShader(pr,mk(gl.FRAGMENT_SHADER,src));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return 'link '+gl.getProgramInfoLog(pr);
 gl.useProgram(pr);
 const pts=[];for(let k=0;k<64;k++){pts.push(-3+0.4*(k%16), [30,60,90,115][k>>4])}
 const S=new Float32Array(pts);gl.uniform2fv(gl.getUniformLocation(pr,'uS'),S);gl.uniform1i(gl.getUniformLocation(pr,'uNoUnroll'),0);
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,64,1,0,gl.RGBA,gl.FLOAT,null);
 const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
 gl.viewport(0,0,64,1);gl.drawArrays(gl.TRIANGLES,0,3);const out=new Float32Array(64*4);gl.readPixels(0,0,64,1,gl.RGBA,gl.FLOAT,out);
 const rows=[];for(let k=0;k<64;k+=1){const s=CX.C(S[2*k],S[2*k+1]),z=CX.zeta(s);{const e=Math.hypot(out[4*k]-z.re,out[4*k+1]-z.im)/(1+Math.hypot(z.re,z.im));if(!(e<1e-3))rows.push([+S[2*k].toFixed(1),S[2*k+1],e,+Math.hypot(z.re,z.im).toFixed(1)])}}
 return JSON.stringify(rows)})()`);
console.log(r);await b.close()})();
